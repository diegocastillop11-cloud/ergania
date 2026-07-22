import { Request, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import axios from 'axios'
import * as svc from '../services/careerOpsService'
import { supabaseAdmin } from '../config/supabase'
import { getSubscriptionStatus } from '../services/subscriptionService'
import { getCountryConfig, DEFAULT_COUNTRY_NAME, COUNTRIES } from '../config/countries'

/** Solo devuelve un país si coincide EXACTO con uno conocido — evita que un
 * pais_detectado vacío/inventado por el LLM caiga silenciosamente en el
 * default (Chile) de getCountryConfig. */
function findKnownCountry(nombre?: string | null) {
  if (!nombre) return null
  return COUNTRIES.find(c => c.nombre.toLowerCase() === nombre.trim().toLowerCase()) || null
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const multer = require('multer') as typeof import('multer')
export const uploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }).single('cv')

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

function normalizeProvider(_raw?: string): LlmProvider {
  // Siempre usar Anthropic — key configurada en el servidor
  return (process.env.DEFAULT_LLM_PROVIDER as LlmProvider) || 'anthropic'
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
    // gemini-2.0-flash: único modelo soportado en el endpoint OpenAI-compatible de Google AI Studio
    return makeOpenAiWrapper(key, 'https://generativelanguage.googleapis.com/v1beta/openai/', process.env.GEMINI_MODEL || 'gemini-2.0-flash')
  }

  if (provider === 'groq') {
    const key = userApiKey || process.env.GROQ_API_KEY
    if (!key) throw new Error('No hay API key de Groq. Ingresa la tuya en "Mis API Keys" (gratis en console.groq.com).')
    // llama-3.1-8b-instant: 20.000 TPM en tier gratuito (vs 6.000 del 70b)
    return makeOpenAiWrapper(key, 'https://api.groq.com/openai/v1', process.env.GROQ_MODEL || 'llama-3.1-8b-instant')
  }

  if (provider === 'anthropic') {
    // Priorizar key del servidor — el usuario no necesita configurar nada
    const key = process.env.ANTHROPIC_API_KEY || userApiKey
    if (!key) throw new Error('No hay API key de Anthropic configurada en el servidor.')
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
    const isTokenLimit    = apiMsg.toLowerCase().includes('token') || apiMsg.toLowerCase().includes('tpm')
    const isQuotaExceeded = apiMsg.toLowerCase().includes('quota') || apiMsg.toLowerCase().includes('exceeded') || apiMsg.toLowerCase().includes('billing')
    if (isQuotaExceeded) {
      return `Cuota diaria agotada en ${activeProvider}. Cambia a ${freeAlternative} en Dashboard → Configuración de IA.`
    }
    if (isTokenLimit) {
      return `${activeProvider}: límite de tokens por minuto. Espera 60s y reintenta, o cambia a ${freeAlternative} en el Dashboard.`
    }
    if (provider === 'gemini') {
      return `Gemini: límite de requests alcanzado (15 req/min en tier gratuito). Espera 1 minuto y reintenta. Si persiste, cambia a Groq (gratis, sin límites prácticos) en Dashboard → Configuración de IA.`
    }
    return `Límite de requests de ${activeProvider} alcanzado. Espera 1 minuto y reintenta, o cambia a ${freeAlternative} en el Dashboard.`
  }
  // Créditos agotados en la cuenta del servidor (nuestra cuenta, no la del usuario) —
  // Anthropic devuelve esto como 400 con "credit balance is too low" en el mensaje.
  // Sin este chequeo, el usuario vería literalmente el texto de billing de Diego
  // ("ve a Plans & Billing a comprar créditos"), que no significa nada para él.
  const lowerApiMsg = apiMsg.toLowerCase()
  const lowerMsg    = msg.toLowerCase()
  if (lowerApiMsg.includes('credit balance') || lowerMsg.includes('credit balance')
    || ((lowerApiMsg.includes('credit') || lowerMsg.includes('credit')) && (lowerApiMsg.includes('low') || lowerMsg.includes('low')))) {
    return 'El servicio de IA no está disponible en este momento. Ya lo sabemos y lo estamos resolviendo — por favor intenta de nuevo más tarde.'
  }
  if (status === 400) {
    return `Error en la solicitud a ${activeProvider} (400).${apiMsg ? ` ${apiMsg}` : ' Puede ser un problema con el modelo o el formato.'}`
  }
  if (status === 404) {
    if (provider === 'gemini') {
      return `Gemini: API key inválida o sin acceso al modelo (404). Verifica que tu key sea de Google AI Studio (aistudio.google.com) y que empiece con "AIzaSy".`
    }
    return `Modelo de ${activeProvider} no encontrado (404). Verifica tu API key o cambia de proveedor en el Dashboard.`
  }
  // 500/529: Anthropic reporta sobrecarga temporal de su lado — no es un bug nuestro,
  // conviene decirle al usuario que reintente en vez de mostrarle un error técnico.
  if (status === 500 || status === 529 || lowerMsg.includes('overloaded') || lowerApiMsg.includes('overloaded')) {
    return `El servicio de ${activeProvider} está temporalmente sobrecargado. Intenta de nuevo en unos minutos.`
  }
  // Sin status HTTP (falla de red/conexión antes de llegar a la API)
  if (!status && (lowerMsg.includes('timeout') || lowerMsg.includes('econn') || lowerMsg.includes('network') || lowerMsg.includes('fetch failed'))) {
    return `No se pudo conectar con ${activeProvider}. Revisa tu conexión e intenta de nuevo.`
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

function authErr(msg: string): never {
  throw Object.assign(new Error(msg), { status: 401 })
}

async function getSalaryAnchorsReference(pais: string): Promise<string> {
  if (!supabaseAdmin) return ''
  const { data } = await supabaseAdmin.from('salary_anchors').select('*').ilike('pais', pais)
  if (!data || data.length === 0) return ''

  const grouped: Record<string, string[]> = {}
  for (const a of data as Array<{ carrera: string; nivel?: string; rango_min: number; rango_max: number; moneda: string }>) {
    const rango = `${Number(a.rango_min).toLocaleString('es-CL')}-${Number(a.rango_max).toLocaleString('es-CL')} ${a.moneda}`
    const tier = a.nivel ? `${a.nivel}: ${rango}` : rango
    ;(grouped[a.carrera] ??= []).push(tier)
  }
  return Object.entries(grouped).map(([carrera, tiers]) => `- ${carrera} — ${tiers.join(' | ')}`).join('\n')
}

function validateUrl(rawUrl: string): void {
  let parsed: URL
  try { parsed = new URL(rawUrl) } catch { throw new Error('URL inválida') }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Solo se permiten URLs HTTP/HTTPS')
  const h = parsed.hostname.toLowerCase()
  if (/^(localhost$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$)/.test(h))
    throw new Error('URL no permitida')
}

async function getUser(req: Request): Promise<{ email: string; userId: string }> {
  const auth = req.headers['authorization']
  const rawToken = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined
  if (!rawToken) {
    console.warn('[Auth] Authorization token missing')
    authErr('Token de autenticación no encontrado. Inicia sesión de nuevo.')
  }
  if (!supabaseAdmin) {
    console.warn('[Auth] Supabase admin cliente no configurado')
    authErr('Supabase no está configurado en el servidor.')
  }
  const { data, error } = await supabaseAdmin!.auth.getUser(rawToken!)
  if (error || !data?.user?.email) {
    console.warn('[Auth] Token inválido o usuario no encontrado', { error: error?.message })
    authErr('Token de autenticación inválido o expirado. Inicia sesión de nuevo.')
  }
  return { email: data.user!.email!, userId: data.user!.id }
}

async function getUserEmail(req: Request): Promise<string> {
  return (await getUser(req)).email
}

async function requireActiveSubscription(userId: string): Promise<void> {
  const sub = await getSubscriptionStatus(userId)
  if (sub.status !== 'trial' && sub.status !== 'active') {
    throw Object.assign(new Error('Suscripción requerida para usar esta función'), { status: 402 })
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export const getStats = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    res.json(await svc.getStats(userEmail))
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

// ── Tracker ───────────────────────────────────────────────────────────────────

export const getTracker = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    res.json(await svc.readTracker(userEmail))
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
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
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

export const markApplied = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    await svc.updateTrackerEntry(req.params.id, { estado: 'Postulada' }, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

export const deleteTrackerEntry = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    await svc.deleteTrackerEntry(req.params.id, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export const getPipeline = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    res.json(await svc.readPipeline(userEmail))
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
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
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

export const removeFromPipeline = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    await svc.removeFromPipeline(req.body.url, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

// ── Portals ───────────────────────────────────────────────────────────────────

export const getPortals = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    res.json(await svc.readPortals(userEmail))
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

export const updatePortals = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    await svc.writePortals(req.body, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

// ── Profile ───────────────────────────────────────────────────────────────────

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    res.json(await svc.readProfile(userEmail))
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    await svc.writeProfile(req.body, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

// ── Perfiles (multi-perfil) ───────────────────────────────────────────────────

export const listPerfiles = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    res.json({ perfiles: await svc.listPerfiles(userEmail) })
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

export const createPerfil = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const nombre = String(req.body?.nombre || '').trim()
    if (!nombre) return res.status(400).json({ error: 'nombre es requerido' })
    if (nombre.length > 60) return res.status(400).json({ error: 'nombre demasiado largo (máx 60)' })
    const perfil = await svc.createPerfil(nombre, userEmail)
    res.json({ ok: true, perfil })
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

export const renamePerfil = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const nombre = String(req.body?.nombre || '').trim()
    if (!nombre) return res.status(400).json({ error: 'nombre es requerido' })
    if (nombre.length > 60) return res.status(400).json({ error: 'nombre demasiado largo (máx 60)' })
    await svc.renamePerfil(req.params.id, nombre, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

export const activatePerfil = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    await svc.activatePerfil(req.params.id, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

export const deletePerfil = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    await svc.deletePerfil(req.params.id, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

// ── CV ────────────────────────────────────────────────────────────────────────

export const getCV = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    res.json({ content: await svc.readCV(userEmail) })
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

export const updateCV = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    await svc.writeCV(req.body.content, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

// ── Reports ───────────────────────────────────────────────────────────────────

export const getReport = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    // El tracker guarda el slug con prefijo "reports/", pero el archivo se guarda sin él
    const rawSlug = decodeURIComponent(req.params.slug)
    const slug = rawSlug.replace(/^reports\//, '')
    const content = await svc.readReport(slug, userEmail)
    res.json({ content })
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

export const listReports = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    res.json(await svc.listReports(userEmail))
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message }) }
}

// ── Evaluate ──────────────────────────────────────────────────────────────────

export const evaluateJob = async (req: Request, res: Response) => {
  try {
    const { email: userEmail, userId } = await getUser(req)
    await requireActiveSubscription(userId)
    const { jd: jdRaw, url, empresa, rol, force } = req.body
    if (!jdRaw && !url) return res.status(400).json({ error: 'Se requiere el texto de la oferta (jd) o una URL' })

    // Reutilizar una evaluación previa de la misma URL en el perfil activo en vez de
    // gastar un web_search nuevo — reevaluar la misma oferta podía dar un score o
    // renta distintos cada vez, lo que confundía más de lo que ayudaba. El usuario
    // puede forzar una evaluación nueva explícitamente (force=true, botón Recalcular).
    if (url && !force) {
      const activePerfilId = await svc.getActivePerfilId(userEmail)
      const tracker = await svc.readTracker(userEmail)
      const existing = tracker.find(e => e.url === url && (!e.perfil_id || e.perfil_id === activePerfilId))
      if (existing?.reportSlug) {
        const slug = existing.reportSlug.replace(/^reports\//, '')
        const reportContent = await svc.readReport(slug, userEmail)
        if (reportContent) {
          let meta: Record<string, unknown> = {}
          const jsonMatch = reportContent.match(/```json\s*([\s\S]*?)```/)
          if (jsonMatch?.[1]) { try { meta = JSON.parse(jsonMatch[1]) } catch { /* ignore */ } }
          return res.json({
            ok: true,
            entry: existing,
            reportSlug: slug,
            meta,
            report: reportContent,
            reused: true,
            reusedFecha: existing.fecha,
          })
        }
      }
    }

    // Intentar scrapear la URL si el JD está vacío o es solo una referencia corta
    let scrapedContent = ''
    if (url && (!jdRaw || jdRaw.length < 300)) {
      try {
        validateUrl(url)
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
        // Si axios falla, intenta con Chrome headless para JavaScript rendering.
        // Usa svc.launchBrowser() (mismo lanzador que la generación de PDF) en vez de
        // buscar Chrome en rutas locales fijas — esas rutas nunca existen en producción
        // (Vercel/Linux), así que este fallback nunca corría en prod hasta ahora.
        const blockedDomains = ['indeed.com', 'linkedin.com', 'computrabajo.com']
        if (blockedDomains.some(d => url.includes(d)) && scrapedContent.length < 200) {
          try {
            const browser = await svc.launchBrowser()
            try {
              const page = await browser.newPage()
              await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36')
              await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 })
              const html = await page.content()

              scrapedContent = String(html)
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<!--[\s\S]*?-->/g, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&[a-z#0-9]+;/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 6000)
            } finally {
              await browser.close()
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

    const paisSeleccionado = (req.body?.pais as string) || location.country || DEFAULT_COUNTRY_NAME
    const country = getCountryConfig(paisSeleccionado)
    const idiomaSalida = country.idioma === 'en' ? 'inglés' : 'español'
    const pisoLegalLine = country.pisoLegalMensual
      ? `Sueldo mínimo legal en ${country.nombre}: $${country.pisoLegalMensual.toLocaleString('es-CL')} ${country.moneda} mensual${country.pisoLegalNota ? ` (${country.pisoLegalNota})` : ''} — ningún rango debe quedar por debajo salvo práctica/part-time.`
      : ''

    const salaryAnchorsRef = await getSalaryAnchorsReference(country.nombre)

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
      systemPrompt = `Eres experto en ofertas laborales de ${country.nombre}. Evalúa brevemente usando SIEMPRE escala de score 1.0 a 5.0 (nunca 1-10). Responde SOLO en ${idiomaSalida}.
Candidato: ${candidate.full_name || 'Diego'} — ${(narrative.headline as string) || 'Analista de Datos'}
Roles objetivo: ${Object.values(targetRoles).flat().slice(0, 4).join(', ')}
Renta objetivo: ${compensation.target_range || `sin dato — estima acorde al mercado de ${country.nombre} en ${country.moneda}`}
CV (resumen): ${cv.slice(0, 800)}
${pisoLegalLine}
${salaryAnchorsRef ? `Referencias reales de mercado (usa la más cercana al rol/seniority detectado):\n${salaryAnchorsRef}` : ''}
⚠️ "${country.nombre}" es solo lo preseleccionado por el usuario, puede estar mal. Si el JD indica CLARAMENTE otro país, usa el país/moneda REALES de la oferta y repórtalo en pais_detectado.`

      userMessage = `Oferta: ${empresa || ''} — ${rol || ''}${url ? ` (${url})` : ''}
JD: ${jd.slice(0, 1800)}

${isShortfallUrl ? `
⚠️ NOTA: El contenido de esta oferta fue limitado (la URL bloqueó acceso completo).
Extrae empresa y rol del URL o contexto. Haz tu mejor evaluación con lo disponible.
` : ''}

Responde con análisis breve Y este JSON al final:
\`\`\`json
{"empresa":"...","rol":"...","score":0.0 (entre 1.0 y 5.0, nunca 1-10),"remoto":"remoto/híbrido/presencial","seniority":"Junior/Mid/Senior","legitimidad":"Alta confianza/Proceder con cautela/Sospechosa","recomendacion":"POSTULAR/CONSIDERAR/DESCARTAR","salario_clp":"rango en la moneda real","contrata_chile":true,"pais_detectado":"país real de la oferta","keywords":["kw1"]}
\`\`\``
    } else {
      // ── Modo completo para Gemini / Claude / OpenAI ────────────────────────
      maxTokens = 2600 // margen extra: con búsqueda web el modelo puede razonar antes del JSON
      systemPrompt = `Eres un experto en búsqueda de trabajo en ${country.nombre} y evaluación de ofertas laborales.

CONTEXTO DEL CANDIDATO:
- País de la oferta: ${country.nombre}
- Moneda: ${country.moneda} — SIEMPRE usa ${country.moneda} para salarios
- Idioma: responde SIEMPRE en ${idiomaSalida}

${sharedMode}
${profileMode}

CV DEL CANDIDATO:
${cv}

DATOS DEL PERFIL:
- Nombre: ${candidate.full_name || 'Diego Castillo Pineda'}
- Ubicación: ${candidate.location || 'La Florida, Santiago, Chile'}
- Roles objetivo: ${JSON.stringify(targetRoles)}
- Headline: ${(narrative.headline as string) || ''}
- Compensación objetivo: ${compensation.target_range || `sin dato — estima acorde al mercado de ${country.nombre} en ${country.moneda}`}
- Mínimo: ${compensation.minimum || 'sin dato'}
- Modalidad: ${location.modalidad || 'Remoto o Híbrido'}

DATOS REALES DE MERCADO:
${pisoLegalLine ? `- ${pisoLegalLine}` : ''}
${salaryAnchorsRef ? `- Referencias curadas como respaldo (pueden estar desactualizadas, prioriza la búsqueda web si está disponible):\n${salaryAnchorsRef}` : ''}

CÓMO ESTIMAR EL SALARIO (salario_clp):
1. Si tienes la herramienta de búsqueda web disponible, ÚSALA para investigar el sueldo real de este rol específico (considera cargo, empresa si es conocida, seniority y país) — no te quedes solo con tu conocimiento general.
2. CUIDADO CON LAS UNIDADES: muchas fuentes (Glassdoor, levels.fyi, etc.) muestran cifras ANUALES por defecto. Antes de reportar salario_clp, verifica explícitamente si el número que encontraste es mensual o anual, y conviértelo a MENSUAL dividiendo por 12 si corresponde. Nunca reportes una cifra anual como si fuera mensual.
3. Si no hay resultados de búsqueda útiles, usa las referencias curadas de arriba (si existen) o tu conocimiento general, siendo conservador y explícito en tu razonamiento sobre que es una estimación.
4. Considera también el tamaño/rubro de la empresa y las responsabilidades específicas del cargo, no solo el título del rol.

REGLAS CRÍTICAS PARA ${country.nombre.toUpperCase()}:
1. TODOS los salarios se expresan en ${country.moneda} mensual bruto
2. Si la oferta menciona un sueldo en otra moneda, conviértelo al cambio actual a ${country.moneda} Y también muestra la cifra original
3. Prioriza roles: Remoto > Híbrido > Presencial
4. Evalúa si la empresa contrata en ${country.nombre} (entity propia, contractor, EOR)
5. Si la oferta es en un idioma distinto, evalúa igual pero responde EN ${idiomaSalida.toUpperCase()}

⚠️ VERIFICACIÓN DE PAÍS (prioridad sobre las reglas anteriores): el país de arriba (${country.nombre}) es solo lo que el usuario preseleccionó ANTES de ver esta oferta — puede estar equivocado. Si el JD, la empresa o la ubicación indican CLARAMENTE que el trabajo es en otro país (ej. dice "California, USA" pero arriba dice Chile), usa el país e idioma REALES de la oferta para salario_clp y para el análisis, e infórmalo en "pais_detectado". No fuerces ${country.moneda} si la evidencia de la oferta contradice ese país.

RESPONDE SIEMPRE EN ${idiomaSalida.toUpperCase()}. Sé directo, concreto y útil. Sin frases genéricas.${isShortfallUrl ? `

⚠️ LIMITACIÓN: El contenido de esta oferta fue limitado (acceso de la URL bloqueado).
CRITICAL: Extrae empresa y rol del URL, headers, meta tags, o contexto disponible.
Haz tu mejor evaluación profesional con lo que tengas.` : ''}`

      userMessage = `Evalúa esta oferta de trabajo para el mercado de ${country.nombre}:

${url ? `URL: ${url}` : ''}
${empresa ? `Empresa: ${empresa}` : ''}
${rol ? `Rol: ${rol}` : ''}

---
${jd}
---

Si usas la herramienta de búsqueda web, hazlo primero y no narres el proceso de búsqueda en tu respuesta — ve directo al resultado.

PRIMERO incluye EXACTAMENTE este JSON con los datos clave (completo, sin cortar), LUEGO entrega el análisis completo (bloques A-G):

\`\`\`json
{
  "empresa": "nombre empresa",
  "rol": "título del rol",
  "score": 0.0 (usa SIEMPRE escala 1.0 a 5.0, nunca 1-10),
  "arquetipo": "tipo detectado",
  "remoto": "remoto/híbrido/presencial",
  "seniority": "Junior/Mid/Senior",
  "legitimidad": "Alta confianza/Proceder con cautela/Sospechosa",
  "recomendacion": "POSTULAR/CONSIDERAR/DESCARTAR",
  "salario_clp": "rango en ${country.moneda} mensual (o en la moneda real si detectaste otro país)",
  "salario_usd": "si aplica para trabajo remoto internacional",
  "contrata_chile": true,
  "pais_detectado": "país real de la oferta si es distinto a ${country.nombre}, o '${country.nombre}' si coincide",
  "keywords": ["kw1", "kw2"]
}
\`\`\``
    }

    const message = await getLlmClient(req).messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      // Solo tiene efecto con el proveedor Anthropic (los demás lo ignoran) — permite
      // investigar en vivo el sueldo real del rol/empresa/país en vez de solo adivinar.
      tools: isGroq ? undefined : [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
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

    // Defensa adicional: el modelo a veces devuelve escala 1-10 pese a la instrucción.
    // Si viene sobre 5, se asume esa escala y se reescala a 1-5; siempre se clampea al final.
    if (meta.score !== undefined && meta.score !== null) {
      let s = Number(meta.score)
      if (!Number.isNaN(s)) {
        if (s > 5) s = s / 2
        meta.score = Math.max(1, Math.min(5, Math.round(s * 10) / 10))
      }
    }

    const finalEmpresa = (meta.empresa as string)?.trim() || empresa || ''
    const finalRol = (meta.rol as string)?.trim() || rol || ''

    // Si no se pudo identificar el rol, o el modelo no llegó a producir un score real
    // (típico cuando la URL bloqueó el scraping, no había texto del JD, y el modelo
    // devolvió una respuesta vacía/genérica), no tiene sentido guardar una entrada en
    // el tracker — antes quedaba ahí como "Oferta sin identificar" o con score 0/5 sin
    // forma de saber a qué oferta correspondía ni recomendación real. Se corta acá y se
    // le pide al usuario reintentar con más contexto, antes de gastar el reporte/entry.
    // (empresa por sí sola no basta: el modelo a veces adivina el dueño del portal como
    // "empresa" aunque no haya podido leer la oferta real.)
    if (!finalRol || meta.score === undefined || meta.score === null) {
      return res.status(422).json({
        error: 'Oferta no identificada: no fue posible evaluarla a partir de la URL. Intenta con otra URL, o pega el texto completo de la oferta en "Pegar texto del JD".',
      })
    }

    // El modelo puede detectar que el país real de la oferta es distinto al
    // preseleccionado por el usuario (ver "VERIFICACIÓN DE PAÍS" en el prompt)
    // — si lo detectó y es un país conocido, ese gana sobre el default.
    const detectedCountry = findKnownCountry(meta.pais_detectado as string)
    const finalCountry = detectedCountry || country

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
**País:** ${finalCountry.nombre}${detectedCountry ? ` (detectado automáticamente — preseleccionado: ${country.nombre})` : ''}
**Salario (${finalCountry.moneda}):** ${meta.salario_clp || '—'}
**Contrata en ${finalCountry.nombre}:** ${meta.contrata_chile ? 'Sí' : 'No confirmado'}
**PDF:** pendiente

---

${fullText}
`
    await svc.saveReport(reportSlug, reportContent, userEmail)

    const entry = await svc.addTrackerEntry({
      fecha: today,
      empresa: finalEmpresa || 'Empresa no especificada',
      rol: finalRol || 'Cargo no especificado',
      score: meta.score ? Number(meta.score) : null,
      estado: 'Evaluada',
      pdf: false,
      reportSlug: `reports/${reportSlug}`,
      url: url || '',
      notas: (meta.recomendacion as string) || '',
      idioma: detectLanguage(jd),
      salario_clp: (meta.salario_clp as string) || undefined,
      salario_usd: (meta.salario_usd as string) || undefined,
      pais: finalCountry.nombre,
      moneda: finalCountry.moneda,
    }, userEmail)

    if (url) await svc.removeFromPipeline(url, userEmail)

    res.json({ ok: true, entry, reportSlug, meta, report: reportContent })
  } catch (err: unknown) {
    console.error('evaluateJob error:', err)
    if (!res.headersSent) res.status((err as {status?:number}).status ?? 500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
  }
}

// ── Generate CV PDF (legado tracker) ─────────────────────────────────────────

export const generateCV = async (req: Request, res: Response) => {
  try {
    const { email: userEmail, userId } = await getUser(req)
    await requireActiveSubscription(userId)
    const { entryId, empresa, rol } = req.body
    if (!empresa || !rol) return res.status(400).json({ error: 'empresa y rol son requeridos' })

    const cv = await svc.readCV(userEmail)
    const profile = await svc.readProfile(userEmail)

    const response = await getLlmClient(req).messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 6000,
      system: 'Eres experto en CVs para búsquedas de empleo internacionales. Genera HTML profesional con CSS embebido, sin dependencias externas, listo para imprimir en PDF.',
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
    res.status((err as {status?:number}).status ?? 500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
  }
}

export const getSalaryRecommendation = async (req: Request, res: Response) => {
  try {
    const { email: userEmail, userId } = await getUser(req)
    await requireActiveSubscription(userId)

    const profile = await svc.readProfile(userEmail)
    const targetRoles = (profile?.target_roles as Record<string, unknown>) || {}
    const location = (profile?.location as Record<string, unknown>) || {}
    const archetypes = (targetRoles.archetypes as Array<{ name: string; level: string }>) || []

    let empresa: string | undefined
    let jd: string | undefined
    let rolDeLaOferta: string | undefined
    if (req.body?.applicationId) {
      const app = await svc.getApplication(req.body.applicationId, userEmail)
      if (!app) return res.status(404).json({ error: 'Postulación no encontrada' })

      // Si esta oferta ya tiene un salario calculado (directo, o de cuando se
      // evaluó en Tracker), reusarlo — evita gastar una consulta nueva y, sobre
      // todo, evita que Evaluar Oferta y Postulaciones muestren números distintos
      // para la MISMA oferta. "forceRefresh" (botón "Recalcular con IA") se lo salta.
      let cachedText = req.body?.forceRefresh ? undefined : app.salario_clp
      if (!cachedText && !req.body?.forceRefresh) {
        const tracker = await svc.readTracker(userEmail)
        const matchingEntry = app.url
          ? tracker.find(e => e.url === app.url)
          : tracker.find(e =>
              e.empresa.toLowerCase() === app.empresa.toLowerCase() &&
              e.rol.toLowerCase() === app.rol.toLowerCase()
            )
        if (matchingEntry?.salario_clp) {
          cachedText = matchingEntry.salario_clp
          await svc.patchApplicationSalary(app.id, matchingEntry.salario_clp, matchingEntry.salario_usd, userEmail)
        }
      }
      if (cachedText) {
        return res.json({ salario_clp: cachedText, fromCache: true, carrera: app.rol, pais: (location.country as string) || DEFAULT_COUNTRY_NAME })
      }

      empresa = app.empresa
      rolDeLaOferta = app.rol
      jd = (app.jd || '').slice(0, 2000)
    }

    const carrera: string | undefined = req.body?.carrera
      || rolDeLaOferta
      || (targetRoles.primary as string[])?.[0]
      || archetypes[0]?.name
    const pais: string | undefined = req.body?.pais || (location.country as string)
    const nivel: string | undefined = req.body?.nivel || archetypes[0]?.level

    if (!carrera || !pais) {
      return res.status(400).json({ error: 'Falta carrera o país. Completa tu perfil (carrera objetivo y país) o envíalos directamente.' })
    }

    const salaryAnchorsRef = await getSalaryAnchorsReference(pais)
    const anchorContext = salaryAnchorsRef
      ? `Referencias curadas como respaldo (pueden estar desactualizadas — prioriza la búsqueda web si está disponible):\n${salaryAnchorsRef}`
      : ''
    const paisConfig = getCountryConfig(pais)
    const minWageLine = paisConfig.pisoLegalMensual
      ? `\nSueldo mínimo legal en ${paisConfig.nombre}: $${paisConfig.pisoLegalMensual.toLocaleString('es-CL')} ${paisConfig.moneda} mensual — ningún rango debe quedar por debajo salvo práctica/part-time.`
      : ''
    const provider = getProviderFromRequest(req)
    const isGroqRec = provider === 'groq'

    const response = await getLlmClient(req).messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      system: 'Eres un experto en compensación laboral. Si tienes la herramienta de búsqueda web disponible, ÚSALA para investigar el rango real del rol/empresa/país en vez de solo tu conocimiento general. CUIDADO: muchas fuentes muestran cifras ANUALES por defecto — verifica la unidad antes de reportar y convierte a MENSUAL (÷12) si corresponde. Razona brevemente (máximo 3-4 líneas) y luego SIEMPRE termina tu respuesta con el bloque JSON, sin markdown: {"rango_min": number, "rango_max": number, "moneda": string, "explicacion": string}. La explicación va en español neutro (1-2 frases), debe indicar explícitamente que es una estimación. El bloque JSON es obligatorio y debe quedar completo — no lo omitas ni lo cortes.',
      messages: [{
        role: 'user',
        content: `Carrera/rol: ${carrera}\nPaís: ${pais}\nNivel/seniority: ${nivel || 'no especificado'}\n${anchorContext}${minWageLine}` +
          (empresa ? `\nEmpresa que ofrece el cargo: ${empresa}` : '') +
          (jd ? `\nDescripción del cargo (extracto):\n${jd}` : '') +
          `\n\nDame un rango de renta líquida MENSUAL estimado y realista para esta persona postulando${empresa ? ` a ${empresa}` : ''} en ${pais}${jd ? ', considerando las responsabilidades y el nivel de seniority que sugiere la descripción del cargo' : ''}.`,
      }],
      tools: isGroqRec ? undefined : [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    })

    const rawText = response.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { type: string; text: string }) => b.text)
      .join('')
      .trim()

    let parsed: { rango_min: number; rango_max: number; moneda: string; explicacion: string }
    try {
      // Con búsqueda web el modelo suele razonar antes del JSON final — tomamos el
      // último bloque {...} del texto (sin llaves anidadas) en vez de un match
      // codicioso desde la primera llave, que podría capturar texto de más.
      const fencedMatch = rawText.match(/```json\s*([\s\S]*?)```/)
      const braceMatches = rawText.match(/\{[^{}]*\}/g)
      const candidate = fencedMatch?.[1] || (braceMatches ? braceMatches[braceMatches.length - 1] : rawText)
      parsed = JSON.parse(candidate)
    } catch {
      throw new Error('No se pudo generar la recomendación — intenta nuevamente')
    }

    if (req.body?.applicationId) {
      const formatted = `${parsed.rango_min.toLocaleString('es-CL')} - ${parsed.rango_max.toLocaleString('es-CL')} ${parsed.moneda} mensual (estimado)`
      await svc.patchApplicationSalary(req.body.applicationId, formatted, undefined, userEmail).catch(() => {})
    }

    res.json({ ...parsed, basadoEnAncla: !!salaryAnchorsRef, carrera, pais })
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
  }
}

// ── Postulaciones (Applications) ──────────────────────────────────────────────

export const listApplications = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    res.json(await svc.readApplications(userEmail))
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

export const getApplicationById = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app) return res.status(404).json({ error: 'Postulación no encontrada' })
    res.json(app)
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

// ── Detección de idioma del JD (heurística por stopwords, sin costo de LLM) ───
export function detectLanguage(text: string): 'es' | 'en' {
  const sample = (text || '').toLowerCase().slice(0, 3000)
  const words = sample.match(/[a-záéíóúñü]+/g) || []
  const EN = new Set(['the', 'and', 'with', 'for', 'you', 'will', 'our', 'are', 'this', 'that', 'have', 'your', 'from', 'work', 'team', 'skills', 'experience', 'we'])
  const ES = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'que', 'con', 'para', 'una', 'en', 'se', 'por', 'como', 'más', 'experiencia', 'equipo', 'nuestro'])
  let en = 0, es = 0
  for (const w of words) {
    if (EN.has(w)) en++
    if (ES.has(w)) es++
  }
  return en > es ? 'en' : 'es'
}

const LANGUAGE_RULE: Record<'es' | 'en', string> = {
  es: '',
  en: `\nIDIOMA (obligatorio): la oferta está en INGLÉS. Escribe TODO el contenido del CV en inglés profesional nativo: summary, bullets, roles, nombres de skills y títulos de educación. Mantén nombres propios (empresas, instituciones) tal cual. Las claves del JSON no cambian.\n`,
}

// ── CV prompt builder (shared between createApplication & regenerateCV) ────────
function buildCvJsonPrompt(
  rol: string,
  empresa: string,
  jd: string,
  cv: string,
  cand: Record<string, string>,
  contactInfo: Record<string, string>,
  cvInstructions?: string,
  idioma: 'es' | 'en' = 'es',
): string {
  return `Actúa como un panel de élite evaluando y reescribiendo este CV para ${rol} en ${empresa}: recruiter senior con 20 años en Fortune 500, hiring manager del área, especialista ATS, y career coach de perfiles tech. El estándar es el nivel de Google, Stripe, Mercado Libre o Nubank — no una corrección cosmética, una reconstrucción completa.

REGLA ABSOLUTA DE VERACIDAD (por sobre cualquier otra instrucción):
- Nunca inventes empresas, cargos, fechas, certificaciones, proyectos, tecnologías o logros que no estén en el CV o perfil del candidato.
- Nunca exageres una métrica que no exista. Si no hay una cifra real disponible, describe el impacto con precisión cualitativa (alcance, criticidad, complejidad) en vez de inventar un número.
- Maximiza el IMPACTO de la experiencia real; no la experiencia misma. Credibilidad > exageración: un reclutador senior detecta una métrica inflada al instante y descarta el CV completo.

ANÁLISIS PREVIO (aplica mentalmente, no lo muestres en la salida):
- Extrae del JD: tecnologías, frameworks, metodologías, herramientas, certificaciones, soft skills y verbos de acción — prioriza las 5-8 más críticas que falten o estén débiles en el CV actual
- Detecta los 3 motivos por los que un reclutador cansado descartaría este CV en 10 segundos (genérico, desalineado, difícil de escanear) y corrígelos
- Detecta riesgos de percepción: ¿podría leerse como junior por falta de métricas, sobrecalificado por exceso de años, o especializado en otra área? Ajusta el framing para neutralizarlos sin ocultar información

JD DEL CARGO (extrae keywords ATS, úsalas literalmente):
${jd.slice(0, 2500)}

CV DEL CANDIDATO (incluye TODA la experiencia real; no omitas ninguna empresa ni la inventes):
${cv}

REGLAS DE REDACCIÓN:
- FÓRMULA XYZ (Google): cada bullet = "Logré [resultado], medido por [métrica], haciendo [acción/tecnología]". Nunca bullets vagos ni descripciones de funciones ("responsable de...").
- Resumen (máx. 4 frases): quién es el candidato, su especialidad, las 2-3 habilidades clave del JD que domina, y el valor/impacto que entrega. Debe dar ganas de seguir leyendo. CERO frases genéricas.
- ATS: usa las keywords exactas del JD en bullets y resumen; no parafrasees si la keyword es técnica (ej. no cambies "SQL Server" por "bases de datos relacionales").
- Prohibido: "años de experiencia", "X+ años", "senior/junior" por tiempo, "proactivo", "apasionado", "dinámico", "trabajo en equipo" sin respaldo concreto.
- Skills: agrupa por categoría y ordena por relevancia para el JD, no alfabéticamente. Incluye ≥3 keywords técnicas del JD.
- Experiencia: ≥3 bullets por empresa reciente, 1 para la más antigua. Mínimo 1 bullet con métrica concreta por empresa; si no existe una métrica real, describe el impacto cualitativo con precisión (nunca inventada).
- Proyectos personales: ≥1 proyecto relevante al JD; nombra el proyecto y su impacto real, sin inflarlo.
- Si el JD pide una habilidad puntual (ej. Python, bases de datos), menciónala en el resumen Y en al menos un bullet de experiencia real donde se haya usado.
${cvInstructions ? `\nINSTRUCCIONES DEL CANDIDATO (máxima prioridad):\n${cvInstructions}\n` : ''}${LANGUAGE_RULE[idioma]}
Antes de responder, verifica en silencio: ortografía y gramática impecables, cero afirmaciones no respaldadas por el CV original, cada bullet legible en menos de 3 segundos.

Devuelve SOLO JSON válido, sin markdown ni explicaciones. La siguiente estructura es solo un EJEMPLO DE FORMATO — usa las empresas, cargos y fechas REALES del candidato, nunca estos placeholders:
{"name":"${cand.full_name || ''}","contact":${JSON.stringify(contactInfo)},"summary":"...","experience":[{"company":"Empresa A","location":"Ciudad, País","role":"Cargo","dates":"Mes Año – Mes Año","bullets":["..."]},{"company":"Empresa B","location":"Ciudad, País","role":"Cargo","dates":"Mes Año – Mes Año","bullets":["..."]}],"projects":[{"name":"...","year":"2024","bullets":["..."]}],"skills":{"Categoría 1":"Skill A, Skill B, Skill C","Categoría 2":"Skill D, Skill E"},"education":[{"title":"...","institution":"...","year":"..."}]}`
}

// CV base del perfil (sin oferta/JD específica) — aplica cv_instructions al CV
// tal cual está guardado, para descargar/usar fuera del flujo de Postulaciones.
function buildCvBaseOptimizePrompt(
  cv: string,
  cand: Record<string, string>,
  contactInfo: Record<string, string>,
  cvInstructions: string,
  idioma: 'es' | 'en' = 'es',
): string {
  return `Actúa como un panel de élite reescribiendo este CV: recruiter senior con 20 años en Fortune 500, hiring manager, especialista ATS, y career coach de perfiles tech. El estándar es el nivel de Google, Stripe, Mercado Libre o Nubank — no una corrección cosmética, una reconstrucción completa. Este CV NO está atado a una oferta específica — es el CV general del candidato.

REGLA ABSOLUTA DE VERACIDAD (por sobre cualquier otra instrucción):
- Nunca inventes empresas, cargos, fechas, certificaciones, proyectos, tecnologías o logros que no estén en el CV del candidato.
- Nunca exageres una métrica que no exista. Si no hay una cifra real disponible, describe el impacto con precisión cualitativa en vez de inventar un número.
- Maximiza el IMPACTO de la experiencia real; no la experiencia misma.

CV DEL CANDIDATO (incluye TODA la experiencia real; no omitas ninguna empresa ni la inventes):
${cv}

REGLAS DE REDACCIÓN:
- FÓRMULA XYZ (Google): cada bullet = "Logré [resultado], medido por [métrica], haciendo [acción/tecnología]". Nunca bullets vagos ni descripciones de funciones ("responsable de...").
- Resumen (máx. 4 frases): quién es el candidato, su especialidad, sus habilidades clave, y el valor/impacto que entrega.
- Prohibido: "años de experiencia", "X+ años", "senior/junior" por tiempo, "proactivo", "apasionado", "dinámico", "trabajo en equipo" sin respaldo concreto.
- Skills: agrupa por categoría y ordena por relevancia.
- Experiencia: ≥3 bullets por empresa reciente, 1 para la más antigua. Mínimo 1 bullet con métrica concreta por empresa; si no existe una métrica real, describe el impacto cualitativo con precisión (nunca inventada).

INSTRUCCIONES DEL CANDIDATO (máxima prioridad — es la razón principal por la que se está regenerando este CV):
${cvInstructions}

${LANGUAGE_RULE[idioma]}
Antes de responder, verifica en silencio: ortografía y gramática impecables, cero afirmaciones no respaldadas por el CV original, cada bullet legible en menos de 3 segundos.

Devuelve SOLO JSON válido, sin markdown ni explicaciones. La siguiente estructura es solo un EJEMPLO DE FORMATO — usa las empresas, cargos y fechas REALES del candidato, nunca estos placeholders:
{"name":"${cand.full_name || ''}","contact":${JSON.stringify(contactInfo)},"summary":"...","experience":[{"company":"Empresa A","location":"Ciudad, País","role":"Cargo","dates":"Mes Año – Mes Año","bullets":["..."]}],"projects":[{"name":"...","year":"2024","bullets":["..."]}],"skills":{"Categoría 1":"Skill A, Skill B, Skill C"},"education":[{"title":"...","institution":"...","year":"..."}]}`
}

function buildCoverLetterPrompt(
  candidateName: string,
  empresa: string,
  rol: string,
  jd: string,
  cv: string,
  idioma: 'es' | 'en' = 'es',
): string {
  if (idioma === 'en') {
    return `Act as an executive communication expert for international job applications.
Write a personalized cover letter in native professional ENGLISH for this specific application.

COMPANY: ${empresa}
ROLE: ${rol}
JD (key excerpt): ${jd.slice(0, 1500)}
CV SUMMARY: ${cv.slice(0, 1000)}

STRUCTURE (3 paragraphs, max 200 words total):
1. Opening: mention company + role + why THIS company specifically (not generic)
2. Value proposition: 2-3 concrete CV achievements with metrics that connect directly to the JD requirements. Use JD keywords.
3. Closing: availability + direct, confident call to action

RULES:
- Professional but direct tone, never corporate filler nor servile
- Every sentence must add new information
- FORBIDDEN: "passionate", "proactive", "team player" without evidence, filler phrases
- End exactly with: "I look forward to discussing further. Best regards, ${candidateName}"

Reply ONLY with the letter text.`
  }
  return `Actúa como experto en comunicación ejecutiva para búsquedas de empleo en español.
Redacta una carta de presentación personalizada para esta postulación específica.

EMPRESA: ${empresa}
CARGO: ${rol}
JD (extracto clave): ${jd.slice(0, 1500)}
CV RESUMIDO: ${cv.slice(0, 1000)}

ESTRUCTURA (3 párrafos, máx 200 palabras total):
1. Apertura: menciona empresa + cargo + por qué ESTA empresa específicamente te interesa (no genérico)
2. Propuesta de valor: 2-3 logros concretos del CV con métrica que conecten directamente con los requisitos del JD. Usa keywords del JD.
3. Cierre: disponibilidad + llamado a acción directo y seguro

REGLAS:
- Tono profesional pero directo, nunca corporativo ni servil
- Cada frase debe aportar información nueva; elimina lo que el recruiter ya sabe o que no detiene el scroll
- PROHIBIDO: "proactivo", "apasionado", "trabajo en equipo" sin respaldo, frases de relleno
- Termina exactamente con: "Quedo disponible para conversar. Saludos, ${candidateName}"

Responde SOLO con el texto de la carta.`
}

export const createApplication = async (req: Request, res: Response) => {
  try {
    const { email: userEmail, userId } = await getUser(req)
    await requireActiveSubscription(userId)
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
    const location = (profile?.location as Record<string, string>) || {}
    const cvInstructions = (profile as Record<string, unknown>)?.cv_instructions as string | undefined
    const contactInfo = {
      city: cand.location || '',
      phone: cand.phone || '',
      email: cand.email || userEmail,
      linkedin: cand.linkedin || '',
      github: cand.github || '',
    }

    // Buscar el tracker entry de la oferta ya evaluada primero — si existe, reusa
    // el país que la IA ya detectó en Evaluar Oferta en vez de volver a preguntarlo.
    const tracker = await svc.readTracker(userEmail)
    const existingTrackerEntry = url
      ? tracker.find(e => e.url === url)
      : tracker.find(e =>
          e.empresa.toLowerCase() === empresa.toLowerCase() &&
          e.rol.toLowerCase() === rol.toLowerCase()
        )

    const paisSeleccionado = (req.body?.pais as string) || existingTrackerEntry?.pais || location.country || DEFAULT_COUNTRY_NAME
    const country = getCountryConfig(paisSeleccionado)

    const idioma: 'es' | 'en' = req.body.idioma === 'en' || req.body.idioma === 'es'
      ? req.body.idioma
      : country.idioma === 'en' ? 'en' : detectLanguage(jd)
    const cvJsonPrompt = buildCvJsonPrompt(rol, empresa, jd, cv, cand, contactInfo, cvInstructions, idioma)

    const response = await getLlmClient(req).messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      system: `Eres un redactor experto en CVs Harvard ATS-optimizados para ${country.nombre}. Retornas SOLO JSON válido, sin markdown, sin explicaciones.`,
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
    const coverLetterPrompt = buildCoverLetterPrompt(cand.full_name || 'Diego Castillo', empresa, rol, jd, cv, idioma)

    let coverLetter: string | undefined
    try {
      const clResult = await getLlmClient(req).messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 600,
        system: `Eres experto en redacción de cartas de presentación para el mercado laboral de ${country.nombre}. Responde SOLO con el texto de la carta, sin encabezados extra ni explicaciones.`,
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
      idioma,
      salario_clp: existingApp?.salario_clp || existingTrackerEntry?.salario_clp,
      salario_usd: existingApp?.salario_usd || existingTrackerEntry?.salario_usd,
      pais: existingApp?.pais || country.nombre,
      moneda: existingApp?.moneda || country.moneda,
    }
    await svc.saveApplication(app, userEmail)

    // Sync tracker: create entry o avanzar estado a 'CV Generado'
    try {
      if (existingTrackerEntry) {
        if (existingTrackerEntry.estado === 'Evaluada') {
          await svc.updateTrackerEntry(existingTrackerEntry.id, { estado: 'CV Generado', pdf: !!cvPdfFilename }, userEmail)
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
          idioma,
          pais: country.nombre,
          moneda: country.moneda,
        }, userEmail)
      }
    } catch (trackerErr) {
      console.error('tracker sync failed (non-fatal):', trackerErr)
    }

    const { cvHtml: _html, ...appWithoutHtml } = app
    res.json({ ok: true, application: appWithoutHtml })
  } catch (err: unknown) {
    console.error('createApplication error:', err)
    if (!res.headersSent) res.status((err as {status?:number}).status ?? 500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
  }
}

export const regenerateCV = async (req: Request, res: Response) => {
  try {
    const { email: userEmail, userId } = await getUser(req)
    await requireActiveSubscription(userId)
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
    const country = getCountryConfig(app.pais)

    // Prioridad: idioma pedido en el body (botón "cambiar idioma") > guardado > detectado del JD
    const idioma: 'es' | 'en' = req.body?.idioma === 'en' || req.body?.idioma === 'es'
      ? req.body.idioma
      : app.idioma || detectLanguage(jd || '')

    const cvJsonPrompt = buildCvJsonPrompt(rol, empresa, jd || '', cv, cand, contactInfo, cvInstructions, idioma)

    const response = await getLlmClient(req).messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      system: `Eres un redactor experto en CVs Harvard ATS-optimizados para ${country.nombre}. Retornas SOLO JSON válido, sin markdown, sin explicaciones.`,
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
    app.idioma = idioma
    await svc.saveApplication(app, userEmail)

    const { cvHtml: _h, ...appWithoutHtml } = app
    res.json({ ok: true, application: appWithoutHtml })
  } catch (err: unknown) {
    console.error('regenerateCV error:', err)
    if (!res.headersSent) res.status((err as {status?:number}).status ?? 500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
  }
}

export const generateInterviewPrep = async (req: Request, res: Response) => {
  try {
    const { email: userEmail, userId } = await getUser(req)
    await requireActiveSubscription(userId)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app) return res.status(404).json({ error: 'Postulación no encontrada' })

    const cv = await svc.readCV(userEmail)
    const profile = await svc.readProfile(userEmail)

    const country = getCountryConfig(app.pais)
    const idioma: 'es' | 'en' = req.body?.idioma === 'en' || req.body?.idioma === 'es'
      ? req.body.idioma
      : app.idioma || country.idioma
    const idiomaRule = idioma === 'en'
      ? '\nIMPORTANTE: la entrevista será en INGLÉS. Escribe TODA la guía en inglés profesional (títulos de sección incluidos), con las respuestas sugeridas listas para decirse en inglés.'
      : ''

    const response = await getLlmClient(req).messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
      system: `Eres un coach de carrera experto en el mercado laboral de ${country.nombre}.
Preparas candidatos para entrevistas de forma práctica.
Actúa como reclutador senior: evalúa el CV con ojo crítico y señala qué está débil, qué falta y qué te haría rechazarlo.
Si el candidato no tiene experiencia directa, ofrece estrategias para manejar esas preguntas con confianza y honestidad positiva.${idiomaRule}`,
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
    if (!res.headersSent) res.status((err as {status?:number}).status ?? 500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
  }
}

export const answerQuestion = async (req: Request, res: Response) => {
  try {
    const { email: userEmail, userId } = await getUser(req)
    await requireActiveSubscription(userId)
    const { question } = req.body
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app) return res.status(404).json({ error: 'Postulación no encontrada' })
    if (!question?.trim()) return res.status(400).json({ error: 'question es requerido' })

    const cv = await svc.readCV(userEmail)

    const idiomaAnswer: 'es' | 'en' = req.body?.idioma === 'en' || req.body?.idioma === 'es'
      ? req.body.idioma
      : app.idioma || getCountryConfig(app.pais).idioma
    const answerLangRule = idiomaAnswer === 'en'
      ? 'Responde SIEMPRE en inglés profesional nativo (el formulario de postulación está en inglés).'
      : 'Español profesional neutro.'

    const response = await getLlmClient(req).messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: `Eres experto en postulaciones laborales. Respondes preguntas de formularios de forma breve, directa y humana.
REGLAS: máximo 3 frases (60-70 palabras). Sin relleno, sin frases genéricas tipo "apasionado" o "proactivo". Primera persona. ${answerLangRule} Nunca menciones falta de experiencia.`,
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
    if (!res.headersSent) res.status((err as {status?:number}).status ?? 500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
  }
}

// ── Simulador de entrevista (chat pregunta → respuesta del candidato → feedback) ─
// Sin historial server-side: el frontend guarda las preguntas en memoria y manda
// cada respuesta suelta — mismo patrón stateless que el resto del controller.

export const interviewSimulateQuestions = async (req: Request, res: Response) => {
  try {
    const { email: userEmail, userId } = await getUser(req)
    await requireActiveSubscription(userId)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app) return res.status(404).json({ error: 'Postulación no encontrada' })

    const cv = await svc.readCV(userEmail)
    const country = getCountryConfig(app.pais)
    const idioma: 'es' | 'en' = req.body?.idioma === 'en' || req.body?.idioma === 'es'
      ? req.body.idioma
      : app.idioma || country.idioma

    const response = await getLlmClient(req).messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 800,
      system: `Eres un reclutador senior de ${country.nombre} preparando preguntas de entrevista real para ${app.rol} en ${app.empresa}. Responde SOLO JSON.`,
      messages: [{
        role: 'user',
        content: `JD:\n${(app.jd || '').slice(0, 1500)}\n\nCV del candidato:\n${cv.slice(0, 2000)}\n\nGenera 6 preguntas de entrevista realistas: mezcla 2 comportamentales, 3 técnicas específicas del rol, 1 sobre motivación o brechas de experiencia del candidato. ${idioma === 'en' ? 'Escribe las preguntas en inglés.' : 'Escribe las preguntas en español.'}\n\nJSON: {"preguntas": ["...", "..."]}`,
      }],
    })

    const text = response.content.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('')
    const match = text.match(/\{[\s\S]*\}/)
    let preguntas: string[] = []
    if (match) { try { preguntas = JSON.parse(match[0]).preguntas || [] } catch { /* empty */ } }
    if (!preguntas.length) return res.status(500).json({ error: 'No se pudieron generar preguntas. Intenta de nuevo.' })

    res.json({ ok: true, preguntas })
  } catch (err: unknown) {
    if (!res.headersSent) res.status((err as {status?:number}).status ?? 500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
  }
}

export const interviewSimulateFeedback = async (req: Request, res: Response) => {
  try {
    const { email: userEmail, userId } = await getUser(req)
    await requireActiveSubscription(userId)
    const { pregunta, respuesta } = req.body
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app) return res.status(404).json({ error: 'Postulación no encontrada' })
    if (!pregunta?.trim() || !respuesta?.trim()) return res.status(400).json({ error: 'pregunta y respuesta son requeridas' })

    const cv = await svc.readCV(userEmail)
    const idioma: 'es' | 'en' = req.body?.idioma === 'en' || req.body?.idioma === 'es'
      ? req.body.idioma
      : app.idioma || getCountryConfig(app.pais).idioma

    const response = await getLlmClient(req).messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 350,
      system: `Eres un coach de entrevistas y reclutador senior evaluando la respuesta de un candidato para ${app.rol} en ${app.empresa}. Da feedback breve y directo (máx 120 palabras): qué estuvo bien (si algo), qué mejorar concretamente, y un tip rápido. Nunca digas solo "buen trabajo" — sé específico. Responde en ${idioma === 'en' ? 'inglés' : 'español'}, texto plano sin markdown.`,
      messages: [{
        role: 'user',
        content: `EXTRACTO CV (para verificar consistencia):\n${(cv || '').slice(0, 1000)}\n\nPREGUNTA: "${pregunta}"\n\nRESPUESTA DEL CANDIDATO: "${respuesta}"\n\nDa tu feedback:`,
      }],
    })

    const feedback = response.content.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('')
    res.json({ ok: true, feedback })
  } catch (err: unknown) {
    if (!res.headersSent) res.status((err as {status?:number}).status ?? 500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
  }
}

export const generateCoverLetter = async (req: Request, res: Response) => {
  try {
    const { email: userEmail, userId } = await getUser(req)
    await requireActiveSubscription(userId)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app) return res.status(404).json({ error: 'Postulación no encontrada' })

    const cv = await svc.readCV(userEmail)
    const profile = await svc.readProfile(userEmail)
    const cand = (profile?.candidate as Record<string, string>) || {}
    const name = cand.full_name || 'Diego Castillo'

    const idioma: 'es' | 'en' = req.body?.idioma === 'en' || req.body?.idioma === 'es'
      ? req.body.idioma
      : app.idioma || 'es'
    const prompt = buildCoverLetterPrompt(name, app.empresa, app.rol, app.jd || '', cv || '', idioma)

    const response = await getLlmClient(req).messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      system: 'Eres experto en redacción de cartas de presentación. Responde SOLO con el texto de la carta, sin encabezados extra ni explicaciones.',
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
    if (!res.headersSent) res.status((err as {status?:number}).status ?? 500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
  }
}

export const generateApplyKit = async (req: Request, res: Response) => {
  try {
    const { email: userEmail, userId } = await getUser(req)
    await requireActiveSubscription(userId)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app) return res.status(404).json({ error: 'Postulación no encontrada' })

    const cv = await svc.readCV(userEmail)
    const country = getCountryConfig(app.pais)
    const idioma = app.idioma || country.idioma
    const idiomaRule = idioma === 'en' ? 'Responde SIEMPRE en inglés profesional nativo.' : 'Responde SIEMPRE en español profesional.'

    let pageContent = app.jd || ''
    if (app.url) {
      try {
        validateUrl(app.url)
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
      system: `Eres experto en postulaciones laborales para ${country.nombre}. Detectas preguntas reales de formularios web y redactas respuestas cortas, precisas y convincentes. El reclutador lee en 10 segundos. ${idiomaRule}`,
      messages: [{
        role: 'user',
        content: `Analiza esta página de postulación para ${app.rol} en ${app.empresa} y genera respuestas.

CONTENIDO DE LA PÁGINA:
${pageContent.slice(0, 3000)}

CV DEL CANDIDATO:
${cv.slice(0, 1200)}

TAREA:
1. Si detectas preguntas REALES del formulario (labels, placeholders, campos de texto), úsalas.
2. Si no hay formulario visible, usa las preguntas más probables para este cargo en ${country.nombre}.
3. Genera respuesta concreta para cada pregunta.

Retorna SOLO JSON (sin markdown):
{"formulario_detectado":true,"preguntas":[{"pregunta":"texto exacto de la pregunta","respuesta":"respuesta 50-80 palabras","tip":"1 frase práctica"}]}

REGLAS:
- 50-80 palabras por respuesta (2-3 oraciones). Directo al punto.
- Primera persona. Verbo de acción. Número real del CV cuando aplica.
- PROHIBIDO: "soy una persona...", "me considero...", "me apasiona...".
- Incluye SIEMPRE: motivación por ${app.empresa}, fortaleza clave para el cargo, disponibilidad de inicio, expectativa de renta (rango ${country.moneda}).
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
    if (!res.headersSent) res.status((err as {status?:number}).status ?? 500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
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
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

export const updateApplicationCv = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app) return res.status(404).json({ error: 'Postulación no encontrada' })

    const cvHtml = req.body?.cvHtml
    if (typeof cvHtml !== 'string' || !cvHtml.trim()) {
      return res.status(400).json({ error: 'cvHtml requerido' })
    }

    await svc.patchCvHtml(req.params.id, cvHtml, userEmail)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

export const downloadApplicationPdf = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const app = await svc.getApplication(req.params.id, userEmail)
    if (!app?.cvHtml) return res.status(404).json({ error: 'CV no disponible' })

    const profile = await svc.readProfile(userEmail)
    const candidateName = ((profile?.candidate as Record<string, string>)?.full_name || '').replace(/\s+/g, '_')
    const emp = app.empresa.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
    const rol = app.rol.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
    const filename = `CV_${candidateName}_${emp}_${rol}.pdf`

    // Renderiza app.cvHtml directamente (mismo HTML del preview/iframe) en vez de
    // volver a parsearlo a CvData: cualquier edición por designMode (Editar CV)
    // puede introducir <div>/<br> anidados que un parser basado en regex no
    // tolera — con el HTML tal cual, el PDF es siempre exactamente lo que se vio
    // en el preview.
    const { buffer } = await svc.generatePDFFromHtml(app.cvHtml, app.empresa, app.rol, candidateName, 'CV')

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (err: unknown) {
    console.error('downloadApplicationPdf error:', err)
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

// Aplica las Instrucciones de Redacción del perfil al CV base (sin oferta específica)
// y devuelve el resultado para previsualizar — no persiste nada todavía.
export const optimizeCv = async (req: Request, res: Response) => {
  try {
    const { email: userEmail, userId } = await getUser(req)
    await requireActiveSubscription(userId)

    const cv = await svc.readCV(userEmail)
    if (!cv.trim()) return res.status(400).json({ error: 'No tienes un CV base guardado todavía.' })

    const profile = await svc.readProfile(userEmail) as Record<string, unknown>
    const cvInstructions = ((profile?.cv_instructions as string) || '').trim()
    if (!cvInstructions) return res.status(400).json({ error: 'Escribe tus instrucciones de redacción antes de generar.' })

    const cand = (profile?.candidate as Record<string, string>) || {}
    const contactInfo = {
      city: cand.location || '',
      phone: cand.phone || '',
      email: cand.email || userEmail,
      linkedin: cand.linkedin || '',
      github: cand.github || '',
    }
    const idioma = detectLanguage(cv)
    const prompt = buildCvBaseOptimizePrompt(cv, cand, contactInfo, cvInstructions, idioma)

    const response = await getLlmClient(req).messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      system: 'Eres un redactor experto en CVs Harvard ATS-optimizados. Retornas SOLO JSON válido, sin markdown, sin explicaciones.',
      messages: [{ role: 'user', content: prompt }],
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
      throw new Error('La IA no devolvió un CV en formato válido. Intenta de nuevo.')
    }

    cvData.summary = stripYearExperiencePhrases(cvData.summary)
    cvData.experience = cvData.experience.map(exp => ({ ...exp, bullets: exp.bullets.map(stripYearExperiencePhrases) }))
    cvData.projects = cvData.projects.map(proj => ({ ...proj, bullets: proj.bullets.map(stripYearExperiencePhrases) }))

    const cvHtml = svc.buildCvHtml(cvData)
    res.json({ ok: true, cvData, cvHtml })
  } catch (err: unknown) {
    const provider = getProviderFromRequest(req)
    res.status((err as {status?:number}).status ?? 500).json({ error: friendlyAiError(err, normalizeProvider(provider)) })
  }
}

// Traduce el CV base a cualquier idioma a pedido — reusa buildCvHtml/downloadOptimizedCvPdf,
// solo cambia el prompt (traducción literal, no reescritura de instrucciones).
export const translateCv = async (req: Request, res: Response) => {
  try {
    const { email: userEmail, userId } = await getUser(req)
    await requireActiveSubscription(userId)

    const cv = await svc.readCV(userEmail)
    if (!cv.trim()) return res.status(400).json({ error: 'No tienes un CV base guardado todavía.' })

    const targetLang = ((req.body?.idioma as string) || '').trim()
    if (!targetLang) return res.status(400).json({ error: 'Falta el idioma de destino.' })

    const profile = await svc.readProfile(userEmail) as Record<string, unknown>
    const cand = (profile?.candidate as Record<string, string>) || {}
    const contactInfo = {
      city: cand.location || '',
      phone: cand.phone || '',
      email: cand.email || userEmail,
      linkedin: cand.linkedin || '',
      github: cand.github || '',
    }

    const prompt = `Traduce este CV COMPLETO a ${targetLang}, preservando el sentido, los logros y las cifras exactamente — es una traducción profesional, no una reescritura ni una optimización. Mantén nombres propios (empresas, instituciones) tal cual, salvo tecnologías/cargos con traducción estándar de la industria en ${targetLang}. No omitas ninguna experiencia ni la resumas.

CV ORIGINAL:
${cv}

Devuelve SOLO JSON válido, sin markdown ni explicaciones, con esta estructura (usa las empresas, cargos y fechas REALES del CV original, ya traducidos):
{"name":"${cand.full_name || ''}","contact":${JSON.stringify(contactInfo)},"summary":"...","experience":[{"company":"...","location":"...","role":"...","dates":"...","bullets":["..."]}],"projects":[{"name":"...","year":"...","bullets":["..."]}],"skills":{"Categoría":"..."},"education":[{"title":"...","institution":"...","year":"..."}]}`

    const response = await getLlmClient(req).messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      system: 'Eres un traductor profesional de CVs. Retornas SOLO JSON válido, sin markdown, sin explicaciones.',
      messages: [{ role: 'user', content: prompt }],
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
      throw new Error('La IA no devolvió un CV en formato válido. Intenta de nuevo.')
    }

    const cvHtml = svc.buildCvHtml(cvData)
    res.json({ ok: true, cvData, cvHtml })
  } catch (err: unknown) {
    const provider = getProviderFromRequest(req)
    res.status((err as {status?:number}).status ?? 500).json({ error: friendlyAiError(err, normalizeProvider(provider)) })
  }
}

// Recibe el cvData ya generado por /cv/optimize (sin volver a llamar a la IA) y
// arma el PDF — separado de optimizeCv para no regenerar el CV cada vez que se descarga.
export const downloadOptimizedCvPdf = async (req: Request, res: Response) => {
  try {
    const userEmail = await getUserEmail(req)
    const cvData = req.body?.cvData as svc.CvData
    if (!cvData?.name) return res.status(400).json({ error: 'Falta el CV a descargar.' })

    const profile = await svc.readProfile(userEmail)
    const candidateName = ((profile?.candidate as Record<string, string>)?.full_name || cvData.name || '').replace(/\s+/g, '_')
    const filename = `CV_${candidateName || 'General'}_Optimizado.pdf`

    const buffer = await svc.buildPdfFromCvData(cvData)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (err: unknown) {
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
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
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
  }
}

// ── Optimizador de perfil LinkedIn ───────────────────────────────────────────

export const linkedinOptimize = async (req: Request, res: Response) => {
  try {
    const { email: userEmail, userId } = await getUser(req)
    await requireActiveSubscription(userId)
    const cv      = await svc.readCV(userEmail)
    const profile = await svc.readProfile(userEmail) as Record<string, unknown>
    const cand    = (profile.candidate as Record<string, string>) || {}
    const targetRoles = (profile.target_roles as Record<string, unknown>) || {}
    const narrative   = (profile.narrative   as Record<string, unknown>) || {}
    const location    = (profile.location    as Record<string, string>) || {}
    const country = getCountryConfig(location.country)

    const rolesStr = [
      ...((targetRoles.primary as string[]) || []),
      ...((targetRoles.archetypes as Array<{ name: string }>) || []).map(a => a.name),
    ].filter(Boolean).slice(0, 8).join(', ')

    const prompt = `Eres un experto en LinkedIn y búsqueda de empleo en ${country.nombre}. Optimiza el perfil de LinkedIn del candidato para que aparezca en búsquedas de reclutadores y pase filtros ATS de LinkedIn. Escribe el contenido en ${country.idioma === 'en' ? 'inglés' : 'español'}.

CANDIDATO: ${cand.full_name || 'Diego Castillo'}
UBICACIÓN: ${cand.location || country.nombre}
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
  "keywords_to_include": ["keyword1", "keyword2", ...15 keywords que reclutadores de ${country.nombre} buscan actualmente para estos roles"]
}`

    const response = await getLlmClient(req).messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 3000,
      system: `Eres un experto en LinkedIn y personal branding para el mercado laboral de ${country.nombre}. Retornas SOLO JSON válido, sin markdown.`,
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

    // Persiste en el perfil ACTIVO (readProfile/writeProfile ya resuelven el perfil
    // activo internamente) para no perder el resultado ni tener que regenerarlo —
    // y para que cada perfil guarde el suyo sin pisar el de otro.
    if (Object.keys(result).length) {
      await svc.writeProfile({ ...profile, linkedin_optimization: result }, userEmail)
    }

    res.json({ ok: true, result })
  } catch (err: unknown) {
    const provider = getProviderFromRequest(req)
    const errMsg = (err as Error)?.message || String(err)
    console.error('[linkedinOptimize] ERROR:', errMsg, { provider, stack: (err as Error)?.stack })
    if (!res.headersSent) {
      const friendly = friendlyAiError(err, provider)
      res.status((err as {status?:number}).status ?? 500).json({ error: friendly || errMsg })
    }
  }
}

// ── Sugerir targets de búsqueda ───────────────────────────────────────────────

export const suggestTargets = async (req: Request, res: Response) => {
  try {
    const { email: userEmail, userId } = await getUser(req)
    await requireActiveSubscription(userId)
    const cv      = await svc.readCV(userEmail)
    const profile = await svc.readProfile(userEmail) as Record<string, unknown>
    const portals = await svc.readPortals(userEmail)
    const location = (profile.location as Record<string, string>) || {}
    const country = getCountryConfig(location.country)
    const currentRoles    = ((profile.target_roles as Record<string, string[]>)?.primary || []).join(', ')
    const currentKeywords = (portals.title_filter?.positive || []).join(', ')

    const response = await getLlmClient(req).messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      system: `Eres un experto en búsqueda de empleo en ${country.nombre}. Analizas CVs y sugieres los mejores cargos y keywords para encontrar más oportunidades.`,
      messages: [{
        role: 'user',
        content: `Analiza este CV y sugiere cargos objetivo y keywords de búsqueda para el mercado de ${country.nombre}.

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
  "razon": "breve explicación de por qué estos roles son ideales (1-2 frases)",
  "compatibilidad": [
    {"cargo": "especialidad o cargo", "porcentaje": 92}
  ]
}

REGLAS:
- 8-12 roles variados: algunos exactos (Analista SQL), otros amplios (Data Analyst)
- De esos roles, incluye SIEMPRE al menos 3-4 en INGLÉS (ej. junto a "Analista de Datos" agrega también "Data Analyst"), sin importar el idioma del país — sirven para buscar en portales y empresas internacionales/remotas
- 10-15 keywords tecnológicas del CV + variaciones (SQL Server → SQL, MSSQL, T-SQL)
- 5-8 keywords negativas para evitar roles no deseados (call center, ventas, soporte L1 básico)
- 5-6 queries: mezcla de rol + tecnología + "${country.nombre}" o "remoto"
- "compatibilidad": 3-5 especialidades/cargos con un puntaje 0-100 QUE NO tiene que sumar 100 entre todos — cada puntaje es la confianza independiente de qué tan bien calza el CV con esa especialidad puntual. Ordena de mayor a menor; el primero es la especialidad principal del candidato. No inventes especialidades sin evidencia real en el CV (experiencia, proyectos o estudios que la respalden)
- Cada rol se escribe en su propio idioma (los en español, en español; los en inglés del punto anterior, en inglés). El resto (keywords, razón, cargos de compatibilidad) va en ${country.idioma === 'en' ? 'inglés' : 'español'} profesional`,
      }],
    })

    const text = response.content.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('')
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    let suggestions: Record<string, unknown> = {}
    if (jsonMatch) { try { suggestions = JSON.parse(jsonMatch[0]) } catch { /* empty */ } }

    // Defensivo: clamp 0-100, orden desc, máx 5 — mismo problema que tuvo el score
    // de evaluateJob (escala 1-10 mostrada como "6.2/5") si no se sanea acá.
    const rawCompat = suggestions.compatibilidad
    if (Array.isArray(rawCompat)) {
      suggestions.compatibilidad = rawCompat
        .filter((r): r is { cargo: string; porcentaje: number } =>
          !!r && typeof r.cargo === 'string' && typeof r.porcentaje === 'number')
        .map(r => ({ cargo: r.cargo, porcentaje: Math.max(0, Math.min(100, Math.round(r.porcentaje))) }))
        .sort((a, b) => b.porcentaje - a.porcentaje)
        .slice(0, 5)
    } else {
      suggestions.compatibilidad = []
    }

    res.json({ ok: true, suggestions })
  } catch (err: unknown) {
    if (!res.headersSent) res.status((err as {status?:number}).status ?? 500).json({ error: friendlyAiError(err, getProviderFromRequest(req)) })
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
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
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
    res.status((err as {status?:number}).status ?? 500).json({ error: (err as Error).message })
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

// Indeed Chile: parse título + data-jk desde el <span title id="jobTitle-{jk}">,
// empresa desde data-testid="company-name" y ubicación desde data-testid="text-location".
// El markup viejo (class="jobTitle"/"companyName") ya no existe — Indeed movió el título
// real a un span anidado y usa data-testid en vez de clases fijas para todo lo demás.
function parseIndeed(html: string, baseScore: (t: string) => number, positive: string[], negative: string[], razon: string): JobResult[] {
  const results: JobResult[] = []
  const titleMatches = [...html.matchAll(/id="jobTitle-([a-f0-9]+)"[^>]*>([^<]+)<\/span>/gi)]
    .map(m => ({ jk: m[1], title: m[2].replace(/\s+/g, ' ').trim() }))
    .filter(m => m.title.length > 2)
  const compMatches  = [...html.matchAll(/data-testid="company-name"[^>]*>([^<]*(?:<[^>]+>[^<]*)*?)<\/[a-z]+>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
  const locMatches   = [...html.matchAll(/data-testid="text-location"[^>]*>([^<]+)<\//gi)]
    .map(m => m[1].replace(/\s+/g, ' ').trim())
  const seen = new Set<string>()
  for (let i = 0; i < titleMatches.length; i++) {
    const { jk, title } = titleMatches[i]
    if (!title || seen.has(title.toLowerCase()) || !kwMatch(title, positive, negative)) continue
    seen.add(title.toLowerCase())
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

/**
 * Carga una página SPA con Chrome headless y devuelve el HTML completo.
 * Usado para portales que renderizan con JavaScript (Trabajando, YWork, Laborum, etc.)
 * Reusa svc.launchBrowser() — el mismo lanzador que usa la generación de PDF, que ya
 * sabe usar @sparticuz/chromium-min en producción (Vercel) y Chrome local en desarrollo.
 * findChrome()/CHROME_PATHS local que había antes solo funcionaba en desarrollo — en
 * producción (Linux serverless) esas rutas nunca existen y el escaneo fallaba en silencio.
 */
async function scrapeWithBrowser(url: string, waitMs = 3000): Promise<string> {
  const browser = await svc.launchBrowser()
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

// Laborum (Chile/Bumeran fusionados): parsea el HTML ya renderizado por Chrome headless
// (la página es una SPA — un fetch plano solo devuelve el shell vacío). Cada tarjeta usa
// clases de styled-components que rotan en cada deploy de Laborum, así que en vez de
// depender de nombres de clase se ancla al patrón de tags estable dentro del bloque:
// <h3>fecha</h3> ... <h2>título</h2> ... <h3>empresa</h3>. El recorte de cada tarjeta se
// hace por posición (hasta el siguiente <a href="/empleos/...">, tope 4000 chars) en vez
// de un regex con lookahead+cuantificador perezoso — con tarjetas grandes (>2000 chars)
// esa combinación nunca cierra el match y silenciosamente no encuentra nada.
function parseLaborum(html: string, baseScore: (t: string) => number, positive: string[], negative: string[], razon: string, siteBase: string): JobResult[] {
  const results: JobResult[] = []
  const seen = new Set<string>()

  const anchors = [...html.matchAll(/<a[^>]+href="(\/empleos\/[^"#?]+\.html)"[^>]*>/g)]
  for (let i = 0; i < anchors.length; i++) {
    const href = anchors[i][1]
    const start = anchors[i].index! + anchors[i][0].length
    const end = i + 1 < anchors.length ? Math.min(anchors[i + 1].index!, start + 4000) : Math.min(html.length, start + 4000)
    const block = html.slice(start, end)

    const titulo = block.match(/<h2[^>]*>([^<]{2,150})<\/h2>/)?.[1]?.trim()
    if (!titulo || !kwMatch(titulo, positive, negative)) continue
    if (seen.has(titulo.toLowerCase())) continue
    seen.add(titulo.toLowerCase())
    const h3s = [...block.matchAll(/<h3[^>]*>([^<]{2,150})<\/h3>/g)].map(x => x[1].trim())
    // El primer <h3> del bloque es la fecha ("Actualizado hace..."), el siguiente es la empresa
    const empresa = h3s.find(t => !/^(actualizado|publicado)/i.test(t)) || '—'
    results.push({ titulo, empresa, url: `${siteBase}${href}`, ubicacion: 'Chile', match_score: baseScore(titulo), razon })
  }

  return results
}

// GetOnBoard: parsea la página de resultados /empleos-{query} (server-rendered, sin
// necesidad de Chrome). Cada oferta es un <a class="results-item" href="...">, con el
// título en <h4 class="results-list-title"><strong> y la empresa en el atributo alt del
// logo (<img alt="Empresa" class="results-avatar">) — más estable que cavar entre <strong>
// anidados. Recorte de tarjeta por posición, igual que Laborum, por la misma razón.
function parseGetOnBoard(html: string, baseScore: (t: string) => number, positive: string[], negative: string[], razon: string): JobResult[] {
  const results: JobResult[] = []
  const seen = new Set<string>()

  const anchors = [...html.matchAll(/<a class="results-item[^"]*"[^>]*href="([^"]+)"[^>]*>/g)]
  for (let i = 0; i < anchors.length; i++) {
    const url = anchors[i][1]
    const start = anchors[i].index! + anchors[i][0].length
    const end = i + 1 < anchors.length ? Math.min(anchors[i + 1].index!, start + 3000) : Math.min(html.length, start + 3000)
    const block = html.slice(start, end)

    const titulo = block.match(/results-list-title"[^>]*>\s*<strong[^>]*>([^<]{2,150})<\/strong>/)?.[1]?.trim()
    if (!titulo || !kwMatch(titulo, positive, negative)) continue
    if (seen.has(titulo.toLowerCase())) continue
    seen.add(titulo.toLowerCase())
    const empresa = block.match(/<img alt="([^"]*)"[^>]*results-avatar/)?.[1]?.trim() || '—'
    const locRaw = block.match(/class="location">\s*<span[^>]*>\s*([^<]+)/)?.[1]
    const ubicacionCiudad = locRaw?.replace(/&nbsp;?/gi, ' ').replace(/\s+/g, ' ').trim()
    // Ubicaciones fuera de Chile aparecen como "Remoto (País)" o la ciudad seguida del
    // país entre paréntesis — se filtran las que declaran explícitamente otro país,
    // salvo que sea remoto (igual que el filtro original basado en la API).
    const isRemoto = /remoto/i.test(block)
    const otherCountryMatch = block.match(/\((Colombia|México|Perú|Argentina|Brasil|Ecuador|Uruguay|Panamá|Costa Rica|España|Venezuela|Bolivia|Paraguay)\)/i)
    if (otherCountryMatch && !isRemoto) continue
    results.push({
      titulo, empresa,
      url: url.startsWith('http') ? url : `https://www.getonbrd.com${url}`,
      ubicacion: isRemoto ? 'Remoto' : (ubicacionCiudad || 'Chile'),
      match_score: baseScore(titulo), razon,
    })
  }

  return results
}

// ── Scanner con SSE ───────────────────────────────────────────────────────────

export const scanPortals = async (req: Request, res: Response) => {
  const _req = req
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // El botón "Detener" del frontend aborta el fetch del lado del cliente, pero sin esto
  // el for-loop de portales seguía corriendo del lado del servidor (gastando tiempo y
  // cuotas en portales reales) aunque ya nadie estuviera escuchando — el usuario veía
  // "Detener" sin efecto real porque el escaneo seguía avanzando en el fondo.
  let clientDisconnected = false
  res.on('close', () => { clientDisconnected = true })

  const send = (event: string, data: unknown) => {
    if (clientDisconnected) return
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const { email: userEmail, userId } = await getUser(req)
    await requireActiveSubscription(userId)
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

    // La página Portales es la fuente de verdad: se escanea exactamente lo que el
    // usuario tiene agregado y activado ahí, ni más ni menos. Antes se forzaba a
    // incluir GetOnBoard/LinkedIn/Indeed/Computrabajo SIEMPRE, incluso si el usuario
    // nunca los había agregado (o los había apagado) — el escáner terminaba golpeando
    // portales invisibles para el usuario en la UI, sin forma de sacarlos. Solo se usa
    // este set de 4 como default de arranque para una cuenta que todavía no configuró
    // ningún portal (tracked_companies vacío) — una vez que el usuario tiene su propia
    // lista, esa lista manda por completo.
    const BASE_PORTALS = [
      { name: 'GetOnBoard', careers_url: 'https://www.getonbrd.com', enabled: true },
      { name: 'LinkedIn Chile', careers_url: 'https://www.linkedin.com/jobs/', enabled: true },
      { name: 'Indeed Chile', careers_url: 'https://cl.indeed.com', enabled: true },
      { name: 'Computrabajo Chile', careers_url: 'https://cl.computrabajo.com', enabled: true },
    ]
    const configuredPortals = (portalsConfig.tracked_companies || []).filter(p => p.enabled)
    const portals = configuredPortals.length > 0 ? configuredPortals : BASE_PORTALS

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
      if (clientDisconnected) break
      send('portal', { nombre: portal.name, url: portal.careers_url, estado: 'escaneando' })

      try {
        let ofertas: JobResult[] = []
        const domain = new URL(portal.careers_url).hostname

        const score = (t: string) => kwScore(t, allPositive)

        // ── GetOnBoard: HTML de resultados (la API v0 pública quedó deprecada —
        // ahora responde 401 Unauthorized — así que se cambió a scrapear la página
        // de resultados real /empleos-{query}, que sigue siendo server-rendered) ──
        if (domain.includes('getonbrd.com')) {
          for (const q of portalQueries.slice(0, 5)) {
            try {
              const slug = q.trim().replace(/\s+/g, '-')
              const { data } = await axios.get(`https://www.getonbrd.com/empleos-${encodeURIComponent(slug)}`, {
                timeout: 12000, headers: { ...HEADERS, Accept: 'text/html,*/*;q=0.9' },
              })
              const parsed = parseGetOnBoard(String(data), score, allPositive, negative, `GetOnBoard · "${q}"`)
              ofertas.push(...parsed)
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

        // ── Bumeran Chile / Laborum Chile: Bumeran.cl se fusionó con Laborum y hoy
        // redirige completo al home de laborum.cl (pierde cualquier ruta/búsqueda),
        // así que ambos apuntan siempre a laborum.cl. Laborum ya NO es server-rendered
        // para resultados de búsqueda (devuelve un shell vacío sin JS) — requiere
        // Chrome headless igual que Trabajando/YWork más abajo.
        else if (domain.includes('bumeran.cl') || domain.includes('laborum.cl')) {
          const siteBase = 'https://www.laborum.cl'
          if (domain.includes('bumeran.cl')) {
            send('portal_warn', { nombre: portal.name, nota: 'Bumeran Chile se fusionó con Laborum — mostrando resultados desde laborum.cl' })
          }
          for (const q of portalQueries.slice(0, 3)) {
            try {
              const slug = q.toLowerCase()
                .normalize('NFD').replace(/[̀-ͯ]/g, '')
                .replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-')
              const searchUrl = `${siteBase}/empleos-busqueda-${slug}.html`
              const html = await scrapeWithBrowser(searchUrl, 3500)
              const parsed = parseLaborum(html, score, allPositive, negative, `${portal.name} · "${q}"`, siteBase)
              ofertas.push(...parsed)
            } catch (e: unknown) {
              console.warn(`[Scanner] ${portal.name} query "${q}" falló:`, (e as Error).message?.slice(0, 120))
            }
          }
        }

        // ── YWork (yw.cl): el dominio caducó y hoy es una página parqueada de
        // anuncios (redirige a quickresultonline.com) — ya no es un portal de empleo,
        // así que no tiene sentido seguir intentando escanearlo.
        else if (domain.includes('yw.cl')) {
          send('portal_done', { nombre: portal.name, encontradas: 0, agregadas: 0, ofertas: [], nota: 'Este dominio ya no es un portal de empleo (caducado/parqueado) — no se puede escanear' })
        }

        // ── Trabajando.cl: SPA — cargamos con Chrome headless ────────────────
        else if (domain.includes('trabajando.cl')) {
          for (const q of portalQueries.slice(0, 3)) {
            try {
              const searchUrl = `https://www.trabajando.cl/busqueda?q=${encodeURIComponent(q)}&pub_date=7`
              const html = await scrapeWithBrowser(searchUrl, 4000)
              // Parsear títulos y links de la página cargada
              const parsed = parseSpaPortal(html, score, allPositive, negative, `${portal.name} · "${q}"`, `https://www.${domain}`)
              ofertas.push(...parsed)
            } catch (e: unknown) {
              console.warn(`[Scanner] ${portal.name} query "${q}" falló:`, (e as Error).message?.slice(0, 120))
            }
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
    send('error', { error: friendlyAiError(err, getProviderFromRequest(req)) })
  } finally {
    res.end()
  }
}

// ── Parse CV ──────────────────────────────────────────────────────────────────

export const parseCv = async (req: Request, res: Response) => {
  try {
    const { email: userEmail, userId } = await getUser(req)
    await requireActiveSubscription(userId)
    const file = (req as Request & { file?: Express.Multer.File }).file
    if (!file) return res.status(400).json({ error: 'No se recibió ningún archivo.' })

    let rawText = ''
    const mime = file.mimetype

    if (mime === 'application/pdf') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>
      const parsed = await pdfParse(file.buffer)
      rawText = parsed.text
    } else if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword'
    ) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth') as { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> }
      const result = await mammoth.extractRawText({ buffer: file.buffer })
      rawText = result.value
    } else if (mime === 'text/plain') {
      rawText = file.buffer.toString('utf-8')
    } else {
      return res.status(400).json({ error: 'Formato no soportado. Sube un PDF, DOCX o TXT.' })
    }

    if (!rawText.trim()) return res.status(400).json({ error: 'No se pudo extraer texto del archivo.' })

    const client = getLlmClient(req)
    const sourceLang = detectLanguage(rawText)

    const prompt = `Eres un extractor de datos de CVs para un buscador de empleo internacional. Analiza el siguiente CV y devuelve UN ÚNICO objeto JSON con esta estructura exacta (sin texto adicional, solo el JSON):

{
  "candidate": {
    "full_name": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "github": "",
    "portfolio_url": ""
  },
  "narrative": {
    "headline": "",
    "exit_story": "",
    "superpowers": []
  },
  "target_roles": {
    "primary": []
  },
  "compensation": {
    "target_range": "",
    "currency": "",
    "minimum": "",
    "location_flexibility": ""
  },
  "location": {
    "city": "",
    "timezone": "",
    "visa_status": "",
    "country": ""
  },
  "search_config": {
    "keywords_positive": [],
    "keywords_negative": [],
    "search_queries": []
  },
  "cv_markdown": ""
}

Instrucciones:
- "headline": título profesional breve (ej: "Senior DBA | SQL Server · Azure · ETL")
- "exit_story": resumen profesional o perfil del candidato si existe en el CV
- "superpowers": array de habilidades/tecnologías clave (máx 8), una por elemento
- "target_roles.primary": array de títulos de cargo exactos para buscar (ej: ["Analista de Base de Datos", "DBA SQL Server", "Data Engineer"]) — infiere 4-6 roles realistas según la experiencia
- "search_config.keywords_positive": tecnologías y skills del candidato útiles para filtrar ofertas (ej: ["SQL Server", "T-SQL", "Azure", "ETL"]) — máx 15
- "search_config.keywords_negative": palabras que descartan ofertas no relevantes (ej: ["Call Center", "Ventas", "Telemarketing", "Junior"]) — máx 10, infiere según el perfil
- "search_config.search_queries": array de 4-6 objetos con formato {"name": "Nombre corto", "query": "consulta de búsqueda para portales de empleo"} — combina rol + tecnología + ubicación (ej: "DBA SQL Server Senior Chile")
- "cv_markdown": el CV COMPLETO formateado en Markdown con toda la experiencia, educación, habilidades y logros
- Si un campo no está disponible, deja string vacío o array vacío
- No inventes información que no esté en el CV
- IDIOMA (obligatorio): el CV original está en ${sourceLang === 'en' ? 'INGLÉS' : 'ESPAÑOL'}. Escribe "headline", "exit_story" y "cv_markdown" en ESE MISMO IDIOMA — NO traduzcas el contenido, solo extráelo y ordénalo.

CV A ANALIZAR:
${rawText.substring(0, 8000)}`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const fullText = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    let parsed: Record<string, unknown> = {}
    const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/) ||
                      fullText.match(/```\s*({[\s\S]*?})\s*```/)
    if (jsonMatch?.[1]) {
      try { parsed = JSON.parse(jsonMatch[1]) } catch { /* fallback below */ }
    }
    if (!Object.keys(parsed).length) {
      const start = fullText.indexOf('{')
      const end = fullText.lastIndexOf('}')
      if (start !== -1 && end !== -1) {
        try { parsed = JSON.parse(fullText.substring(start, end + 1)) } catch { /* ignore */ }
      }
    }

    console.log(`[parse-cv] ${userEmail} — extraídos ${rawText.length} chars`)
    res.json({ ok: true, data: parsed })
  } catch (err: unknown) {
    const provider = getProviderFromRequest(req)
    const msg = friendlyAiError(err, normalizeProvider(provider))
    res.status((err as {status?:number}).status ?? 500).json({ error: msg })
  }
}
