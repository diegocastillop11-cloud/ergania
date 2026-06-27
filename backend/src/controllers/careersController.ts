import { Request, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import axios from 'axios'
import * as svc from '../services/careerOpsService'
import { supabaseAdmin } from '../config/supabase'

type LlmProvider = 'gemini' | 'groq' | 'anthropic' | 'openai'

type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string }

/** Wraps any OpenAI-compatible endpoint (Gemini, Groq, OpenAI) into the same interface as Anthropic SDK */
function makeOpenAiWrapper(apiKey: string, baseURL: string, model: string) {
  const client = new OpenAI({ apiKey, baseURL })
  return {
    messages: {
      create: async ({ system, messages, max_tokens }: { system?: string; messages: LlmMessage[]; max_tokens?: number; [key: string]: unknown }) => {
        const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
        if (system) chatMessages.push({ role: 'system', content: system })
        chatMessages.push(...messages.map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })))
        const response = await client.chat.completions.create({
          model,
          messages: chatMessages,
          max_tokens: max_tokens || 1000,
        })
        return {
          content: [{ type: 'text', text: response.choices?.[0]?.message?.content || '' }],
        }
      },
    },
  }
}

function normalizeProvider(raw?: string): LlmProvider {
  const value = (raw || process.env.DEFAULT_LLM_PROVIDER || 'gemini').toString().trim().toLowerCase()
  if (value === 'gemini') return 'gemini'
  if (value === 'anthropic' || value === 'claude') return 'anthropic'
  if (value === 'groq' || value === 'llama' || value === 'groq/llama') return 'groq'
  if (value === 'openai' || value === 'chatgpt') return 'openai'
  return 'gemini' // default: Gemini (tier gratuito, sin límites restrictivos)
}

function getProviderFromRequest(req: Request): LlmProvider {
  const rawBodyProvider = typeof req.body?.llmProvider === 'string' ? req.body.llmProvider : undefined
  const rawQueryProvider = typeof req.query.llmProvider === 'string' ? req.query.llmProvider : undefined
  return normalizeProvider(rawBodyProvider || rawQueryProvider)
}

function getLlmClient(req: Request) {
  const provider = getProviderFromRequest(req)
  // Accept user-provided API key from body (POST) OR query param (GET/SSE endpoints like /scan)
  const fromBody  = typeof req.body?.userApiKey === 'string' ? req.body.userApiKey.trim() : ''
  const fromQuery = typeof req.query.userApiKey === 'string' ? req.query.userApiKey.trim() : ''
  const userApiKey = fromBody || fromQuery
  return getClientForProvider(provider, userApiKey || undefined)
}

function getClientForProvider(provider: LlmProvider, userApiKey?: string) {
  if (provider === 'gemini') {
    const key = userApiKey || process.env.GEMINI_API_KEY
    if (!key) throw new Error('No hay API key de Gemini. Ingresa la tuya en "Mis API Keys" (gratis en aistudio.google.com).')
    // gemini-2.0-flash: modelo principal del tier gratuito de AI Studio (1500 req/día, 1M TPM)
    return makeOpenAiWrapper(key, 'https://generativelanguage.googleapis.com/v1beta/openai/', process.env.GEMINI_MODEL || 'gemini-2.0-flash')
  }

  if (provider === 'groq') {
    const key = userApiKey || process.env.GROQ_API_KEY
    if (!key) throw new Error('No hay API key de Groq. Ingresa la tuya en "Mis API Keys" (gratis en console.groq.com).')
    // llama-3.1-8b-instant: 20.000 TPM en tier gratuito (vs 6.000 del 70b)
    return makeOpenAiWrapper(key, 'https://api.groq.com/openai/v1', process.env.GROQ_MODEL || 'llama-3.1-8b-instant')
  }

  if (provider === 'anthropic') {
    const key = userApiKey || process.env.ANTHROPIC_API_KEY
    if (!key) throw new Error('No hay API key de Anthropic. Ingresa la tuya en "Mis API Keys".')
    return new Anthropic({ apiKey: key }) as unknown as ReturnType<typeof makeOpenAiWrapper>
  }

  if (provider === 'openai') {
    const key = userApiKey || process.env.OPENAI_API_KEY
    if (!key) throw new Error('No hay API key de OpenAI. Ingresa la tuya en "Mis API Keys" o cambia a Gemini/Groq (gratis).')
    return makeOpenAiWrapper(key, 'https://api.openai.com/v1', process.env.OPENAI_MODEL || 'gpt-4o-mini')
  }

  throw new Error(`Proveedor no reconocido: ${provider}`)
}

/** Convierte errores técnicos de IA en mensajes entendibles para el usuario */
function friendlyAiError(err: unknown, provider?: LlmProvider): string {
  const e = err as { status?: number; message?: string; error?: { message?: string }; headers?: Record<string, string> }
  const status = e?.status
  const msg = e?.message || ''
  const apiMsg = e?.error?.message || ''
  console.error('[AI Error]', { status, msg, apiMsg, provider })

  const providerName: Record<LlmProvider, string> = {
    gemini:    'Gemini',
    groq:      'Groq',
    anthropic: 'Claude',
    openai:    'OpenAI',
  }
  const activeProvider = provider ? providerName[provider] : 'la IA'

  // Alternativa gratuita sugerida según proveedor activo
  const freeAlternative = (!provider || provider === 'gemini')
    ? 'Groq (gratis en console.groq.com)'
    : 'Gemini (gratis en aistudio.google.com)'

  if (status === 401 || status === 403 || msg.includes('401') || msg.includes('403') || apiMsg.toLowerCase().includes('api key') || msg.toLowerCase().includes('authentication') || msg.toLowerCase().includes('invalid')) {
    return `API Key de ${activeProvider} inválida o sin permisos (${status ?? 'auth error'}). Verifica tu key en el Dashboard → Configuración de IA.`
  }
  if (status === 429 || msg.includes('429') || apiMsg.toLowerCase().includes('rate') || apiMsg.toLowerCase().includes('quota')) {
    const isTokenLimit   = apiMsg.toLowerCase().includes('token') || apiMsg.toLowerCase().includes('tpm')
    const isQuotaExceeded = apiMsg.toLowerCase().includes('quota') || apiMsg.toLowerCase().includes('exceeded') || apiMsg.toLowerCase().includes('billing')
    if (isQuotaExceeded) {
      return `Sin créditos en ${activeProvider}. Cambia a ${freeAlternative} en el Dashboard.`
    }
    if (isTokenLimit) {
      return `${activeProvider}: límite de tokens por minuto alcanzado. Espera 60 segundos y reintenta, o cambia a ${freeAlternative}.`
    }
    return `Límite de requests de ${activeProvider} alcanzado (${status ?? 429}). Espera 1 minuto y reintenta, o cambia a ${freeAlternative}.`
  }
  if (status === 400) {
    return `Error en la solicitud a ${activeProvider} (400).${apiMsg ? ` ${apiMsg}` : ' Puede ser un problema con el modelo o el formato.'}`
  }
  if (status === 404) {
    return `Modelo de ${activeProvider} no encontrado (404). Prueba cambiar a otro proveedor en el Dashboard.`
  }
  return apiMsg || msg || `Error desconocido al llamar a ${activeProvider}`
}



function stripYearExperiencePhrases(text: string): string {
  return text
    .replace(/\b(?:más de|more than)\s+\d+\+?\s*(?:años?|years?)\b/gi, '')
    .replace(/\b\d+\+?\s*(?:años?|years?)\s*(?:de experiencia|experience)?\b/gi, '')
    .replace(/\b(?:years? of experience|años? de experiencia)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Prueba mínima de conectividad con el proveedor de IA seleccionado */
export async function testAi(req: Request, res: Response) {
  const provider = getProviderFromRequest(req)
  const t0 = Date.now()
  try {
    const client = getLlmClient(req)
    const result = await client.messages.create({
      model: 'claude-haiku-4-5', // ignored by non-anthropic providers (they use their own model)
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Di solo la palabra OK' }],
    })
    const text = result.content?.[0]?.type === 'text' ? result.content[0].text : ''
    const ms = Date.now() - t0
    const modelMap: Record<LlmProvider, string> = {
      gemini:    process.env.GEMINI_MODEL    || 'gemini-2.0-flash',
      groq:      process.env.GROQ_MODEL      || 'llama-3.1-8b-instant',
      anthropic: 'claude-haiku-4-5',
      openai:    process.env.OPENAI_MODEL    || 'gpt-4o-mini',
    }
    res.json({ ok: true, provider, model: modelMap[provider], ms, response: text.trim() })
  } catch (err) {
    res.status(400).json({ ok: false, provider, error: friendlyAiError(err, provider) })
  }
}

/**
 * Extrae el email del usuario a partir del Bearer JWT de Supabase.
 * Acepta el token desde el header Authorization O desde el query param ?token=
 * (necesario para EventSource/SSE que no puede enviar headers personalizados).
 */
async function getUserEmail(req: Request): Promise<string> {
  const auth = req.headers['authorization']
  const tokenParam = typeof req.query.token === 'string' ? req.query.token : undefined
  const rawToken = auth?.startsWith('Bearer ') ? auth.slice(7) : tokenParam
  if (!rawToken) {
    console.warn('[Auth] Authorization token missing')
    throw new Error('Token de autenticación no encontrado. Inicia sesión de nuevo.')
  }

  if (!supabaseAdmin) {
    console.warn('[Auth] Supabase admin cliente no configurado')
    throw new Error('Supabase no está configurado en el servidor.')
  }

  const { data, error } = await supabaseAdmin.auth.getUser(rawToken)
  if (error || !data?.user?.email) {
    console.warn('[Auth] Token inválido o usuario no encontrado', { error: error?.message, email: data?.user?.email })
    throw new Error('Token de autenticación inválido o expirado. Inicia sesión de nuevo.')
  }

  return data.user.email
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export const getStats = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    res.json(await svc.getStats(userEmail))
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

// ── Tracker ───────────────────────────────────────────────────────────────────

export const getTracker = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    res.json(await svc.readTracker(userEmail))
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export const updateTrackerStatus = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const { id } = req.params
    const { estado, notas } = req.body
    await svc.updateTrackerEntry(id, { estado, notas }, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export const markApplied = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    await svc.updateTrackerEntry(req.params.id, { estado: 'Postulada' }, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export const deleteTrackerEntry = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    await svc.deleteTrackerEntry(req.params.id, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export const getPipeline = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    res.json(await svc.readPipeline(userEmail))
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export const addToPipeline = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const { url, source } = req.body
    if (!url) return res.status(400).json({ error: 'URL requerida' })
    await svc.addToPipeline(url, source, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export const removeFromPipeline = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    await svc.removeFromPipeline(req.body.url, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

// ── Portals ───────────────────────────────────────────────────────────────────

export const getPortals = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    res.json(await svc.readPortals(userEmail))
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export const updatePortals = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    await svc.writePortals(req.body, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

// ── Profile ───────────────────────────────────────────────────────────────────

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    res.json(await svc.readProfile(userEmail))
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    await svc.writeProfile(req.body, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

// ── CV ────────────────────────────────────────────────────────────────────────

export const getCV = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    res.json({ content: await svc.readCV(userEmail) })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export const updateCV = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    await svc.writeCV(req.body.content, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

// ── Reports ───────────────────────────────────────────────────────────────────

export const getReport = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const content = await svc.readReport(decodeURIComponent(req.params.slug), userEmail)
    res.json({ content })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export const listReports = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    res.json(await svc.listReports(userEmail))
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message }) }
}

// ── Evaluate ──────────────────────────────────────────────────────────────────

export const evaluateJob = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const { jd: jdRaw, url, empresa, rol } = req.body
    if (!jdRaw && !url) return res.status(400).json({ error: 'Se requiere el texto de la oferta (jd) o una URL' })

    // Intentar scrapear la URL si el JD está vacío o es solo una referencia corta
    let scrapedContent = ''
    if (url && (!jdRaw || jdRaw.length < 300)) {
      try {
        // Primero intenta con axios
        const { data: html } = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
            'Referer': 'https://www.google.com/',
            'Cache-Control': 'no-cache',
          },
          timeout: 12000,
        })
        scrapedContent = String(html)
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&[a-z#0-9]+;/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 6000)
      } catch (axiosErr) {
        const status = (axiosErr as { response?: { status?: number } })?.response?.status
        if (status === 403) {
          console.warn(`[Scraping] 403 Forbidden — ${url} bloquea acceso server-side`)
        }
        // Si axios falla, intenta con puppeteer-core para JavaScript rendering
        const blockedDomains = ['indeed.com', 'linkedin.com', 'computrabajo.com']
        if (blockedDomains.some(d => url.includes(d)) && scrapedContent.length < 200) {
          try {
            const puppeteer = require('puppeteer-core')
            // Intenta encontrar Chrome instalado en Windows
            const browserPaths = [
              'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
              'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
              process.env.CHROME_PATH,
            ].filter(Boolean)
            
            let browser: any = null
            for (const path of browserPaths) {
              try {
                if (path && require('fs').existsSync(path)) {
                  browser = await puppeteer.launch({ 
                    executablePath: path,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                  })
                  break
                }
              } catch {
                continue
              }
            }
            
            if (browser) {
              const page = await browser.newPage()
              await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 })
              const html = await page.content()
              await browser.close()
              
              scrapedContent = String(html)
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<!--[\s\S]*?-->/g, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&[a-z#0-9]+;/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 6000)
            }
          } catch (puppeteerErr) {
            console.log('[Scraping] Puppeteer fallback failed:', (puppeteerErr as Error).message)
            // continue con fallback
          }
        }
      }
    }

    const jd = scrapedContent.length > 200
      ? scrapedContent
      : (jdRaw || `Evalúa la oferta de trabajo disponible en: ${url}`)

    const cv      = await svc.readCV(userEmail)
    const profile = await svc.readProfile(userEmail) as Record<string, unknown>
    const sharedMode  = svc.readModeFile('_shared.md')
    const profileMode = svc.readModeFile('_profile.md')

    const candidate   = (profile.candidate   as Record<string, string>) || {}
    const compensation = (profile.compensation as Record<string, string>) || {}
    const targetRoles  = (profile.target_roles as Record<string, unknown>) || {}
    const narrative    = (profile.narrative    as Record<string, unknown>) || {}
    const location     = (profile.location     as Record<string, string>) || {}

    // Detectar si el contenido fue extraído exitosamente
    const hasContent = scrapedContent.length > 200
    const isShortfallUrl = url && !hasContent

    // Detectar proveedor para adaptar el prompt
    const provider = getProviderFromRequest(req)
    // Groq free tier: 6000 TPM máximo por request — necesitamos prompt compacto
    const isGroq = provider === 'groq'

    let systemPrompt: string
    let userMessage: string
    let maxTokens: number

    if (isGroq) {
      // ── Modo compacto para Groq (límite 6000 TPM en tier gratuito) ──────────
      // Input: ~1500 tokens | Output: ~1200 tokens | Total: ~2700 < 6000 ✓
      maxTokens = 1200
      systemPrompt = `Eres experto en ofertas laborales de Chile. Evalúa brevemente. Responde SOLO en español.
Candidato: ${candidate.full_name || 'Diego'} — ${(narrative.headline as string) || 'Analista de Datos'}
Roles objetivo: ${Object.values(targetRoles).flat().slice(0, 4).join(', ')}
Renta objetivo: ${compensation.target_range || '$1.800.000-$2.500.000 CLP'}
CV (resumen): ${cv.slice(0, 800)}`

      userMessage = `Oferta: ${empresa || ''} — ${rol || ''}${url ? ` (${url})` : ''}
JD: ${jd.slice(0, 1800)}

${isShortfallUrl ? `
⚠️ NOTA: El contenido de esta oferta fue limitado (la URL bloqueó acceso completo).
Extrae empresa y rol del URL o contexto. Haz tu mejor evaluación con lo disponible.
` : ''}

Responde con análisis breve Y este JSON al final:
\`\`\`json
{"empresa":"...","rol":"...","score":0.0,"remoto":"remoto/híbrido/presencial","seniority":"Junior/Mid/Senior","legitimidad":"Alta confianza/Proceder con cautela/Sospechosa","recomendacion":"POSTULAR/CONSIDERAR/DESCARTAR","salario_clp":"rango CLP","contrata_chile":true,"keywords":["kw1"]}
\`\`\``
    } else {
      // ── Modo completo para Gemini / Claude / OpenAI ────────────────────────
      maxTokens = 4000
      systemPrompt = `Eres un experto en búsqueda de trabajo en Chile y evaluación de ofertas laborales.

CONTEXTO DEL CANDIDATO:
- País: Chile (Santiago, Región Metropolitana)
- Moneda: Pesos Chilenos (CLP) — SIEMPRE usa CLP para salarios
- Idioma: Español — responde SIEMPRE en español

${sharedMode}
${profileMode}

CV DEL CANDIDATO:
${cv}

DATOS DEL PERFIL:
- Nombre: ${candidate.full_name || 'Diego Castillo Pineda'}
- Ubicación: ${candidate.location || 'La Florida, Santiago, Chile'}
- Roles objetivo: ${JSON.stringify(targetRoles)}
- Headline: ${(narrative.headline as string) || ''}
- Compensación objetivo: ${compensation.target_range || '$1.800.000 - $2.500.000 CLP mensual'}
- Mínimo: ${compensation.minimum || '$1.500.000 CLP mensual'}
- Modalidad: ${location.modalidad || 'Remoto o Híbrido en Santiago'}

REGLAS CRÍTICAS PARA CHILE:
1. TODOS los salarios se expresan en CLP (Pesos Chilenos) mensual bruto
2. Si la oferta no menciona salario, investiga rangos del mercado chileno para ese rol
3. Para ofertas en USD: convierte al cambio actual (~$950 CLP por USD) Y también muestra el USD
4. Prioriza roles: Remoto > Híbrido > Presencial Santiago
5. Evalúa si la empresa contrata en Chile (entity propia, contractor, EOR)
6. Si la oferta es en inglés, evalúa igual pero responde EN ESPAÑOL

RESPONDE SIEMPRE EN ESPAÑOL. Sé directo, concreto y útil. Sin frases genéricas.${isShortfallUrl ? `

⚠️ LIMITACIÓN: El contenido de esta oferta fue limitado (acceso de la URL bloqueado).
CRITICAL: Extrae empresa y rol del URL, headers, meta tags, o contexto disponible.
Haz tu mejor evaluación profesional con lo que tengas.` : ''}`

      userMessage = `Evalúa esta oferta de trabajo para el mercado chileno:

${url ? `URL: ${url}` : ''}
${empresa ? `Empresa: ${empresa}` : ''}
${rol ? `Rol: ${rol}` : ''}

---
${jd}
---

Entrega los 7 bloques completos (A-G) y al final incluye EXACTAMENTE este JSON:

\`\`\`json
{
  "empresa": "nombre empresa",
  "rol": "título del rol",
  "score": 0.0,
  "arquetipo": "tipo detectado",
  "remoto": "remoto/híbrido/presencial",
  "seniority": "Junior/Mid/Senior",
  "legitimidad": "Alta confianza/Proceder con cautela/Sospechosa",
  "recomendacion": "POSTULAR/CONSIDERAR/DESCARTAR",
  "salario_clp": "rango en CLP mensual",
  "salario_usd": "si aplica para trabajo remoto internacional",
  "contrata_chile": true,
  "keywords": ["kw1", "kw2"]
}
\`\`\``
    }

    const message = await getLlmClient(req).messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const fullText = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    let meta: Record<string, unknown> = {}
    // Intentar múltiples patrones de extracción de JSON para mayor robustez
    let jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/)
    if (!jsonMatch) {
      // Intenta sin ```json, solo ```
      jsonMatch = fullText.match(/```\s*({[\s\S]*?})\s*```/)
    }
    if (!jsonMatch) {
      // Intenta buscar un objeto JSON en el texto
      const jsonStart = fullText.indexOf('{')
      if (jsonStart !== -1) {
        try {
          meta = JSON.parse(fullText.substring(jsonStart))
        } catch {
          // continue
        }
      }
    } else if (jsonMatch[1]) {
      try {
        meta = JSON.parse(jsonMatch[1])
      } catch { /* ignore */ }
    }

    // Asegura que empresa y rol nunca sean completamente '—'
    const finalEmpresa = (meta.empresa as string)?.trim() || empresa || ''
    const finalRol = (meta.rol as string)?.trim() || rol || ''

    const today     = new Date().toISOString().split('T')[0]
    const compSlug  = (finalEmpresa || 'empresa')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const nextNum   = String((await svc.listReports(userEmail)).length + 1).padStart(3, '0')
    const reportSlug = `${nextNum}-${compSlug}-${today}.md`

    const reportContent = `# Evaluación: ${finalEmpresa || 'Oferta'} — ${finalRol || 'Posición'}

**Fecha:** ${today}
**URL:** ${url || '—'}
**Arquetipo:** ${meta.arquetipo || '—'}
**Score:** ${meta.score || '—'}/5
**Legitimidad:** ${meta.legitimidad || '—'}
**Salario CLP:** ${meta.salario_clp || '—'}
**Contrata en Chile:** ${meta.contrata_chile ? 'Sí' : 'No confirmado'}
**PDF:** pendiente

---

${fullText}
`
    await svc.saveReport(reportSlug, reportContent, userEmail)

    const entry = await svc.addTrackerEntry({
      fecha: today,
      empresa: finalEmpresa || 'Oferta sin identificar',
      rol: finalRol || 'Posición',
      score: meta.score ? Number(meta.score) : null,
      estado: 'Evaluada',
      pdf: false,
      reportSlug: `reports/${reportSlug}`,
      url: url || '',
      notas: (meta.recomendacion as string) || '',
    }, userEmail)

    if (url) await svc.removeFromPipeline(url, userEmail)

    res.json({ ok: true, entry, reportSlug, meta, report: reportContent })
  } catch (err: unknown) {
    console.error('evaluateJob error:', err)
    if (!res.headersSent) res.status(500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
  }
}

// ── Generate CV PDF (legado tracker) ─────────────────────────────────────────

export const generateCV = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const { entryId, empresa, rol } = req.body
    if (!empresa || !rol) return res.status(400).json({ error: 'empresa y rol son requeridos' })

    const cv = await svc.readCV(userEmail)
    const profile = await svc.readProfile(userEmail)

    const response = await getLlmClient(req).messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 6000,
      system: 'Eres experto en CVs para el mercado chileno. Genera HTML profesional con CSS embebido, sin dependencias externas, listo para imprimir en PDF.',
      messages: [{
        role: 'user',
        content: `Genera un CV en HTML para ${rol} en ${empresa}.\nCV actual:\n${cv}\nPerfil:\n${JSON.stringify(profile)}`,
      }],
    })

    const cvHtml = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    if (entryId) await svc.updateTrackerEntry(entryId, { pdf: false, estado: 'CV Generado' }, userEmail)
    res.json({ ok: true, cvHtml })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

// ── Postulaciones (Applications) ──────────────────────────────────────────────

export const listApplications = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    res.json(await svc.readApplications(userEmail))
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export const getApplicationById = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app) return res.status(404).json({ error: 'Postulación no encontrada' })
    res.json(app)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export const createApplication = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const { jd: jdRaw, empresa, rol, url, score, reportSlug } = req.body
    if (!empresa || !rol) return res.status(400).json({ error: 'empresa y rol son requeridos' })

    // Si viene reportSlug en lugar de JD, leer el reporte como contexto
    let jd = jdRaw
    if (!jd && reportSlug) {
      jd = await svc.readReport(reportSlug, userEmail) || `Evaluación de ${rol} en ${empresa}`
    }
    // Fallback: generar CV sin JD específica (basado solo en rol + empresa)
    if (!jd) jd = `Posición: ${rol} en ${empresa}. Adaptar el CV para este rol destacando las habilidades más relevantes del candidato.`

    const cv = await svc.readCV(userEmail)
    const profile = await svc.readProfile(userEmail)
    const cand = (profile?.candidate as Record<string, string>) || {}
    const cvInstructions = (profile as Record<string, unknown>)?.cv_instructions as string | undefined
    const contactInfo = {
      city: cand.location || '',
      phone: cand.phone || '',
      email: cand.email || userEmail,
      linkedin: cand.linkedin || '',
      github: cand.github || '',
    }

    // Una sola llamada → JSON estructurado → HTML + LaTeX se construyen en el servidor (ahorra tokens)
    const cvJsonPrompt = `Genera datos para un CV Harvard personalizado. Devuelve SOLO JSON válido, sin markdown.

CARGO: ${rol}
EMPRESA: ${empresa}

JD (extrae keywords ATS y úsalas literalmente en los bullets de experiencia):
${jd.slice(0, 2000)}

CV DEL CANDIDATO (incluye TODA la experiencia, no omitas ninguna empresa; incluye proyectos personales relevantes y experiencia con IA y desarrollo personal, aunque sea menor a un año):
${cv}

REGLAS:
- Resume y adapta el CV para pasar filtros ATS e IA. Prohibido mencionar años de experiencia, "X+ años", "años de experiencia", "más de 5 años" o "senior/junior" basado en tiempo. Usa logros, tecnologías y resultados.
- Resumen: 3-4 frases específicas para este rol/empresa. Menciona explícitamente el cargo objetivo y cómo tu experiencia se relaciona con ese rol. Incluye las habilidades clave del JD y un logro cuantificado. Sin frases genéricas.
- Experiencia: conecta cada experiencia relevante con el cargo objetivo, especialmente si es QA, control de calidad o testing manual. Incluye TODAS las empresas del CV. Mínimo 3 bullets por empresa reciente, 1 para HP.
- ATS: usa keywords exactas de la JD en los bullets y en el resumen cuando sea posible.
- Bullets: verbo de acción + tarea + resultado medible. Incluye métricas concretas cuando sea posible.
- Skills: ordena categorías por relevancia para la JD. Extrae y menciona al menos 3 habilidades clave del JD.
- Proyectos personales: agrega mínimo 1 proyecto personal destacado que muestre IA + React + base de datos + UI/UX, nómbralo y explica su impacto.
- Destaca experiencia con IA (Claude, Gemini, prompt engineering) y desarrollo de apps con bases de datos seguras, mantenimiento de datos y UI/UX.
- Si la JD pide Python o bases de datos, menciona esa habilidad claramente en algún bullet y en el resumen.
- No uses palabras vagas como "proactivo", "apasionado" o "dinámico".
${cvInstructions ? '\nINSTRUCCIONES PERSONALES DEL CANDIDATO (respétalas con prioridad máxima sobre las reglas anteriores):\n' + cvInstructions + '\n' : ''}
JSON exacto a retornar:
{"name":"${cand.full_name || ''}","contact":${JSON.stringify(contactInfo)},"summary":"...","experience":[{"company":"Punto Ticket","location":"Santiago, Chile","role":"Analista de Base de Datos Senior","dates":"Nov. 2019 – Feb. 2026","bullets":["..."]},{"company":"Imperial S.A.","location":"Santiago, Chile","role":"Analista Funcional","dates":"Jun. 2017 – Nov. 2019","bullets":["..."]},{"company":"OB GROUP PARK","location":"Santiago, Chile","role":"Analista de Sistemas y TI","dates":"Mayo 2014 – Abril 2017","bullets":["..."]},{"company":"Hewlett-Packard Company","location":"Santiago, Chile","role":"Agente de Mesa de Ayuda Nivel 1","dates":"Ago. 2013 – Mayo 2014","bullets":["..."]}],"projects":[{"name":"...","year":"2024","bullets":["..."]}],"skills":{"Datos & Cloud":"SQL Server (Experto), Azure SQL, Oracle, PostgreSQL, MongoDB, Microsoft Azure","Desarrollo & IA":"Python, C#, Node.js, Go, React, Prompt Engineering (Claude / Gemini)","Frontend & Diseño":"TypeScript, JavaScript (ES6+), HTML5/CSS3, UI/UX Design","Herramientas & Metodologías":"Git, Docker, Power BI, Excel Avanzado, Scrum/Kanban"},"education":[{"title":"Business Analytics & Data Science","institution":"Universidad de Chile","year":"2024"},{"title":"Especialización SQL Server","institution":"","year":"2023"},{"title":"Desarrollo de Apps Móviles","institution":"Universidad Complutense de Madrid","year":"2017"},{"title":"Analista Programador","institution":"INACAP","year":"2013"}]}`

    const response = await getLlmClient(req).messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      system: 'Eres un redactor experto en CVs Harvard ATS-optimizados para Chile. Retornas SOLO JSON válido, sin markdown, sin explicaciones.',
      messages: [{ role: 'user', content: cvJsonPrompt }],
    })

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim()

    let cvData: svc.CvData
    try {
      cvData = JSON.parse(rawText)
    } catch {
      throw new Error('Claude no devolvió JSON válido para el CV')
    }

    cvData.summary = stripYearExperiencePhrases(cvData.summary)
    cvData.experience = cvData.experience.map(exp => ({
      ...exp,
      bullets: exp.bullets.map(stripYearExperiencePhrases),
    }))
    cvData.projects = cvData.projects.map(proj => ({
      ...proj,
      bullets: proj.bullets.map(stripYearExperiencePhrases),
    }))

    const cvHtml = svc.buildCvHtml(cvData)
    const cvTex  = svc.buildCvLatex(cvData)

    // Generar carta de presentación
    const coverLetterPrompt = `Redacta una carta de presentación profesional en español para la siguiente postulación.
CANDIDATO: ${cand.full_name || 'Diego Castillo'}
EMPRESA: ${empresa}
CARGO: ${rol}
DESCRIPCIÓN DEL PUESTO (extracto): ${jd.slice(0, 1200)}
CV RESUMIDO: ${cv.slice(0, 1000)}

REGLAS:
- 3 párrafos breves: (1) presentación y motivación específica por la empresa, (2) por qué eres el candidato ideal usando 2-3 logros concretos del CV, (3) cierre con disponibilidad y llamado a acción
- Tono profesional pero cercano, no corporativo ni genérico
- Menciona el nombre de la empresa y el cargo en el primer párrafo
- NO uses frases como "proactivo", "apasionado", "trabajo en equipo" sin respaldo concreto
- Máximo 200 palabras
- Termina con: "Quedo disponible para conversar. Saludos, ${cand.full_name || 'Diego Castillo'}"`

    let coverLetter: string | undefined
    try {
      const clResult = await getLlmClient(req).messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 600,
        system: 'Eres experto en redacción de cartas de presentación para el mercado laboral chileno. Responde SOLO con el texto de la carta, sin encabezados extra ni explicaciones.',
        messages: [{ role: 'user', content: coverLetterPrompt }],
      })
      coverLetter = clResult.content
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { type: string; text: string }) => b.text)
        .join('')
        .trim()
    } catch (clErr) {
      console.error('Cover letter generation failed (non-fatal):', clErr)
    }

    const cvPdfFilename: string | undefined = undefined

    const existingApp = await svc.findApplicationByUrlOrRole(url, empresa, rol, userEmail)
    const id = existingApp?.id ?? await svc.getNextApplicationId(userEmail)
    const app: svc.Application = {
      id,
      fecha: existingApp?.fecha || new Date().toISOString().split('T')[0],
      empresa,
      rol,
      url: url || existingApp?.url || '',
      jd,
      cvHtml,
      cvTex,
      cvPdfFilename,
      estado: 'CV Generado',
      score: score ?? existingApp?.score ?? null,
      notas: existingApp?.notas || '',
      interviewPrep: existingApp?.interviewPrep,
      coverLetter,
    }
    await svc.saveApplication(app, userEmail)

    // Sync tracker: create entry or advance state to 'CV Generado'
    try {
      const tracker = await svc.readTracker(userEmail)
      const existing = url
        ? tracker.find(e => e.url === url)
        : tracker.find(e =>
            e.empresa.toLowerCase() === empresa.toLowerCase() &&
            e.rol.toLowerCase() === rol.toLowerCase()
          )
      if (existing) {
        if (existing.estado === 'Evaluada') {
          await svc.updateTrackerEntry(existing.id, { estado: 'CV Generado', pdf: !!cvPdfFilename }, userEmail)
        }
      } else {
        await svc.addTrackerEntry({
          fecha: app.fecha,
          empresa,
          rol,
          score: score ?? null,
          estado: 'CV Generado',
          pdf: !!cvPdfFilename,
          reportSlug: reportSlug || null,
          url: url || '',
          notas: '',
        }, userEmail)
      }
    } catch (trackerErr) {
      console.error('tracker sync failed (non-fatal):', trackerErr)
    }

    const { cvHtml: _html, ...appWithoutHtml } = app
    res.json({ ok: true, application: appWithoutHtml })
  } catch (err: unknown) {
    console.error('createApplication error:', err)
    if (!res.headersSent) res.status(500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
  }
}

export const regenerateCV = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app) return res.status(404).json({ error: 'Postulación no encontrada' })

    const cv = await svc.readCV(userEmail)
    const profile = await svc.readProfile(userEmail)
    const cand = (profile?.candidate as Record<string, string>) || {}
    const cvInstructions = (profile as Record<string, unknown>)?.cv_instructions as string | undefined
    const contactInfo = {
      city: cand.location || '',
      phone: cand.phone || '',
      email: cand.email || userEmail,
      linkedin: cand.linkedin || '',
      github: cand.github || '',
    }
    const { empresa, rol, jd } = app

    const cvJsonPrompt = `Genera datos para un CV Harvard personalizado. Devuelve SOLO JSON válido, sin markdown.

CARGO: ${rol}
EMPRESA: ${empresa}

JD (extrae keywords ATS y úsalas literalmente en los bullets de experiencia):
${(jd || '').slice(0, 2000)}

CV DEL CANDIDATO (incluye TODA la experiencia, no omitas ninguna empresa; incluye proyectos personales relevantes y experiencia con IA y desarrollo personal, aunque sea menor a un año):
${cv}

REGLAS:
- Resume y adapta el CV para pasar filtros ATS e IA. Prohibido mencionar años de experiencia, "X+ años", "años de experiencia", "más de 5 años" o "senior/junior" basado en tiempo. Usa logros, tecnologías y resultados.
- Resumen: 3-4 frases específicas para este rol/empresa. Menciona explícitamente el cargo objetivo y cómo tu experiencia se relaciona con ese rol. Incluye las habilidades clave del JD y un logro cuantificado. Sin frases genéricas.
- Experiencia: conecta cada experiencia relevante con el cargo objetivo, especialmente si es QA, control de calidad o testing manual. Incluye TODAS las empresas del CV. Mínimo 3 bullets por empresa reciente, 1 para HP.
- ATS: usa keywords exactas de la JD en los bullets y en el resumen cuando sea posible.
- Bullets: verbo de acción + tarea + resultado medible. Incluye métricas concretas cuando sea posible.
- Skills: ordena categorías por relevancia para la JD. Extrae y menciona al menos 3 habilidades clave del JD.
- Proyectos personales: agrega mínimo 1 proyecto personal destacado que muestre IA + React + base de datos + UI/UX, nómbralo y explica su impacto.
- Destaca experiencia con IA (Claude, Gemini, prompt engineering) y desarrollo de apps con bases de datos seguras, mantenimiento de datos y UI/UX.
- Si la JD pide Python o bases de datos, menciona esa habilidad claramente en algún bullet y en el resumen.
- No uses palabras vagas como "proactivo", "apasionado" o "dinámico".
${cvInstructions ? '\nINSTRUCCIONES PERSONALES DEL CANDIDATO (respétalas con prioridad máxima sobre las reglas anteriores):\n' + cvInstructions + '\n' : ''}
JSON exacto a retornar:
{"name":"${cand.full_name || ''}","contact":${JSON.stringify(contactInfo)},"summary":"...","experience":[{"company":"Punto Ticket","location":"Santiago, Chile","role":"Analista de Base de Datos Senior","dates":"Nov. 2019 – Feb. 2026","bullets":["..."]},{"company":"Imperial S.A.","location":"Santiago, Chile","role":"Analista Funcional","dates":"Jun. 2017 – Nov. 2019","bullets":["..."]},{"company":"OB GROUP PARK","location":"Santiago, Chile","role":"Analista de Sistemas y TI","dates":"Mayo 2014 – Abril 2017","bullets":["..."]},{"company":"Hewlett-Packard Company","location":"Santiago, Chile","role":"Agente de Mesa de Ayuda Nivel 1","dates":"Ago. 2013 – Mayo 2014","bullets":["..."]}],"projects":[{"name":"...","year":"2024","bullets":["..."]}],"skills":{"Datos & Cloud":"SQL Server (Experto), Azure SQL, Oracle, PostgreSQL, MongoDB, Microsoft Azure","Desarrollo & IA":"Python, C#, Node.js, Go, React, Prompt Engineering (Claude / Gemini)","Frontend & Diseño":"TypeScript, JavaScript (ES6+), HTML5/CSS3, UI/UX Design","Herramientas & Metodologías":"Git, Docker, Power BI, Excel Avanzado, Scrum/Kanban"},"education":[{"title":"Business Analytics & Data Science","institution":"Universidad de Chile","year":"2024"},{"title":"Especialización SQL Server","institution":"","year":"2023"},{"title":"Desarrollo de Apps Móviles","institution":"Universidad Complutense de Madrid","year":"2017"},{"title":"Analista Programador","institution":"INACAP","year":"2013"}]}`

    const response = await getLlmClient(req).messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      system: 'Eres un redactor experto en CVs Harvard ATS-optimizados para Chile. Retornas SOLO JSON válido, sin markdown, sin explicaciones.',
      messages: [{ role: 'user', content: cvJsonPrompt }],
    })

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim()

    let cvData: svc.CvData
    try { cvData = JSON.parse(rawText) }
    catch { throw new Error('Claude no devolvió JSON válido') }

    cvData.summary = stripYearExperiencePhrases(cvData.summary)
    cvData.experience = cvData.experience.map(exp => ({
      ...exp,
      bullets: exp.bullets.map(stripYearExperiencePhrases),
    }))
    cvData.projects = cvData.projects.map(proj => ({
      ...proj,
      bullets: proj.bullets.map(stripYearExperiencePhrases),
    }))

    const cvHtml = svc.buildCvHtml(cvData)
    const cvTex  = svc.buildCvLatex(cvData)

    app.cvHtml = cvHtml
    app.cvTex  = cvTex
    app.cvPdfFilename = undefined
    await svc.saveApplication(app, userEmail)

    const { cvHtml: _h, ...appWithoutHtml } = app
    res.json({ ok: true, application: appWithoutHtml })
  } catch (err: unknown) {
    console.error('regenerateCV error:', err)
    if (!res.headersSent) res.status(500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
  }
}

export const generateInterviewPrep = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app) return res.status(404).json({ error: 'Postulación no encontrada' })

    const cv = await svc.readCV(userEmail)
    const profile = await svc.readProfile(userEmail)

    const response = await getLlmClient(req).messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
      system: `Eres un coach de carrera experto en el mercado laboral chileno.
Preparas candidatos para entrevistas de forma práctica.
Actúa como reclutador senior: evalúa el CV con ojo crítico y señala qué está débil, qué falta y qué te haría rechazarlo.
Si el candidato no tiene experiencia directa, ofrece estrategias para manejar esas preguntas con confianza y honestidad positiva.`,
      messages: [{
        role: 'user',
        content: `Prepara al candidato para entrevista en ${app.empresa} — cargo: ${app.rol}

JOB DESCRIPTION:
${app.jd}

CV:
${cv}

PERFIL: ${JSON.stringify(profile, null, 2)}

Genera guía completa con estas secciones en markdown:

## 1. TOP 10 PREGUNTAS PROBABLES
Para cada una: pregunta → respuesta sugerida basada en el CV → tip de delivery

## 2. PREGUNTAS TÉCNICAS DEL ROL
5 preguntas técnicas de ${app.rol} con cómo abordarlas

## 3. MANEJO DE BRECHAS DE EXPERIENCIA
Frases y estrategias concretas para responder cuando no tienes algo que piden

## 4. PREGUNTAS PARA HACERLES A ELLOS
5 preguntas inteligentes que muestren interés en ${app.empresa}

## 5. FODA
Incluye fortalezas, oportunidades, debilidades y amenazas del candidato frente a este rol.

## 6. FEEDBACK DEL RECLUTADOR SENIOR
Di qué te haría rechazar este CV y qué mejorarías para que pase filtros ATS/IA.

## 7. CHECKLIST PRE-ENTREVISTA
Lista verificación para el día antes y el día de la entrevista`,
      }],
    })

    const prep = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    app.interviewPrep = prep
    app.estado = 'Preparado'
    await svc.saveApplication(app, userEmail)

    res.json({ ok: true, prep })
  } catch (err: unknown) {
    if (!res.headersSent) res.status(500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
  }
}

export const answerQuestion = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const { question } = req.body
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app) return res.status(404).json({ error: 'Postulación no encontrada' })
    if (!question?.trim()) return res.status(400).json({ error: 'question es requerido' })

    const cv = await svc.readCV(userEmail)

    const response = await getLlmClient(req).messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: `Eres experto en postulaciones laborales chilenas. Respondes preguntas de formularios de forma breve, directa y humana.
REGLAS: máximo 3 frases (60-70 palabras). Sin relleno, sin frases genéricas tipo "apasionado" o "proactivo". Primera persona. Español chileno profesional. Nunca menciones falta de experiencia.`,
      messages: [{
        role: 'user',
        content: `Empresa: ${app.empresa} | Cargo: ${app.rol}

PREGUNTA: "${question}"

EXTRACTO CV:
${(cv || '').slice(0, 800)}

JD (contexto):
${(app.jd || '').slice(0, 600)}

Escribe SOLO la respuesta (3 frases máx, 60-70 palabras):`,
      }],
    })

    const answer = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    res.json({ ok: true, answer })
  } catch (err: unknown) {
    if (!res.headersSent) res.status(500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
  }
}

export const generateCoverLetter = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app) return res.status(404).json({ error: 'Postulación no encontrada' })

    const cv = await svc.readCV(userEmail)
    const profile = await svc.readProfile(userEmail)
    const cand = (profile?.candidate as Record<string, string>) || {}
    const name = cand.full_name || 'Diego Castillo'

    const prompt = `Redacta una carta de presentación profesional en español para la siguiente postulación.
CANDIDATO: ${name}
EMPRESA: ${app.empresa}
CARGO: ${app.rol}
DESCRIPCIÓN DEL PUESTO (extracto): ${(app.jd || '').slice(0, 1200)}
CV RESUMIDO: ${(cv || '').slice(0, 1000)}

REGLAS:
- Tono profesional y directo, sin exageraciones
- Menciona el nombre de la empresa y el cargo en el primer párrafo
- NO uses frases como "proactivo", "apasionado", "trabajo en equipo" sin respaldo concreto
- Máximo 200 palabras
- Termina con: "Quedo disponible para conversar. Saludos, ${name}"`

    const response = await getLlmClient(req).messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      system: 'Eres experto en redacción de cartas de presentación para el mercado laboral chileno. Responde SOLO con el texto de la carta, sin encabezados extra ni explicaciones.',
      messages: [{ role: 'user', content: prompt }],
    })

    const coverLetter = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    try {
      await svc.patchCoverLetter(req.params.id, coverLetter, userEmail)
    } catch {
      // La columna coverLetter puede no existir aún en Supabase — se retorna igualmente
    }

    res.json({ ok: true, coverLetter })
  } catch (err: unknown) {
    if (!res.headersSent) res.status(500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
  }
}

export const generateApplyKit = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app) return res.status(404).json({ error: 'Postulación no encontrada' })

    const cv = await svc.readCV(userEmail)
    const profile = await svc.readProfile(userEmail)

    let pageContent = app.jd || ''
    if (app.url) {
      try {
        const { data } = await axios.get(app.url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
            'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
          },
        })
        // Strip HTML tags and get plain text
        const plain = (data as string).replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (plain.length > 200) pageContent = plain.slice(0, 4000)
      } catch {
        // fallback to JD
      }
    }

    const response = await getLlmClient(req).messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 3000,
      system: `Eres experto en postulaciones laborales para Chile. Detectas preguntas reales de formularios web y redactas respuestas cortas, precisas y convincentes. El reclutador lee en 10 segundos.`,
      messages: [{
        role: 'user',
        content: `Analiza esta página de postulación para ${app.rol} en ${app.empresa} y genera respuestas.

CONTENIDO DE LA PÁGINA:
${pageContent.slice(0, 3000)}

CV DEL CANDIDATO:
${cv.slice(0, 1200)}

TAREA:
1. Si detectas preguntas REALES del formulario (labels, placeholders, campos de texto), úsalas.
2. Si no hay formulario visible, usa las preguntas más probables para este cargo en Chile.
3. Genera respuesta concreta para cada pregunta.

Retorna SOLO JSON (sin markdown):
{"formulario_detectado":true,"preguntas":[{"pregunta":"texto exacto de la pregunta","respuesta":"respuesta 50-80 palabras","tip":"1 frase práctica"}]}

REGLAS:
- 50-80 palabras por respuesta (2-3 oraciones). Directo al punto.
- Primera persona. Verbo de acción. Número real del CV cuando aplica.
- PROHIBIDO: "soy una persona...", "me considero...", "me apasiona...".
- Incluye SIEMPRE: motivación por ${app.empresa}, fortaleza clave para el cargo, disponibilidad de inicio, expectativa de renta (rango CLP).
- Si la JD menciona preguntas específicas, agrégalas.`,
      }],
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    let kit: { formulario_detectado?: boolean; preguntas: Array<{ pregunta: string; respuesta: string; tip?: string }> } = { preguntas: [] }
    if (jsonMatch) {
      try { kit = JSON.parse(jsonMatch[0]) } catch { /* leave empty */ }
    }

    res.json({ ok: true, kit, formulario_detectado: kit.formulario_detectado ?? false })
  } catch (err: unknown) {
    if (!res.headersSent) res.status(500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
  }
}

export const updateApplicationStatus = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app) return res.status(404).json({ error: 'Postulación no encontrada' })
    const { estado, notas } = req.body
    if (estado) app.estado = estado
    if (notas !== undefined) app.notas = notas
    await svc.saveApplication(app, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export const downloadApplicationPdf = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app?.cvHtml) return res.status(404).json({ error: 'CV no disponible para este postulación' })

    const profile = await svc.readProfile(userEmail)
    const candidateName = ((profile?.candidate as Record<string, string>)?.full_name || '').replace(/\s+/g, '_')

    const { buffer, filename } = await svc.generatePDFFromHtml(app.cvHtml, app.empresa, app.rol, candidateName)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export const downloadInterviewPrepPdf = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app?.interviewPrep) return res.status(404).json({ error: 'Prep. de entrevista no disponible' })

    const html = svc.buildInterviewPrepHtml(app.interviewPrep, app.empresa, app.rol)
    const { buffer, filename } = await svc.generatePDFFromHtml(html, app.empresa, app.rol, '', 'InterviewPrep')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

// ── Optimizador de perfil LinkedIn ───────────────────────────────────────────

export const linkedinOptimize = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const cv      = await svc.readCV(userEmail)
    const profile = await svc.readProfile(userEmail) as Record<string, unknown>
    const cand    = (profile.candidate as Record<string, string>) || {}
    const targetRoles = (profile.target_roles as Record<string, unknown>) || {}
    const narrative   = (profile.narrative   as Record<string, unknown>) || {}

    const rolesStr = [
      ...((targetRoles.primary as string[]) || []),
      ...((targetRoles.archetypes as Array<{ name: string }>) || []).map(a => a.name),
    ].filter(Boolean).slice(0, 8).join(', ')

    const prompt = `Eres un experto en LinkedIn y búsqueda de empleo en Chile. Optimiza el perfil de LinkedIn del candidato para que aparezca en búsquedas de reclutadores y pase filtros ATS de LinkedIn.

CANDIDATO: ${cand.full_name || 'Diego Castillo'}
UBICACIÓN: ${cand.location || 'Santiago, Chile'}
ROLES OBJETIVO (varios simultáneos): ${rolesStr || 'Data Analyst, Product Owner, Desarrollador'}
HEADLINE ACTUAL: ${(narrative.headline as string) || ''}

CV COMPLETO:
${cv.slice(0, 3000)}

CONTEXTO IMPORTANTE: El candidato postula a múltiples rubros simultáneamente (datos, producto, desarrollo). Necesita un perfil que lo posicione como un profesional versátil con capacidad técnica + visión de producto, sin ser ambiguo. Tiene experiencia técnica real (SQL, Azure, automatización) pero también conocimiento de metodologías ágiles y gestión de proyectos. Algunos roles que busca (como PO) no los ha ejercido formalmente, pero sí tiene las habilidades de base.

Genera las siguientes secciones del perfil LinkedIn optimizadas. Devuelve JSON exacto (sin markdown):

{
  "headline": "titular LinkedIn (máx 220 chars) — que incluya 2-3 roles/skills clave separados por | · Ej: Data Analyst | SQL Server & Azure | Automatización & BI",
  "about": "sección Acerca de completa (300-400 palabras). Debe: (1) primer párrafo: qué haces y qué valor aportas, (2) segundo: experiencia técnica concreta con métricas, (3) tercero: proyectos personales / iniciativa / IA, (4) cuarto: qué tipo de roles buscas y por qué. Cierra con contacto. Tono profesional-cercano, sin buzzwords vacíos.",
  "skills": ["skill1", "skill2", ...20 skills ordenadas por relevancia para los roles objetivo],
  "experience_tips": [
    {"empresa": "nombre empresa del CV", "sugerencia": "cómo escribir el título y bullets de esta experiencia en LinkedIn para que aparezca en búsquedas de reclutadores"}
  ],
  "featured_ideas": ["idea de contenido destacado 1", "idea 2", "idea 3"],
  "open_to_work": "texto recomendado para la sección Open to Work (qué roles, modalidad, disponibilidad)",
  "keywords_to_include": ["keyword1", "keyword2", ...15 keywords que reclutadores chilenos buscan actualmente para estos roles"]
}`

    const response = await getLlmClient(req).messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 3000,
      system: 'Eres un experto en LinkedIn y personal branding para el mercado laboral chileno. Retornas SOLO JSON válido, sin markdown.',
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim()

    let result: Record<string, unknown> = {}
    try { result = JSON.parse(rawText) } catch {
      // intentar extraer JSON con regex si viene con texto extra
      const match = rawText.match(/\{[\s\S]*\}/)
      if (match) { try { result = JSON.parse(match[0]) } catch { /* empty */ } }
    }

    res.json({ ok: true, result })
  } catch (err: unknown) {
    const provider = getProviderFromRequest(req)
    const errMsg = (err as Error)?.message || String(err)
    console.error('[linkedinOptimize] ERROR:', errMsg, { provider, stack: (err as Error)?.stack })
    if (!res.headersSent) {
      const friendly = friendlyAiError(err, provider)
      res.status(500).json({ error: friendly || errMsg })
    }
  }
}

// ── Sugerir targets de búsqueda ───────────────────────────────────────────────

export const suggestTargets = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const cv      = await svc.readCV(userEmail)
    const profile = await svc.readProfile(userEmail) as Record<string, unknown>
    const portals = await svc.readPortals(userEmail)
    const currentRoles    = ((profile.target_roles as Record<string, string[]>)?.primary || []).join(', ')
    const currentKeywords = (portals.title_filter?.positive || []).join(', ')

    const response = await getLlmClient(req).messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      system: 'Eres un experto en búsqueda de empleo en Chile. Analizas CVs y sugieres los mejores cargos y keywords para encontrar más oportunidades.',
      messages: [{
        role: 'user',
        content: `Analiza este CV y sugiere cargos objetivo y keywords de búsqueda para el mercado chileno.

CV:
${cv.slice(0, 2000)}

Cargos actuales del candidato: ${currentRoles || 'ninguno configurado'}
Keywords actuales: ${currentKeywords || 'ninguna configurada'}

Retorna SOLO JSON (sin markdown):
{
  "roles": ["cargo1", "cargo2", ...],
  "keywords_positivas": ["keyword1", "keyword2", ...],
  "keywords_negativas": ["excluir1", "excluir2", ...],
  "queries": [
    {"nombre": "nombre descriptivo", "query": "consulta de búsqueda para Google/portal", "habilitada": true}
  ],
  "razon": "breve explicación de por qué estos roles son ideales (1-2 frases)"
}

REGLAS:
- 8-12 roles variados: algunos exactos (Analista SQL), otros amplios (Data Analyst), algunos en inglés para empresas internacionales
- 10-15 keywords tecnológicas del CV + variaciones (SQL Server → SQL, MSSQL, T-SQL)
- 5-8 keywords negativas para evitar roles no deseados (call center, ventas, soporte L1 básico)
- 5-6 queries: mezcla de rol + tecnología + "Chile" o "remoto"
- Todo en español chileno profesional`,
      }],
    })

    const text = response.content.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('')
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    let suggestions: Record<string, unknown> = {}
    if (jsonMatch) { try { suggestions = JSON.parse(jsonMatch[0]) } catch { /* empty */ } }

    res.json({ ok: true, suggestions })
  } catch (err: unknown) {
    if (!res.headersSent) res.status(500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
  }
}

// ── Backup / Restore ─────────────────────────────────────────────────────────

export const exportBackup = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const backup = {
      version: 2,
      exported_at: new Date().toISOString(),
      profile: await svc.readProfile(userEmail),
      portals: await svc.readPortals(userEmail),
      cv: await svc.readCV(userEmail),
      tracker: await svc.readTracker(userEmail),
      pipeline: await svc.readPipeline(userEmail),
      applications: await svc.readApplications(userEmail),
      reports: await (async () => {
        const slugs = await svc.listReports(userEmail)
        const result: Record<string, string> = {}
        for (const slug of slugs) {
          result[slug] = await svc.readReport(slug, userEmail)
        }
        return result
      })(),
    }
    const filename = `career-ops-backup-${new Date().toISOString().split('T')[0]}.json`
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', 'application/json')
    res.json(backup)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export const importBackup = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const b = req.body
    if (!b || b.version < 2) return res.status(400).json({ error: 'Formato de backup inválido' })
    if (b.profile)  await svc.writeProfile(b.profile, userEmail)
    if (b.portals)  await svc.writePortals(b.portals, userEmail)
    if (b.cv)       await svc.writeCV(b.cv, userEmail)
    if (b.reports)  await Promise.all(Object.entries(b.reports as Record<string, string>).map(([slug, content]) => svc.saveReport(slug, content, userEmail)))
    // Pipeline: re-add from backup
    if (Array.isArray(b.pipeline)) {
      for (const job of b.pipeline as { url: string; source?: string }[]) {
        await svc.addToPipeline(job.url, job.source, userEmail)
      }
    }
    res.json({ ok: true, message: 'Backup restaurado correctamente' })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

// ── Scanner helpers ───────────────────────────────────────────────────────────

interface JobResult {
  titulo: string; empresa: string; url: string
  ubicacion: string; match_score: number; razon: string
}

// Elimina preposiciones y artículos para comparar frases en español sin "de", "el", etc.
function compactPhrase(phrase: string): string {
  const stopwords = new Set(['de', 'del', 'el', 'la', 'los', 'las', 'en', 'a', 'para', 'y', 'e', 'o'])
  return phrase.toLowerCase().split(/\s+/)
    .filter(w => w.length > 1 && !stopwords.has(w))
    .join(' ')
}

function kwMatch(title: string, positive: string[], negative: string[]): boolean {
  const t = title.toLowerCase()
  if (negative.some(k => t.includes(k.toLowerCase()))) return false
  if (positive.length === 0) return true

  // 1. Exact phrase match (más preciso — "SQL Server" en el título)
  if (positive.some(k => t.includes(k.toLowerCase()))) return true

  // 2. Compact match: frases multi-palabra sin preposiciones
  //    Permite que "Analista de Datos" pille "Analista Datos E Inteligencia De Negocios"
  //    pero NO "Analista Contable" ni "Analista de Cobranzas"
  const tCompact = compactPhrase(t)
  return positive
    .filter(k => k.trim().split(/\s+/).length >= 2) // solo frases de 2+ palabras
    .some(k => {
      const kc = compactPhrase(k)
      return kc.length >= 5 && tCompact.includes(kc)
    })
}

function kwScore(title: string, positive: string[]): number {
  if (!title || positive.length === 0) return 0.5
  const t = title.toLowerCase()
  const hits = positive.filter(k => t.includes(k.toLowerCase())).length
  return Math.min(0.4 + (hits / positive.length) * 0.6, 1)
}

function buildSearchUrl(baseUrl: string, query: string): string {
  const domain = new URL(baseUrl).hostname
  const enc    = encodeURIComponent(query)
  const dash   = query.toLowerCase().replace(/[^a-záéíóúñü0-9]+/g, '-').replace(/^-|-$/g, '')
  if (domain.includes('computrabajo.com')) return `https://cl.computrabajo.com/trabajo-de-${dash}`
  if (domain.includes('indeed.com'))       return `https://cl.indeed.com/jobs?q=${enc}&l=Chile&sort=date`
  return `${baseUrl}?q=${enc}`
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Computrabajo: parse js-o-link anchors directly from HTML
function parseComputrabajo(html: string, baseScore: (t: string) => number, positive: string[], negative: string[], razon: string): JobResult[] {
  const results: JobResult[] = []
  const titleRe = /class="js-o-link[^"]*"\s+href="(\/ofertas-de-trabajo[^"]+)"[^>]*>\s*([\s\S]*?)\s*</g
  const compRe  = /offer-grid-article-company-url[^>]*>\s*([\s\S]*?)\s*</g
  const companies: string[] = []
  let cm: RegExpExecArray | null
  while ((cm = compRe.exec(html)) !== null) companies.push(cm[1].replace(/&#x[0-9A-F]+;/gi, c => String.fromCharCode(parseInt(c.slice(3,-1),16))).trim())
  let i = 0; let tm: RegExpExecArray | null
  while ((tm = titleRe.exec(html)) !== null) {
    const rawTitle = tm[2].replace(/&#x([0-9A-F]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim()
    if (!rawTitle || !kwMatch(rawTitle, positive, negative)) { i++; continue }
    results.push({
      titulo: rawTitle,
      empresa: companies[i] || '—',
      url: `https://cl.computrabajo.com${tm[1].split('#')[0]}`,
      ubicacion: 'Chile',
      match_score: baseScore(rawTitle),
      razon,
    })
    i++
  }
  return results
}

// Indeed Chile: parse jobTitle + companyName + data-jk from HTML
function parseIndeed(html: string, baseScore: (t: string) => number, positive: string[], negative: string[], razon: string): JobResult[] {
  const results: JobResult[] = []
  const titleMatches = [...html.matchAll(/class="[^"]*jobTitle[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).filter(t => t.length > 2)
  const compMatches  = [...html.matchAll(/class="[^"]*companyName[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
  const jkMatches    = [...html.matchAll(/data-jk="([a-f0-9]+)"/gi)].map(m => m[1])
  const locMatches   = [...html.matchAll(/class="[^"]*companyLocation[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
  const seen = new Set<string>()
  for (let i = 0; i < titleMatches.length; i++) {
    const title = titleMatches[i]
    if (!title || seen.has(title.toLowerCase()) || !kwMatch(title, positive, negative)) continue
    seen.add(title.toLowerCase())
    const jk  = jkMatches[i]
    results.push({
      titulo: title,
      empresa: compMatches[i] || '—',
      url: jk ? `https://cl.indeed.com/viewjob?jk=${jk}` : 'https://cl.indeed.com',
      ubicacion: locMatches[i] || 'Chile',
      match_score: baseScore(title),
      razon,
    })
  }
  return results
}

// Parser genérico para SPAs cargadas con Chrome: busca anchors con texto de cargo
function parseSpaPortal(html: string, baseScore: (t: string) => number, positive: string[], negative: string[], razon: string, siteBase: string): JobResult[] {
  const results: JobResult[] = []
  const seen = new Set<string>()

  // Busca todos los anchors con texto que parezca un título de trabajo
  const linkRe = /href="([^"#?]{5,200})"[^>]*>([\s\S]{0,300}?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1]
    const inner = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    // Filtrar: longitud razonable de título, no es navegación ni botones
    if (!inner || inner.length < 6 || inner.length > 100) continue
    if (/^(ver|more|login|sign|inicia|registra|busca|home|inicio|menu|acerca|contacto|ayuda|privacy|términos)/i.test(inner)) continue
    if (seen.has(inner.toLowerCase())) continue
    if (!kwMatch(inner, positive, negative)) continue
    seen.add(inner.toLowerCase())
    const url = href.startsWith('http') ? href : `${siteBase}${href.startsWith('/') ? '' : '/'}${href}`
    results.push({ titulo: inner, empresa: '—', url, ubicacion: 'Chile', match_score: baseScore(inner), razon })
  }
  return results
}

function dedup(jobs: JobResult[]): JobResult[] {
  const seen = new Set<string>()
  return jobs.filter(j => {
    const k = j.titulo.toLowerCase().trim()
    if (seen.has(k)) return false
    seen.add(k); return true
  })
}

// Rutas comunes de Chrome en Windows/Mac/Linux
const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
]

function findChrome(): string | undefined {
  const fs = require('fs')
  return CHROME_PATHS.find(p => { try { return fs.existsSync(p) } catch { return false } })
}

/**
 * Carga una página SPA con Chrome headless y devuelve el HTML completo.
 * Usado para portales que renderizan con JavaScript (Trabajando, YWork, etc.)
 */
async function scrapeWithBrowser(url: string, waitMs = 3000): Promise<string> {
  const executablePath = findChrome()
  if (!executablePath) throw new Error('Chrome no encontrado en el sistema')

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const puppeteer = require('puppeteer-core')
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    timeout: 30000,
  })
  try {
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36')
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    // Espera a que aparezcan los resultados (el JS carga los jobs)
    await new Promise(r => setTimeout(r, waitMs))
    return await page.content()
  } finally {
    await browser.close()
  }
}

// Bumeran / Laborum: parsea HTML server-rendered (formato SEO con URLs /empleo-*.html)
function parseBumeranLaborum(html: string, baseScore: (t: string) => number, positive: string[], negative: string[], razon: string, siteBase: string): JobResult[] {
  const results: JobResult[] = []
  const seen = new Set<string>()

  // Extrae pares (href, title) de anchors que apuntan a páginas de empleo
  // Bumeran/Laborum usan /empleo-slug.html y título como texto del link o en h2/h3 cercano
  const linkRe = /href="((?:https?:\/\/(?:www\.)?(?:bumeran|laborum)\.cl)?\/empleo[^"#?]+\.html)"[^>]*>\s*([\s\S]{0,200}?)\s*<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1]
    const inner = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    // El título debe ser razonablemente corto (un nombre de cargo, no un bloque de HTML)
    if (!inner || inner.length < 5 || inner.length > 120) continue
    if (seen.has(inner.toLowerCase())) continue
    if (!kwMatch(inner, positive, negative)) continue
    seen.add(inner.toLowerCase())
    const url = href.startsWith('http') ? href : `${siteBase}${href}`
    results.push({ titulo: inner, empresa: '—', url, ubicacion: 'Chile', match_score: baseScore(inner), razon })
  }

  // Fallback: busca títulos en elementos con clases típicas de Bumeran (js-title-aviso, titulo-aviso, etc.)
  if (results.length === 0) {
    const titleRe = /class="[^"]*(?:titulo|title|aviso)[^"]*"[^>]*>\s*<a[^>]+href="(\/empleo[^"]+)"[^>]*>([^<]{5,100})<\/a>/gi
    while ((m = titleRe.exec(html)) !== null) {
      const titulo = m[2].trim()
      const href   = m[1]
      if (!titulo || seen.has(titulo.toLowerCase())) continue
      if (!kwMatch(titulo, positive, negative)) continue
      seen.add(titulo.toLowerCase())
      results.push({ titulo, empresa: '—', url: `${siteBase}${href}`, ubicacion: 'Chile', match_score: baseScore(titulo), razon })
    }
  }

  return results
}

// ── Scanner con SSE ───────────────────────────────────────────────────────────

export const scanPortals = async (req: Request, res: Response) => {
  const _req = req
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  const send = (event: string, data: unknown) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  try {
    const userEmail = await getUserEmail(req)
    const portalsConfig = await svc.readPortals(userEmail)
    const profile       = await svc.readProfile(userEmail) as Record<string, unknown>
    const positive      = portalsConfig.title_filter?.positive || []
    const negative      = portalsConfig.title_filter?.negative || []
    const targetRoles   = (profile.target_roles as Record<string, string[]>) || {}
    const roleQueries   = [...(targetRoles.primary || []), ...(targetRoles.secondary || [])].slice(0, 6)
    // Only use cfg queries that are NOT Google site: syntax for portal searches
    const cfgQueries    = (portalsConfig.search_queries || [])
      .filter(q => q.enabled && !q.query.includes('site:'))
      .map(q => q.query).slice(0, 3)
    const queries       = [...new Set([...roleQueries, ...cfgQueries])].slice(0, 8)

    // Sin nada configurado → aviso temprano
    if (queries.length === 0 && positive.length === 0) {
      send('error', { error: 'No hay cargos objetivo ni keywords configurados. Ve a "Mi Búsqueda" para configurarlos primero.' })
      return
    }

    // FIX 1: Limpiar pipeline anterior (solo jobs del escáner, no manuales)
    // Así cada escaneo refleja resultados frescos
    await svc.clearScannerPipeline(userEmail)

    // FIX 3: Obtener URLs ya postuladas y evaluadas para omitirlas del pipeline
    const [applications, tracker] = await Promise.all([
      svc.readApplications(userEmail),
      svc.readTracker(userEmail),
    ])
    const skipUrls = new Set<string>([
      ...applications.map(a => a.url).filter(Boolean) as string[],
      ...tracker.map(t => t.url).filter(Boolean) as string[],
    ])

    // For portal searches use only clean role queries (no site: syntax)
    const portalQueries = roleQueries.length > 0 ? roleQueries : positive.slice(0, 4)
    const searchQueries = queries.length > 0 ? queries : positive.slice(0, 4)
    send('search_info', { queries: portalQueries, keywords_positivas: positive.slice(0, 10) })

    // FIX 2: Siempre incluir los portales principales de Chile (GetOnBoard, LinkedIn, Indeed, Computrabajo)
    // más cualquier portal adicional configurado por el usuario (empresa específica, etc.)
    const BASE_PORTALS = [
      { name: 'GetOnBoard', careers_url: 'https://www.getonbrd.com', enabled: true },
      { name: 'LinkedIn Chile', careers_url: 'https://www.linkedin.com/jobs/', enabled: true },
      { name: 'Indeed Chile', careers_url: 'https://cl.indeed.com', enabled: true },
      { name: 'Computrabajo Chile', careers_url: 'https://cl.computrabajo.com', enabled: true },
    ]
    const baseDomains = new Set(BASE_PORTALS.map(p => new URL(p.careers_url).hostname))
    // Portales extra del usuario (empresas, otros portales no base)
    const extraPortals = (portalsConfig.tracked_companies || [])
      .filter(p => p.enabled && (() => { try { return !baseDomains.has(new URL(p.careers_url).hostname) } catch { return false } })())
    const portals = [...BASE_PORTALS, ...extraPortals]

    send('start', { total: portals.length, mensaje: `Escaneando ${portals.length} portales · ${searchQueries.length} consultas` })

    let totalFound = 0
    let totalAdded = 0

    // Combine positive keywords + role queries + individual significant words from
    // role queries, so "Analista de Datos" also matches "Analista de Base de Datos",
    // "Analista BI", etc. (compact-phrase check misses these multi-word variations).
    const stopwordsExpand = new Set(['de', 'del', 'el', 'la', 'los', 'las', 'en', 'a', 'para', 'y', 'e', 'o', 'con', 'por', 'al'])
    const singleWordExpansion = portalQueries.flatMap(q =>
      q.split(/\s+/).filter(w => w.length >= 5 && !stopwordsExpand.has(w.toLowerCase()))
    )
    const allPositive = [...new Set([...positive, ...portalQueries, ...singleWordExpansion])]

    const HEADERS = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
    }

    for (const portal of portals) {
      send('portal', { nombre: portal.name, url: portal.careers_url, estado: 'escaneando' })

      try {
        let ofertas: JobResult[] = []
        const domain = new URL(portal.careers_url).hostname

        const score = (t: string) => kwScore(t, allPositive)

        // ── GetOnBoard: API pública ──────────────────────────────────────────
        if (domain.includes('getonbrd.com')) {
          for (const q of portalQueries.slice(0, 5)) {
            try {
              const { data } = await axios.get('https://www.getonbrd.com/api/v0/jobs', {
                params: { query: q, per_page: 15, page: 0 },
                timeout: 10000, headers: { ...HEADERS, Accept: 'application/json' },
              })
              for (const job of ((data as { data?: unknown[] }).data || [])) {
                const a = (job as { attributes?: Record<string, unknown> }).attributes || {}
                const title = String(a.title || '')
                if (!title || !kwMatch(title, allPositive, negative)) continue
                const country = String((a.country as Record<string,unknown>)?.name || '').toLowerCase()
                if (country && !country.includes('chile') && !a.remote) continue
                ofertas.push({
                  titulo: title,
                  empresa: String(a.company_name || '—'),
                  url: String(a.applications_url || `https://www.getonbrd.com/jobs/${(job as { id?: string }).id || ''}`),
                  ubicacion: a.remote ? 'Remoto' : 'Chile',
                  match_score: score(title),
                  razon: `GetOnBoard · "${q}"`,
                })
              }
            } catch (e: unknown) {
              console.warn(`[Scanner] GetOnBoard query "${q}" falló:`, (e as Error).message?.slice(0, 120))
            }
          }
        }

        // ── LinkedIn: guest jobs API (sin autenticación) ─────────────────────
        else if (domain.includes('linkedin.com')) {
          for (const q of portalQueries.slice(0, 5)) {
            for (const start of [0, 25]) {
              try {
                const { data } = await axios.get(
                  'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search',
                  {
                    params: { keywords: q, location: 'Chile', start },
                    timeout: 12000,
                    headers: { ...HEADERS, Accept: 'text/html,*/*;q=0.9', Referer: 'https://www.linkedin.com/jobs/search/' },
                  }
                )
                const cards = String(data).match(/<li[^>]*>[\s\S]*?<\/li>/g) || []
                for (const card of cards) {
                  const title = (card.match(/class="[^"]*base-search-card__title[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/h3>/) || card.match(/<h3[^>]*>\s*([\s\S]*?)\s*<\/h3>/))?.[1]?.replace(/<[^>]+>/g, '').trim()
                  const company = card.match(/class="[^"]*base-search-card__subtitle[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/(?:h4|a)>/)?.[1]?.replace(/<[^>]+>/g, '').trim()
                  const location = card.match(/class="[^"]*job-search-card__location[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/span>/)?.[1]?.replace(/<[^>]+>/g, '').trim()
                  const url = card.match(/href="(https:\/\/[^"]*linkedin\.com\/jobs\/view\/[^"?]*)(?:\?[^"]*)?"/) ?.[1]
                  if (!title || !kwMatch(title, allPositive, negative)) continue
                  ofertas.push({ titulo: title, empresa: company || '—', url: url || portal.careers_url, ubicacion: location || 'Chile', match_score: score(title), razon: `LinkedIn · "${q}"` })
                }
              } catch (e: unknown) {
                console.warn(`[Scanner] LinkedIn query "${q}" start=${start} falló:`, (e as Error).message?.slice(0, 120))
                break
              }
            }
          }
        }

        // ── Indeed Chile: HTML scraping (RSS retorna 404) ────────────────────
        else if (domain.includes('indeed.com')) {
          let indeedBlocked = false
          for (const q of portalQueries.slice(0, 5)) {
            if (indeedBlocked) break
            try {
              const { data, status } = await axios.get(`https://cl.indeed.com/jobs?q=${encodeURIComponent(q)}&l=Chile&sort=date`, {
                timeout: 12000, headers: { ...HEADERS, Accept: 'text/html,*/*;q=0.9' },
                validateStatus: s => s < 500,
              })
              if (status === 403 || status === 429) {
                console.warn(`[Scanner] Indeed devolvió ${status} — bloqueado por anti-bot`)
                indeedBlocked = true; break
              }
              const html = String(data)
              // Indeed embeds job data in a JSON blob — try to extract it first
              const jsonMatch = html.match(/window\.__JSERP__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/) ||
                html.match(/window\._initialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/)
              if (jsonMatch) {
                try {
                  const blob = JSON.parse(jsonMatch[1]) as Record<string, unknown>
                  const searchResp = ((blob.metaData as Record<string,unknown>)?.searchResponse as Record<string,unknown> | undefined)
                  const hitsObj = (searchResp?.hits as Record<string,unknown> | undefined)
                  const jobsArray = (hitsObj?.hits as unknown[]) ||
                    ((blob.pageProps as Record<string,unknown>)?.jobs as unknown[]) || []
                  for (const job of (Array.isArray(jobsArray) ? jobsArray : [])) {
                    const j = job as Record<string, unknown>
                    const title = String((j._source as Record<string,unknown>)?.title || j.title || '')
                    if (!title || !kwMatch(title, allPositive, negative)) continue
                    const jk = String(j.jobkey || (j._source as Record<string,unknown>)?.jobkey || '')
                    ofertas.push({
                      titulo: title, empresa: String((j._source as Record<string,unknown>)?.company || '—'),
                      url: jk ? `https://cl.indeed.com/viewjob?jk=${jk}` : 'https://cl.indeed.com',
                      ubicacion: 'Chile', match_score: score(title), razon: `Indeed · "${q}"`,
                    })
                  }
                } catch { /* JSON parse failed, fall through to HTML parser */ }
              }
              const htmlParsed = parseIndeed(html, score, allPositive, negative, `Indeed · "${q}"`)
              ofertas.push(...htmlParsed)
            } catch (e: unknown) {
              console.warn(`[Scanner] Indeed query "${q}" falló:`, (e as Error).message?.slice(0, 120))
            }
          }
          if (indeedBlocked) {
            send('portal_warn', { nombre: portal.name, nota: 'Indeed bloqueó el acceso (anti-bot). Los resultados de este portal no están disponibles.' })
          }
        }

        // ── Computrabajo: HTML con selectores js-o-link ──────────────────────
        else if (domain.includes('computrabajo.com')) {
          let ctBlocked = false
          for (const q of portalQueries.slice(0, 5)) {
            if (ctBlocked) break
            try {
              const { data, status } = await axios.get(buildSearchUrl(portal.careers_url, q), {
                timeout: 12000, headers: { ...HEADERS, Accept: 'text/html,*/*;q=0.9', Referer: 'https://cl.computrabajo.com/' },
                validateStatus: s => s < 500,
              })
              if (status === 403 || status === 429) {
                console.warn(`[Scanner] Computrabajo devolvió ${status} — bloqueado`)
                ctBlocked = true; break
              }
              const parsed = parseComputrabajo(String(data), score, allPositive, negative, `Computrabajo · "${q}"`)
              ofertas.push(...parsed)
            } catch (e: unknown) {
              console.warn(`[Scanner] Computrabajo query "${q}" falló:`, (e as Error).message?.slice(0, 120))
            }
          }
          if (ctBlocked) {
            send('portal_warn', { nombre: portal.name, nota: 'Computrabajo bloqueó el acceso. Intenta abrir la URL manualmente.' })
          }
        }

        // ── Bumeran Chile / Laborum Chile: HTML con URLs SEO ────────────────
        // Usan server-side rendering para SEO, las páginas de búsqueda son scrapeables
        else if (domain.includes('bumeran.cl') || domain.includes('laborum.cl')) {
          const siteBase = `https://www.${domain}`
          for (const q of portalQueries.slice(0, 4)) {
            try {
              const slug = q.toLowerCase()
                .normalize('NFD').replace(/[̀-ͯ]/g, '')
                .replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-')
              const searchUrl = `${siteBase}/empleos-busqueda-${slug}.html`
              const { data } = await axios.get(searchUrl, {
                timeout: 12000,
                headers: { ...HEADERS, Accept: 'text/html,*/*;q=0.9', Referer: siteBase + '/' },
              })
              const html = String(data)
              const parsed = parseBumeranLaborum(html, score, allPositive, negative, `${portal.name} · "${q}"`, siteBase)
              ofertas.push(...parsed)
            } catch (e: unknown) {
              console.warn(`[Scanner] ${portal.name} query "${q}" falló:`, (e as Error).message?.slice(0, 120))
            }
          }
        }

        // ── Trabajando.cl / YWork: SPA — cargamos con Chrome headless ────────
        else if (domain.includes('trabajando.cl') || domain.includes('yw.cl')) {
          const chromeOk = !!findChrome()
          if (!chromeOk) {
            send('portal_done', { nombre: portal.name, encontradas: 0, agregadas: 0, ofertas: [], nota: 'Chrome no encontrado para cargar este portal' })
            continue
          }
          for (const q of portalQueries.slice(0, 3)) {
            try {
              let searchUrl = ''
              if (domain.includes('trabajando.cl')) {
                searchUrl = `https://www.trabajando.cl/busqueda?q=${encodeURIComponent(q)}&pub_date=7`
              } else {
                searchUrl = `https://www.yw.cl/busqueda?q=${encodeURIComponent(q)}`
              }
              const html = await scrapeWithBrowser(searchUrl, 4000)
              // Parsear títulos y links de la página cargada
              const parsed = parseSpaPortal(html, score, allPositive, negative, `${portal.name} · "${q}"`, `https://www.${domain}`)
              ofertas.push(...parsed)
            } catch { /* skip si Chrome falla */ }
          }
        }

        // ── Otros portales con Greenhouse / Lever / Ashby API ────────────────
        else {
          // Greenhouse boards API
          const ghMatch = portal.careers_url.match(/greenhouse\.io\/([^/]+)/)
          const leverMatch = portal.careers_url.match(/lever\.co\/([^/]+)/)
          const ashbyMatch = portal.careers_url.match(/ashbyhq\.com\/([^/]+)/)
          if (ghMatch) {
            try {
              const { data } = await axios.get(`https://boards-api.greenhouse.io/v1/boards/${ghMatch[1]}/jobs?content=true`, {
                timeout: 10000, headers: { ...HEADERS, Accept: 'application/json' },
              })
              for (const job of ((data as { jobs?: unknown[] }).jobs || [])) {
                const j = job as Record<string, unknown>
                const title = String(j.title || '')
                if (!title || !kwMatch(title, allPositive, negative)) continue
                ofertas.push({ titulo: title, empresa: portal.name, url: String(j.absolute_url || portal.careers_url), ubicacion: String((j.location as Record<string,unknown>)?.name || 'Remote'), match_score: score(title), razon: `${portal.name} API` })
              }
            } catch { /* skip */ }
          } else if (leverMatch) {
            try {
              const { data } = await axios.get(`https://api.lever.co/v0/postings/${leverMatch[1]}?mode=json`, {
                timeout: 10000, headers: { ...HEADERS, Accept: 'application/json' },
              })
              for (const job of (Array.isArray(data) ? data : [])) {
                const j = job as Record<string, unknown>
                const title = String(j.text || '')
                if (!title || !kwMatch(title, allPositive, negative)) continue
                ofertas.push({ titulo: title, empresa: portal.name, url: String(j.hostedUrl || portal.careers_url), ubicacion: String((j.categories as Record<string,unknown>)?.location || 'Remote'), match_score: score(title), razon: `${portal.name} API` })
              }
            } catch { /* skip */ }
          } else if (ashbyMatch) {
            try {
              const { data } = await axios.get(`https://jobs.ashbyhq.com/api/non-user-graphql`, {
                method: 'POST',
                timeout: 10000,
                headers: { ...HEADERS, Accept: 'application/json', 'Content-Type': 'application/json' },
                data: JSON.stringify({ operationName: 'ApiJobBoardWithTeams', variables: { organizationHostedJobsPageName: ashbyMatch[1] }, query: 'query ApiJobBoardWithTeams($organizationHostedJobsPageName:String!){jobBoard:jobBoardWithTeams(organizationHostedJobsPageName:$organizationHostedJobsPageName){jobPostings{id title locationName isRemote}}}' }),
              })
              const postings = (data as { data?: { jobBoard?: { jobPostings?: unknown[] } } }).data?.jobBoard?.jobPostings || []
              for (const job of postings) {
                const j = job as Record<string, unknown>
                const title = String(j.title || '')
                if (!title || !kwMatch(title, allPositive, negative)) continue
                ofertas.push({ titulo: title, empresa: portal.name, url: `https://jobs.ashbyhq.com/${ashbyMatch[1]}/${j.id}`, ubicacion: j.isRemote ? 'Remoto' : String(j.locationName || 'Remote'), match_score: score(title), razon: `${portal.name} Ashby` })
              }
            } catch { /* skip */ }
          } else {
            // Fallback: HTML + Claude para portales desconocidos
            for (const q of portalQueries.slice(0, 2)) {
              try {
                const searchUrl = `${portal.careers_url}?q=${encodeURIComponent(q)}`
                const { data } = await axios.get(searchUrl, { timeout: 12000, headers: { ...HEADERS, Accept: 'text/html,*/*;q=0.9' } })
                const text = stripHtml(String(data))
                if (text.length < 150) continue
                const extraction = await getLlmClient(req).messages.create({
                  model: 'claude-haiku-4-5', max_tokens: 1200,
                  messages: [{ role: 'user', content: `Extrae ofertas de trabajo de este texto de ${portal.name}. Busco: "${q}". Retorna SOLO JSON: {"ofertas":[{"titulo":"...","empresa":"...","url":"...","ubicacion":"...","match_score":0.7}]}\n\nTEXTO:\n${text.slice(0, 5000)}` }],
                })
                const raw = extraction.content.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('')
                const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{"ofertas":[]}') as { ofertas?: Array<{ titulo: string; empresa?: string; url?: string; ubicacion?: string; match_score?: number }> }
                for (const o of parsed.ofertas || []) {
                  if (!o.titulo || !kwMatch(o.titulo, allPositive, negative)) continue
                  ofertas.push({ titulo: o.titulo, empresa: o.empresa || '—', url: o.url?.startsWith('http') ? o.url : portal.careers_url, ubicacion: o.ubicacion || 'Chile', match_score: o.match_score || score(o.titulo), razon: `${portal.name} · "${q}"` })
                }
              } catch { /* skip */ }
            }
          }
        }

        const final = dedup(ofertas)
        totalFound += final.length
        let addedThisPortal = 0
        // FIX 3: Omitir URLs a las que ya se postuló o ya fueron evaluadas
        const freshOffers = final.filter(o => !skipUrls.has(o.url))
        for (const o of freshOffers) {
          await svc.addToPipeline(o.url, portal.name, userEmail)
          addedThisPortal++
          totalAdded++
        }
        const skipped = final.length - freshOffers.length

        send('portal_done', {
          nombre: portal.name,
          encontradas: final.length,
          agregadas: addedThisPortal,
          omitidas: skipped,
          ofertas: freshOffers.slice(0, 10),
        })

      } catch (portalErr: unknown) {
        const msg = (portalErr as Error).message || ''
        send('portal_error', {
          nombre: portal.name,
          error: msg.includes('timeout') ? 'Tiempo de espera agotado' : 'No se pudo acceder al portal',
        })
      }
    }

    send('done', { total_portales: portals.length, ofertas_encontradas: totalFound, agregadas_pipeline: totalAdded })

  } catch (err: unknown) {
    send('error', { error: (err as Error).message })
  } finally {
    res.end()
  }
}
