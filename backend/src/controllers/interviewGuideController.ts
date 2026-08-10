import { Request, Response } from 'express'
import * as svc from '../services/careerOpsService'
import * as guide from '../services/interviewGuideService'
import { getCountryConfig } from '../config/countries'
import {
  getUser, getUserEmail, requireActiveSubscription,
  getLlmClient, getProviderFromRequest, friendlyAiError,
} from './careersController'
import type { InterviewGuide, InterviewMeta, InterviewNotes, EmpresaInfo } from '../services/interviewGuideService'

// El modelo a veces envuelve el JSON en ```json, a veces en ``` pelado, a veces lo escupe
// directo. Mismo problema (y misma defensa) que en evaluateJob.
function extractJson<T>(text: string): T | null {
  const candidates: string[] = []
  const fenced = text.match(/```json\s*([\s\S]*?)```/) || text.match(/```\s*([\s\S]*?)```/)
  if (fenced?.[1]) candidates.push(fenced[1])
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1))

  for (const c of candidates) {
    try { return JSON.parse(c) as T } catch { /* siguiente */ }
  }
  return null
}

function textOf(message: { content: Array<{ type: string }> }): string {
  return message.content
    .filter(b => b.type === 'text')
    .map(b => (b as unknown as { text: string }).text)
    .join('')
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? v as T[] : []
}

// La tool web_search devuelve el texto citado envuelto en <cite index="6-1,6-2">…</cite>.
// Al escaparlo para el HTML esas etiquetas se veían literales dentro de la guía. Se limpian
// acá, en la entrada, para que el JSON que se guarda ya esté sin marcado.
export function stripCitations(s: string): string {
  return s
    .replace(/<\/?cite\b[^>]*>/gi, '')
    .replace(/\[\d+(?:[,-]\s*\d+)*\]/g, '')   // variante "[1]" / "[2, 3]" que a veces usa
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,;:)])/g, '$1')
}

/** Para texto que viene del modelo. */
function asString(v: unknown): string {
  return typeof v === 'string' ? stripCitations(v) : ''
}

/** Para texto que escribe el usuario (notas, datos de la entrevista): se guarda tal cual —
 *  limpiarle corchetes o espacios sería mangonear lo que él escribió. */
function asRawString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function cleanMeta(raw: unknown): InterviewMeta {
  const m = (raw || {}) as Record<string, unknown>
  const take = (k: string) => asRawString(m[k]).trim().slice(0, 300)
  return {
    entrevistadores: take('entrevistadores'),
    fecha: take('fecha'),
    hora: take('hora'),
    modalidad: take('modalidad'),
    tipo: take('tipo'),
  }
}

function cleanNotes(raw: unknown): InterviewNotes {
  const n = (raw || {}) as Record<string, unknown>
  const take = (k: string) => asRawString(n[k]).slice(0, 8000)
  return {
    entrevistadorPrincipal: take('entrevistadorPrincipal'),
    tono: take('tono'),
    horaInicio: take('horaInicio'),
    quimica: take('quimica'),
    preguntas: take('preguntas'),
    equipo: take('equipo'),
    sensacion: take('sensacion'),
    pasos: take('pasos'),
    libre: take('libre'),
  }
}

// ── 1. Investigación de la empresa (la única llamada que gasta web_search) ────

const EMPRESA_SIN_DATOS: EmpresaInfo = {
  resumen: '', stats: [], valores: [], fuentes: [], investigada: false,
}

async function researchEmpresa(
  req: Request,
  empresa: string,
  rol: string,
  paisNombre: string,
  idioma: 'es' | 'en',
): Promise<EmpresaInfo> {
  const message = await getLlmClient(req).messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 3000,
    system: `Investigas empresas para preparar candidatos a entrevistas de trabajo en ${paisNombre}.

REGLA ABSOLUTA: no inventes datos. Cada cifra, adquisición, premio o ranking que reportes tiene
que venir de un resultado real de búsqueda, con su URL. Si la búsqueda no devuelve información
confiable sobre la empresa (es chica, es una consultora que publica en nombre de otro, el nombre
es ambiguo), responde con "investigada": false y deja los arreglos vacíos. Una guía honesta que
dice "no encontré datos" es infinitamente mejor que una que hace al candidato citar una cifra
falsa en la entrevista.`,
    messages: [{
      role: 'user',
      content: `Investiga la empresa "${empresa}" (contexto: está contratando para el cargo "${rol}" en ${paisNombre}).

Busca: a qué se dedica, tamaño y presencia, hitos recientes (adquisiciones, rondas, expansión,
crecimiento), cultura declarada y valores, premios o rankings de empleador, y noticias del último
par de años.

Responde SOLO con este JSON${idioma === 'en' ? ' (contenido en inglés)' : ''}:
\`\`\`json
{
  "investigada": true,
  "resumen": "2-4 frases sobre qué hace la empresa, su tamaño y su momento actual. Menciona los hitos con sus cifras.",
  "stats": [
    { "valor": "41M", "etiqueta": "órdenes 2024" }
  ],
  "valores": [
    {
      "nombre": "Nombre del valor o rasgo cultural",
      "descripcion": "Qué significa en esta empresa, según lo que encontraste",
      "comoUsarlo": "Frase concreta que el candidato puede decir en la entrevista para conectar con ese valor"
    }
  ],
  "fuentes": [
    { "titulo": "Nombre del medio o sitio", "url": "https://..." }
  ]
}
\`\`\`

Máximo 4 stats y 4 valores. "stats" solo con cifras que hayas verificado en una fuente; si no
tienes cifras, déjalo vacío. Si no encontraste información confiable de ESTA empresa, responde
{"investigada": false, "resumen": "", "stats": [], "valores": [], "fuentes": []}.`,
    }],
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
  })

  const parsed = extractJson<Record<string, unknown>>(textOf(message))
  return cleanEmpresaInfo(parsed)
}

/** Normaliza la investigación venga del modelo o del frontend (que la devuelve en el paso 2
 *  para no volver a buscar). Todo lo que sale de acá se escapa al renderizar el HTML. */
function cleanEmpresaInfo(raw: unknown): EmpresaInfo {
  const parsed = (raw || {}) as Record<string, unknown>
  if (!raw || parsed.investigada === false) return EMPRESA_SIN_DATOS

  const info: EmpresaInfo = {
    investigada: true,
    resumen: asString(parsed.resumen).trim(),
    stats: asArray<Record<string, unknown>>(parsed.stats).slice(0, 4)
      .map(s => ({ valor: asString(s.valor).trim(), etiqueta: asString(s.etiqueta).trim() }))
      .filter(s => s.valor && s.etiqueta),
    valores: asArray<Record<string, unknown>>(parsed.valores).slice(0, 4)
      .map(v => ({
        nombre: asString(v.nombre).trim(),
        descripcion: asString(v.descripcion).trim(),
        comoUsarlo: asString(v.comoUsarlo).trim(),
      }))
      .filter(v => v.nombre),
    fuentes: asArray<Record<string, unknown>>(parsed.fuentes).slice(0, 6)
      .map(f => ({ titulo: asString(f.titulo).trim(), url: asString(f.url).trim() }))
      .filter(f => f.titulo),
  }

  // Sin resumen no hay nada que mostrar aunque el modelo diga que investigó.
  if (!info.resumen) return EMPRESA_SIN_DATOS
  return info
}

// ── 2. El cuerpo de la guía ──────────────────────────────────────────────────

function metaBlock(meta: InterviewMeta): string {
  const lines = [
    meta.entrevistadores ? `- Entrevistador(es): ${meta.entrevistadores}` : '',
    meta.fecha ? `- Fecha: ${meta.fecha}` : '',
    meta.hora ? `- Hora: ${meta.hora}` : '',
    meta.modalidad ? `- Modalidad/link: ${meta.modalidad}` : '',
    meta.tipo ? `- Tipo de entrevista: ${meta.tipo}` : '',
  ].filter(Boolean)
  if (!lines.length) {
    return `El candidato no entregó datos de la entrevista (entrevistadores, fecha, modalidad).
En "checklist.logistica" pon items genéricos pero accionables y NO inventes nombres ni horas.`
  }
  return `DATOS REALES DE ESTA ENTREVISTA (úsalos; el checklist logístico debe referirse a ellos):
${lines.join('\n')}`
}

async function generateGuideBody(
  req: Request,
  app: svc.Application,
  cv: string,
  profile: unknown,
  empresaInfo: EmpresaInfo,
  meta: InterviewMeta,
  paisNombre: string,
  idioma: 'es' | 'en',
): Promise<Record<string, unknown> | null> {
  const idiomaRule = idioma === 'en'
    ? 'IMPORTANTE: la entrevista será en INGLÉS. Escribe TODO el contenido en inglés profesional, con las respuestas listas para decirse tal cual.'
    : 'Escribe en español neutro profesional chileno (sin voseo).'

  const investigacion = empresaInfo.investigada
    ? `INVESTIGACIÓN VERIFICADA DE LA EMPRESA (úsala; no agregues cifras que no estén acá):
${empresaInfo.resumen}
${empresaInfo.stats.map(s => `- ${s.valor}: ${s.etiqueta}`).join('\n')}`
    : `No hay investigación disponible de esta empresa. Basa todo en el aviso del cargo y NO inventes
cifras, adquisiciones ni premios de la empresa.`

  const message = await getLlmClient(req).messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 16000,
    system: `Eres un coach de carrera experto en el mercado laboral de ${paisNombre}. Preparas candidatos
para entrevistas de forma práctica y concreta.

Reglas:
- Toda respuesta sugerida se ancla en algo REAL del CV del candidato (empresa, proyecto, cifra).
  Nada de relleno genérico tipo "soy proactivo y trabajo bien en equipo".
- Las respuestas se escriben en primera persona, listas para decirse en voz alta.
- Actúa además como reclutador senior: en las debilidades sé honesto sobre lo que está flojo,
  pero cada debilidad termina en la acción que el candidato toma al respecto, no en el problema.
- Si al candidato le falta algo que el cargo pide, dale la estrategia para responderlo con
  honestidad positiva en vez de esconderlo.
- Nunca inventes datos de la empresa. Solo puedes usar los que te doy.
${idiomaRule}`,
    messages: [{
      role: 'user',
      content: `Prepara al candidato para su entrevista en ${app.empresa} — cargo: ${app.rol}.

${investigacion}

${metaBlock(meta)}

AVISO DEL CARGO:
${app.jd}

CV DEL CANDIDATO:
${cv}

PERFIL: ${JSON.stringify(profile)}

Responde SOLO con este JSON, sin texto antes ni después:
\`\`\`json
{
  "cargo": {
    "objetivo": "1-2 frases: el objetivo real del cargo según el aviso",
    "funciones": ["función concreta del aviso", "..."],
    "requisitos": ["Excel avanzado", "SQL intermedio", "..."],
    "fit": [
      {
        "titulo": "Requisito del cargo → qué del candidato lo cubre",
        "detalle": "Cómo su experiencia concreta lo cubre, con el nombre de la empresa/proyecto",
        "destacado": false
      }
    ],
    "fraseFit": "La frase de una línea que el candidato puede decir para resumir por qué encaja"
  },
  "pitch": {
    "bloques": [
      { "etiqueta": "Quién soy", "texto": "..." },
      { "etiqueta": "Mi experiencia más potente", "texto": "..." },
      { "etiqueta": "Mi diferencial", "texto": "..." },
      { "etiqueta": "Por qué ${app.empresa}", "texto": "..." }
    ],
    "numerosClave": ["cifra real del CV que debe memorizar", "..."]
  },
  "preguntas": {
    "tipicas": [
      { "pregunta": "...", "respuesta": "respuesta completa en primera persona", "tip": "tip de delivery" }
    ],
    "tecnicas": [
      { "pregunta": "...", "respuesta": "cómo abordarla", "tip": "" }
    ],
    "paraEllos": ["pregunta inteligente que el candidato hace al final", "..."]
  },
  "escenarios": [
    {
      "titulo": "Nombre corto del escenario",
      "situacion": "La situación tal como se la plantearían en la entrevista",
      "respuesta": "Cómo responder, anclado en algo que el candidato ya vivió",
      "destacado": false
    }
  ],
  "fortalezas": [{ "titulo": "Fortaleza en una línea", "texto": "cómo contarla en primera persona" }],
  "debilidades": [{ "titulo": "Debilidad en una línea", "texto": "cómo contarla, terminando en la acción" }],
  "checklist": {
    "mental": ["item de preparación mental", "..."],
    "logistica": ["item logístico concreto", "..."],
    "noHacer": ["error específico que este candidato debe evitar en ESTA entrevista", "..."],
    "ventaja": "Un párrafo corto de cierre: cuál es su ventaja real frente a otros candidatos"
  }
}
\`\`\`

Cantidades: 6 fit, 6 preguntas típicas, 4 técnicas, 5 para ellos, 5 escenarios (marca 1 como
"destacado": true — el más probable), 5 fortalezas, 5 debilidades, 6 items de checklist mental,
5 de logística, 5 de "no hacer". Marca como "destacado": true el item de "fit" que sea el
diferencial más fuerte del candidato.

Cada "respuesta" va de 3 a 5 frases: lo que el candidato realmente alcanza a decir en voz alta,
no un ensayo. Nada de repetir la misma anécdota en varias respuestas.`,
    }],
  })

  return extractJson<Record<string, unknown>>(textOf(message))
}

// ── Normalización ────────────────────────────────────────────────────────────

function buildGuide(
  app: svc.Application,
  body: Record<string, unknown>,
  empresaInfo: EmpresaInfo,
  meta: InterviewMeta,
  idioma: 'es' | 'en',
): InterviewGuide {
  const cargo = (body.cargo || {}) as Record<string, unknown>
  const pitch = (body.pitch || {}) as Record<string, unknown>
  const preguntas = (body.preguntas || {}) as Record<string, unknown>
  const checklist = (body.checklist || {}) as Record<string, unknown>

  const strList = (v: unknown) => asArray<unknown>(v).map(asString).map(s => s.trim()).filter(Boolean)
  const qaList = (v: unknown) => asArray<Record<string, unknown>>(v)
    .map(q => ({ pregunta: asString(q.pregunta).trim(), respuesta: asString(q.respuesta).trim(), tip: asString(q.tip).trim() || undefined }))
    .filter(q => q.pregunta && q.respuesta)
  const foDeList = (v: unknown) => asArray<Record<string, unknown>>(v)
    .map(x => ({ titulo: asString(x.titulo).trim(), texto: asString(x.texto).trim() }))
    .filter(x => x.titulo && x.texto)

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    empresa: app.empresa,
    rol: app.rol,
    idioma,
    meta,
    empresaInfo,
    cargo: {
      objetivo: asString(cargo.objetivo).trim(),
      funciones: strList(cargo.funciones),
      requisitos: strList(cargo.requisitos),
      fit: asArray<Record<string, unknown>>(cargo.fit)
        .map(f => ({ titulo: asString(f.titulo).trim(), detalle: asString(f.detalle).trim(), destacado: f.destacado === true }))
        .filter(f => f.titulo),
      fraseFit: asString(cargo.fraseFit).trim(),
    },
    pitch: {
      bloques: asArray<Record<string, unknown>>(pitch.bloques)
        .map(b => ({ etiqueta: asString(b.etiqueta).trim(), texto: asString(b.texto).trim() }))
        .filter(b => b.texto),
      numerosClave: strList(pitch.numerosClave),
    },
    preguntas: {
      tipicas: qaList(preguntas.tipicas),
      tecnicas: qaList(preguntas.tecnicas),
      paraEllos: strList(preguntas.paraEllos),
    },
    escenarios: asArray<Record<string, unknown>>(body.escenarios)
      .map(e => ({
        titulo: asString(e.titulo).trim(),
        situacion: asString(e.situacion).trim(),
        respuesta: asString(e.respuesta).trim(),
        destacado: e.destacado === true,
      }))
      .filter(e => e.situacion && e.respuesta),
    fortalezas: foDeList(body.fortalezas),
    debilidades: foDeList(body.debilidades),
    checklist: {
      mental: strList(checklist.mental),
      logistica: strList(checklist.logistica),
      noHacer: strList(checklist.noHacer),
      ventaja: asString(checklist.ventaja).trim(),
    },
  }
}

// ── Endpoints ────────────────────────────────────────────────────────────────

/** Paso 1: investigación de la empresa, aislada en su propia request.
 *
 *  Está separada de la generación porque juntas se acercaban demasiado al maxDuration de
 *  300s de la función (búsqueda ~20-60s + escritura de la guía ~90-200s): si se pasaba,
 *  Vercel cortaba con 504 y se perdía la búsqueda ya pagada. Partido en dos, cada request
 *  va holgada y el frontend puede mostrar en qué paso va. */
export const researchInterviewCompany = async (req: Request, res: Response) => {
  try {
    const { email: userEmail, userId } = await getUser(req)
    await requireActiveSubscription(userId)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app) return res.status(404).json({ error: 'Postulación no encontrada' })

    const country = getCountryConfig(app.pais)
    const idioma: 'es' | 'en' = req.body?.idioma === 'en' || req.body?.idioma === 'es'
      ? req.body.idioma
      : app.idioma || country.idioma

    // Investigación ya pagada para esta empresa en otra postulación del usuario.
    if (req.body?.reinvestigar !== true) {
      // Se re-limpia: las guías generadas antes del fix quedaron guardadas con el marcado
      // <cite> adentro, y reusarlas tal cual lo volvería a meter en la guía nueva.
      const cached = await svc.findEmpresaResearch(userEmail, app.empresa)
      if (cached) return res.json({ ok: true, empresaInfo: cleanEmpresaInfo(cached), cached: true })
    }

    let empresaInfo: EmpresaInfo
    try {
      empresaInfo = await researchEmpresa(req, app.empresa, app.rol, country.nombre, idioma)
    } catch (err) {
      // La guía se puede armar igual sin investigación; no vale la pena abortar el flujo.
      console.error('researchEmpresa error:', err)
      empresaInfo = EMPRESA_SIN_DATOS
    }

    res.json({ ok: true, empresaInfo, cached: false })
  } catch (err: unknown) {
    console.error('researchInterviewCompany error:', err)
    if (!res.headersSent) {
      res.status((err as { status?: number }).status ?? 500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
    }
  }
}

export const generateInterviewGuide = async (req: Request, res: Response) => {
  try {
    const { email: userEmail, userId } = await getUser(req)
    await requireActiveSubscription(userId)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app) return res.status(404).json({ error: 'Postulación no encontrada' })

    const country = getCountryConfig(app.pais)
    const idioma: 'es' | 'en' = req.body?.idioma === 'en' || req.body?.idioma === 'es'
      ? req.body.idioma
      : app.idioma || country.idioma

    const meta = cleanMeta(req.body?.meta ?? app.interviewMeta)
    const cv = await svc.readCV(userEmail)
    const profile = await svc.readProfile(userEmail)

    // La investigación viene del paso 1 (POST .../research). Se acepta del cliente para no
    // repetir la búsqueda ya pagada, pero se re-normaliza acá y todo se escapa al renderizar.
    // Si no viene (cliente viejo), se busca inline aceptando que la request tarda más.
    let empresaInfo = cleanEmpresaInfo(req.body?.empresaInfo)
    if (!empresaInfo.investigada) {
      const cached = req.body?.reinvestigar === true ? null : await svc.findEmpresaResearch(userEmail, app.empresa)
      if (cached) {
        empresaInfo = cleanEmpresaInfo(cached)
      } else if (req.body?.empresaInfo === undefined) {
        try {
          empresaInfo = await researchEmpresa(req, app.empresa, app.rol, country.nombre, idioma)
        } catch (err) {
          // Que se caiga la búsqueda no puede tumbar la guía entera: el resto sale igual,
          // con la tab de empresa avisando que no hay datos.
          console.error('researchEmpresa error:', err)
          empresaInfo = EMPRESA_SIN_DATOS
        }
      }
    }

    const body = await generateGuideBody(req, app, cv, profile, empresaInfo, meta, country.nombre, idioma)
    if (!body) {
      return res.status(502).json({ error: 'La IA devolvió una respuesta que no se pudo leer. Intenta de nuevo.' })
    }

    const g = buildGuide(app, body, empresaInfo, meta, idioma)
    if (!g.preguntas.tipicas.length && !g.escenarios.length) {
      return res.status(502).json({ error: 'La guía salió incompleta. Intenta generarla de nuevo.' })
    }

    app.interviewGuide = g
    app.interviewMeta = meta
    app.estado = 'Preparado'
    await svc.saveApplication(app, userEmail)

    res.json({
      ok: true,
      guide: g,
      html: guide.buildInterviewGuideHtml(g, { mode: 'app', notes: cleanNotes(app.interviewNotes) }),
    })
  } catch (err: unknown) {
    console.error('generateInterviewGuide error:', err)
    if (!res.headersSent) {
      res.status((err as { status?: number }).status ?? 500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
    }
  }
}

/** HTML para el iframe de la app: notas editables. */
export const getInterviewGuide = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app?.interviewGuide) return res.status(404).json({ error: 'Guía no disponible' })

    res.json({
      ok: true,
      guide: app.interviewGuide,
      notes: cleanNotes(app.interviewNotes),
      html: guide.buildInterviewGuideHtml(app.interviewGuide, { mode: 'app', notes: cleanNotes(app.interviewNotes) }),
    })
  } catch (err: unknown) {
    if (!res.headersSent) res.status((err as { status?: number }).status ?? 500).json({ error: (err as Error).message })
  }
}

export const saveInterviewNotes = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app) return res.status(404).json({ error: 'Postulación no encontrada' })

    app.interviewNotes = cleanNotes(req.body?.notes)
    await svc.saveApplication(app, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    if (!res.headersSent) res.status((err as { status?: number }).status ?? 500).json({ error: (err as Error).message })
  }
}

function guideFilename(app: svc.Application, ext: string): string {
  const clean = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `Guia_Entrevista_${clean(app.empresa)}_${clean(app.rol)}.${ext}`
}

/** Descarga .html — mismo artefacto, con las notas congeladas en solo lectura. */
export const downloadInterviewGuideHtml = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app?.interviewGuide) return res.status(404).json({ error: 'Guía no disponible' })

    const html = guide.buildInterviewGuideHtml(app.interviewGuide, {
      mode: 'standalone',
      notes: cleanNotes(app.interviewNotes),
    })
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${guideFilename(app, 'html')}"`)
    res.send(html)
  } catch (err: unknown) {
    if (!res.headersSent) res.status((err as { status?: number }).status ?? 500).json({ error: (err as Error).message })
  }
}

export const downloadInterviewGuidePdf = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app?.interviewGuide) return res.status(404).json({ error: 'Guía no disponible' })

    // Mismo HTML que la descarga: el @media print del artefacto expande las tabs y mete el
    // salto de página por sección, así que el PDF nunca puede divergir de lo que se vio.
    const html = guide.buildInterviewGuideHtml(app.interviewGuide, {
      mode: 'standalone',
      notes: cleanNotes(app.interviewNotes),
    })
    const { buffer } = await svc.generatePDFFromHtml(html, app.empresa, app.rol, '', 'Guia')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${guideFilename(app, 'pdf')}"`)
    res.send(buffer)
  } catch (err: unknown) {
    console.error('downloadInterviewGuidePdf error:', err)
    if (!res.headersSent) res.status((err as { status?: number }).status ?? 500).json({ error: (err as Error).message })
  }
}
