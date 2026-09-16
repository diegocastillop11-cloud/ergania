import { Request, Response } from 'express'
import * as ctrl from './careersController'
import * as chatSvc from '../services/chatService'
import { getSubscriptionStatus } from '../services/subscriptionService'

const { getUser, getLlmClient, friendlyAiError } = ctrl

const ORCHESTRATOR_MODEL = 'claude-haiku-4-5'

const UPGRADE_MESSAGE = 'Llegaste al límite de la versión gratuita de Ergania. Para seguir usando el chat y el resto de la app sin restricciones, activa tu suscripción.'

// ── Adaptador: invoca un handler HTTP existente de careersController sin
// tocarlo — evita duplicar lógica ya afinada (prompts, límites, parsing) y
// mantiene el god-file en cero líneas nuevas. El handler solo usa
// req.headers/body/params/query y res.status()/json()/headersSent, así que
// un req/res mínimo alcanza. ──────────────────────────────────────────────

type MinimalReq = { headers: Record<string, string>; body: Record<string, unknown>; params: Record<string, string>; query: Record<string, string> }
interface HandlerResult { status: number; body: Record<string, unknown> }

function callHandler(handler: (req: Request, res: Response) => unknown, req: MinimalReq): Promise<HandlerResult> {
  return new Promise((resolve, reject) => {
    let settled = false
    const res = {
      headersSent: false,
      _status: 200,
      status(code: number) { this._status = code; return this },
      json(body: unknown) {
        this.headersSent = true
        if (!settled) { settled = true; resolve({ status: this._status, body: body as Record<string, unknown> }) }
        return this
      },
    }
    Promise.resolve(handler(req as unknown as Request, res as unknown as Response)).catch(err => {
      if (!settled) { settled = true; reject(err) }
    })
  })
}

function authReq(authorization: string, body: Record<string, unknown>, params: Record<string, string> = {}): MinimalReq {
  return { headers: { authorization }, body, params, query: {} }
}

// ── Definición de tools para Claude ──────────────────────────────────────────

const TOOLS = [
  {
    name: 'evaluar_oferta',
    description: 'Evalúa una oferta de trabajo (igual que el botón "Evaluar Oferta"): analiza legitimidad, score, seniority y estima la renta. Úsala cuando el usuario pegue una URL o el texto de una oferta y pida evaluarla, analizarla o darle su opinión sobre si postular.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'URL de la oferta, si el usuario la dio' },
        jd: { type: 'string', description: 'Texto completo de la oferta, si el usuario lo pegó en vez de una URL' },
        empresa: { type: 'string', description: 'Nombre de la empresa, si se conoce' },
        rol: { type: 'string', description: 'Título del cargo, si se conoce' },
      },
    },
  },
  {
    name: 'crear_postulacion',
    description: 'Crea una postulación y genera el CV adaptado a esa oferta (igual que "Postularme" en Postulaciones). Solo úsala después de evaluar la oferta, usando los mismos datos (empresa, rol, url, score, reportSlug) que devolvió evaluar_oferta.',
    input_schema: {
      type: 'object' as const,
      properties: {
        empresa: { type: 'string' },
        rol: { type: 'string' },
        url: { type: 'string' },
        score: { type: 'number' },
        reportSlug: { type: 'string', description: 'El reportSlug devuelto por evaluar_oferta, si existe' },
      },
      required: ['empresa', 'rol'],
    },
  },
  {
    name: 'generar_carta',
    description: 'Genera la carta de presentación para una postulación ya creada. Requiere el applicationId de una postulación existente (lo devuelve crear_postulacion).',
    input_schema: {
      type: 'object' as const,
      properties: {
        applicationId: { type: 'string' },
        idioma: { type: 'string', enum: ['es', 'en'] },
      },
      required: ['applicationId'],
    },
  },
  {
    name: 'pretension_renta',
    description: 'Estima la pretensión de renta líquida para una postulación ya creada. Requiere el applicationId de una postulación existente.',
    input_schema: {
      type: 'object' as const,
      properties: {
        applicationId: { type: 'string' },
      },
      required: ['applicationId'],
    },
  },
]

const SYSTEM_PROMPT = `Eres el asistente de Ergania, una app chilena de búsqueda de empleo. Hablas en español neutro profesional chileno (sin voseo).

Lo que Ergania hace y que puedes ayudar a operar:
- Evaluar ofertas de trabajo (legitimidad, score, seniority, renta estimada).
- Crear postulaciones, lo que genera automáticamente un CV adaptado a esa oferta.
- Generar cartas de presentación para una postulación.
- Estimar la pretensión de renta para una postulación.
- Explicar cómo usar cualquier otra parte de la app (Scanner de portales, Tracker, Perfil, Optimizador de LinkedIn, etc.) respondiendo directamente en texto, sin usar ninguna herramienta.

Reglas:
1. Si el usuario pide una acción concreta que corresponde a una de tus herramientas, invócala con los datos que tengas. El sistema le va a pedir confirmación al usuario antes de ejecutarla de verdad — vos solo proponés.
2. Nunca inventes un applicationId, reportSlug o resultado — si te falta un dato necesario (ej. no hay una postulación creada todavía), pídeselo al usuario o sugerí primero evaluar_oferta / crear_postulacion.
3. Si la pregunta es general (cómo funciona algo, dudas sobre la app, consejos de búsqueda laboral), respondé en texto plano, sin tools.
4. Sé breve y directo. Sin relleno.`

interface ToolUseBlock { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
interface TextBlock { type: 'text'; text: string }

async function askOrchestrator(req: Request, history: Array<{ role: 'user' | 'assistant'; content: string }>) {
  const client = getLlmClient(req)
  const response = await client.messages.create({
    model: ORCHESTRATOR_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: history,
    tools: TOOLS,
  } as unknown as Parameters<typeof client.messages.create>[0])

  const blocks = response.content as unknown as Array<ToolUseBlock | TextBlock>
  const text = blocks.filter((b): b is TextBlock => b.type === 'text').map(b => b.text).join('\n').trim()
  const toolUse = blocks.find((b): b is ToolUseBlock => b.type === 'tool_use')
  return { text, toolUse }
}

function proposalText(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'evaluar_oferta':
      return `¿Evalúo esta oferta${input.empresa ? ` de ${input.empresa}` : ''}${input.rol ? ` (${input.rol})` : ''}?`
    case 'crear_postulacion':
      return `¿Creo la postulación a ${input.empresa || 'esta empresa'}${input.rol ? ` — ${input.rol}` : ''} y genero el CV adaptado?`
    case 'generar_carta':
      return '¿Genero la carta de presentación para esta postulación?'
    case 'pretension_renta':
      return '¿Calculo la pretensión de renta para esta postulación?'
    default:
      return '¿Confirmas esta acción?'
  }
}

// ── POST /api/chat/message ───────────────────────────────────────────────────

export const sendMessage = async (req: Request, res: Response) => {
  let userId: string | undefined
  let userEmail: string | undefined
  const userMessage = String(req.body?.message ?? '').trim()
  try {
    const user = await getUser(req)
    userId = user.userId
    userEmail = user.email
    if (!userMessage) return res.status(400).json({ error: 'Falta el mensaje' })

    const sub = await getSubscriptionStatus(userId)
    const isTrial = sub.status === 'trial'

    if (isTrial) {
      const used = await chatSvc.getConsultasUsed(userId)
      if (used >= chatSvc.TRIAL_CONSULTAS_LIMIT) {
        await chatSvc.saveMessage(userId, 'user', userMessage)
        const assistant = await chatSvc.saveMessage(userId, 'assistant', UPGRADE_MESSAGE)
        return res.json({
          message: assistant,
          usage: { trial: true, consultasUsed: used, consultasLimit: chatSvc.TRIAL_CONSULTAS_LIMIT, showUpgradeCta: true },
        })
      }
    }

    await chatSvc.saveMessage(userId, 'user', userMessage)
    const consultasUsed = isTrial ? await chatSvc.incrementConsultasUsed(userId) : 0

    const history = await chatSvc.getHistory(userId)
    const messages = history.map(m => ({ role: m.sender, content: m.body }))

    const { text, toolUse } = await askOrchestrator(req, messages)

    let assistant: chatSvc.ChatMessageRow
    if (toolUse) {
      const replyText = text || proposalText(toolUse.name, toolUse.input)
      assistant = await chatSvc.saveMessage(userId, 'assistant', replyText, {
        pendingAction: { tool: toolUse.name, input: toolUse.input },
      })
    } else {
      assistant = await chatSvc.saveMessage(userId, 'assistant', text || 'No estoy seguro de cómo ayudarte con eso — ¿puedes darme más detalle?')
    }

    const showUpgradeCta = isTrial && consultasUsed >= chatSvc.TRIAL_CONSULTAS_LIMIT - 2
    res.json({
      message: assistant,
      usage: { trial: isTrial, consultasUsed, consultasLimit: chatSvc.TRIAL_CONSULTAS_LIMIT, showUpgradeCta },
    })
  } catch (err: unknown) {
    console.error('[chat/message] error:', err)
    await chatSvc.logChatError(userId ?? null, userEmail ?? null, userMessage, (err as Error).message ?? String(err))
    res.status(500).json({ error: friendlyAiError(err) })
  }
}

// ── POST /api/chat/confirm-action ────────────────────────────────────────────

export const confirmAction = async (req: Request, res: Response) => {
  let userId: string | undefined
  let userEmail: string | undefined
  try {
    const user = await getUser(req)
    userId = user.userId
    userEmail = user.email
    const { messageId } = req.body ?? {}
    if (!messageId) return res.status(400).json({ error: 'Falta messageId' })

    const pending = await chatSvc.getPendingAction(messageId, userId)
    if (!pending) return res.status(404).json({ error: 'No hay una acción pendiente para confirmar' })

    const authorization = req.headers['authorization'] as string
    const tool = pending.tool as string
    const input = (pending.input ?? {}) as Record<string, unknown>

    let resultText: string
    let toolResult: Record<string, unknown>
    let blocked = false

    if (tool === 'evaluar_oferta') {
      const result = await callHandler(ctrl.evaluateJob, authReq(authorization, input))
      if (result.status === 429) {
        blocked = true
        resultText = `${result.body.error} ${UPGRADE_MESSAGE}`
      } else if (result.status >= 400) {
        resultText = String(result.body.error ?? 'No se pudo evaluar la oferta.')
      } else {
        const entry = result.body.entry as Record<string, unknown>
        const meta = result.body.meta as Record<string, unknown>
        const keywords = Array.isArray(meta?.keywords) ? (meta.keywords as string[]).slice(0, 5).join(', ') : ''
        resultText = [
          `**${entry?.empresa ?? 'Empresa'}** — ${entry?.rol ?? 'Rol'}`,
          `Score: **${meta?.score ?? '—'}/5** · Recomendación: **${meta?.recomendacion ?? '—'}**`,
          `Seniority: ${meta?.seniority ?? '—'} · Modalidad: ${meta?.remoto ?? '—'} · Legitimidad: ${meta?.legitimidad ?? '—'}`,
          meta?.arquetipo ? `Tipo de rol: ${meta.arquetipo}` : undefined,
          keywords ? `Palabras clave: ${keywords}` : undefined,
          `Renta estimada: ${meta?.salario_clp ?? 'sin dato'}`,
        ].filter(Boolean).join('\n')
      }
      toolResult = result.body
    } else if (tool === 'crear_postulacion') {
      const result = await callHandler(ctrl.createApplication, authReq(authorization, input))
      if (result.status >= 400) {
        resultText = String(result.body.error ?? 'No se pudo crear la postulación.')
      } else {
        const app = result.body.application as Record<string, unknown>
        resultText = `Postulación creada para ${app?.empresa} — ${app?.rol}, con el CV ya adaptado. La puedes ver en Postulaciones.`
      }
      toolResult = result.body
    } else if (tool === 'generar_carta') {
      const applicationId = String(input.applicationId ?? '')
      const result = await callHandler(ctrl.generateCoverLetter, authReq(authorization, { idioma: input.idioma }, { id: applicationId }))
      if (result.status >= 400) {
        resultText = String(result.body.error ?? 'No se pudo generar la carta.')
      } else {
        resultText = 'Carta de presentación generada. La puedes ver y descargar en Postulaciones.'
      }
      toolResult = result.body
    } else if (tool === 'pretension_renta') {
      const applicationId = String(input.applicationId ?? '')
      const result = await callHandler(ctrl.getSalaryRecommendation, authReq(authorization, { applicationId }))
      if (result.status >= 400) {
        resultText = String(result.body.error ?? 'No se pudo calcular la pretensión de renta.')
      } else {
        const b = result.body as { salario_clp?: string; rango_min?: number; rango_max?: number; moneda?: string; explicacion?: string }
        resultText = b.salario_clp
          ? `Pretensión de renta estimada: ${b.salario_clp}.`
          : `Pretensión de renta estimada: ${Number(b.rango_min).toLocaleString('es-CL')} - ${Number(b.rango_max).toLocaleString('es-CL')} ${b.moneda ?? ''}. ${b.explicacion ?? ''}`
      }
      toolResult = result.body
    } else {
      return res.status(400).json({ error: `Herramienta desconocida: ${tool}` })
    }

    await chatSvc.resolvePendingAction(messageId, userId, { ...toolResult, blocked })
    const assistant = await chatSvc.saveMessage(userId, 'assistant', resultText, { toolResult: { ...toolResult, blocked } })

    res.json({ message: assistant, usage: { showUpgradeCta: blocked } })
  } catch (err: unknown) {
    console.error('[chat/confirm-action] error:', err)
    await chatSvc.logChatError(userId ?? null, userEmail ?? null, '(confirm-action)', (err as Error).message ?? String(err))
    res.status(500).json({ error: friendlyAiError(err) })
  }
}

// ── POST /api/chat/quick-action ──────────────────────────────────────────────
// Crea una propuesta de acción directamente (sin pasar por el modelo) para los
// botones de seguimiento que aparecen bajo un resultado ya ejecutado — ej.
// "Preparar kit de postulación" después de evaluar una oferta. Sigue pasando
// por el mismo Confirmar/Cancelar que cualquier otra propuesta.

export const quickAction = async (req: Request, res: Response) => {
  try {
    const { userId } = await getUser(req)
    const { tool, input } = req.body ?? {}
    if (!tool || typeof tool !== 'string') return res.status(400).json({ error: 'Falta tool' })
    const assistant = await chatSvc.saveMessage(userId, 'assistant', proposalText(tool, (input ?? {}) as Record<string, unknown>), {
      pendingAction: { tool, input: input ?? {} },
    })
    res.json({ message: assistant })
  } catch (err: unknown) {
    res.status((err as { status?: number }).status ?? 500).json({ error: (err as Error).message })
  }
}

// ── POST /api/chat/cancel-action ─────────────────────────────────────────────

export const cancelAction = async (req: Request, res: Response) => {
  try {
    const { userId } = await getUser(req)
    const { messageId } = req.body ?? {}
    if (!messageId) return res.status(400).json({ error: 'Falta messageId' })
    await chatSvc.resolvePendingAction(messageId, userId, { cancelled: true })
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status((err as { status?: number }).status ?? 500).json({ error: (err as Error).message })
  }
}

// ── GET /api/chat/history ────────────────────────────────────────────────────

export const getHistory = async (req: Request, res: Response) => {
  try {
    const { userId } = await getUser(req)
    const history = await chatSvc.getHistory(userId)
    res.json({ messages: history })
  } catch (err: unknown) {
    res.status((err as { status?: number }).status ?? 500).json({ error: (err as Error).message })
  }
}

// ── GET /api/chat/usage ───────────────────────────────────────────────────────

export const getUsage = async (req: Request, res: Response) => {
  try {
    const { userId } = await getUser(req)
    const sub = await getSubscriptionStatus(userId)
    const isTrial = sub.status === 'trial'
    const consultasUsed = isTrial ? await chatSvc.getConsultasUsed(userId) : 0

    const authorization = req.headers['authorization'] as string
    const evalLimit = await callHandler(ctrl.getEvaluationLimitStatus, authReq(authorization, {}))

    res.json({
      trial: isTrial,
      consultasUsed,
      consultasLimit: chatSvc.TRIAL_CONSULTAS_LIMIT,
      evaluaciones: evalLimit.body,
    })
  } catch (err: unknown) {
    res.status((err as { status?: number }).status ?? 500).json({ error: (err as Error).message })
  }
}
