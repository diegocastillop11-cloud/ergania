import { Request, Response } from 'express'
import axios from 'axios'
import { supabaseAdmin } from '../config/supabase'
import * as svc from '../services/careerOpsService'
import { sendJobAlertDigest } from '../services/emailService'
import { getUser, requireActiveSubscription, parseGetOnBoard, kwScore, JobResult } from './careersController'

// Solo GetOnBoard: es el único portal del Escáner con HTML estable y sin bloqueo anti-bot.
// Sumar LinkedIn/Indeed al correo diario multiplicaría los fallos silenciosos (no hay monitoreo).
const SITE = 'https://www.ergania.com'
const MAX_USERS_PER_RUN = 25
const RUN_BUDGET_MS = 240_000
const MAX_JOBS_PER_EMAIL = 8
const MAX_SEEN_URLS = 300
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface AlertRow { user_email: string; user_id: string; unsubscribe_token: string; seen_urls: string[] }

export const getAlerts = async (req: Request, res: Response) => {
  try {
    const { email } = await getUser(req)
    const { data, error } = await supabaseAdmin!.from('job_alerts').select('enabled').eq('user_email', email.toLowerCase()).maybeSingle()
    if (error) throw new Error(error.message)
    res.json({ enabled: !!data?.enabled })
  } catch (e: unknown) {
    console.error('getAlerts error:', e)
    res.status((e as { status?: number }).status ?? 500).json({ error: 'No se pudo leer la configuración de alertas' })
  }
}

export const setAlerts = async (req: Request, res: Response) => {
  try {
    const { email, userId } = await getUser(req)
    await requireActiveSubscription(userId)
    const enabled = req.body?.enabled === true
    const { error } = await supabaseAdmin!.from('job_alerts')
      .upsert({ user_email: email.toLowerCase(), user_id: userId, enabled }, { onConflict: 'user_email' })
    if (error) throw new Error(error.message)
    res.json({ enabled })
  } catch (e: unknown) {
    console.error('setAlerts error:', e)
    res.status((e as { status?: number }).status ?? 500).json({ error: (e as Error).message || 'No se pudo guardar' })
  }
}

// Público: enlace del correo. Sin sesión; el token (uuid aleatorio) identifica la fila.
export const unsubscribeAlerts = async (req: Request, res: Response) => {
  const token = String(req.query.token || '')
  let ok = false
  if (UUID_RE.test(token)) {
    const { error } = await supabaseAdmin!.from('job_alerts').update({ enabled: false }).eq('unsubscribe_token', token)
    ok = !error
  }
  res.status(ok ? 200 : 400).type('html').send(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Alertas de Ergania</title>
    <body style="font-family:Arial,sans-serif;max-width:480px;margin:80px auto;padding:0 20px;text-align:center;color:#222;">
    <h2>${ok ? 'Listo, no te enviaremos más alertas' : 'Enlace inválido'}</h2>
    <p>${ok ? 'Puedes volver a activarlas cuando quieras desde el Escáner de Ergania.' : 'Este enlace de baja no es válido. Puedes desactivar las alertas desde el Escáner.'}</p>
    <p><a href="${SITE}/scanner">Ir a Ergania</a></p></body></html>`)
}

async function digestFor(row: AlertRow): Promise<'sent' | 'none' | 'skipped'> {
  try { await requireActiveSubscription(row.user_id) } catch { return 'skipped' }

  const [portalsConfig, profile, applications, tracker] = await Promise.all([
    svc.readPortals(row.user_email),
    svc.readProfile(row.user_email),
    svc.readApplications(row.user_email),
    svc.readTracker(row.user_email),
  ])
  const positive = portalsConfig.title_filter?.positive || []
  const negative = portalsConfig.title_filter?.negative || []
  const targetRoles = (profile.target_roles as Record<string, string[]>) || {}
  const roleQueries = [...(targetRoles.primary || []), ...(targetRoles.secondary || [])].slice(0, 6)
  const queries = roleQueries.length > 0 ? roleQueries : positive.slice(0, 4)
  if (queries.length === 0) return 'skipped'

  const stop = new Set(['de', 'del', 'el', 'la', 'los', 'las', 'en', 'a', 'para', 'y', 'e', 'o', 'con', 'por', 'al'])
  const words = queries.flatMap(q => q.split(/\s+/).filter(w => w.length >= 5 && !stop.has(w.toLowerCase())))
  const allPositive = [...new Set([...positive, ...queries, ...words])]

  const found = new Map<string, JobResult>()
  for (const q of queries.slice(0, 3)) {
    try {
      const slug = q.trim().replace(/\s+/g, '-')
      const { data } = await axios.get(`https://www.getonbrd.com/empleos-${encodeURIComponent(slug)}`, {
        timeout: 12000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', 'Accept-Language': 'es-CL,es;q=0.9' },
      })
      for (const j of parseGetOnBoard(String(data), t => kwScore(t, allPositive), allPositive, negative, `GetOnBoard · "${q}"`)) {
        found.set(j.url, j)
      }
    } catch (e: unknown) {
      console.warn(`[alerts] GetOnBoard "${q}" falló:`, (e as Error).message?.slice(0, 120))
    }
  }

  const known = new Set<string>([
    ...row.seen_urls,
    ...applications.map(a => a.url).filter(Boolean) as string[],
    ...tracker.map(t => t.url).filter(Boolean) as string[],
  ])
  const fresh = [...found.values()].filter(j => !known.has(j.url)).sort((a, b) => b.match_score - a.match_score)
  if (fresh.length === 0) return 'none'

  const toSend = fresh.slice(0, MAX_JOBS_PER_EMAIL)
  await sendJobAlertDigest(row.user_email, toSend, `${SITE}/api/alerts/unsubscribe?token=${row.unsubscribe_token}`)
  const seen = [...row.seen_urls, ...toSend.map(j => j.url)].slice(-MAX_SEEN_URLS)
  await supabaseAdmin!.from('job_alerts').update({ seen_urls: seen, last_sent_at: new Date().toISOString() }).eq('user_email', row.user_email)
  return 'sent'
}

// Vercel Cron (diario) — auth por CRON_SECRET, igual que los demás crons
export const runAlerts = async (req: Request, res: Response) => {
  const secret = process.env.CRON_SECRET
  const authorized = secret && (req.headers['authorization'] === `Bearer ${secret}` || req.query.key === secret)
  if (!authorized) return res.status(401).json({ error: 'No autorizado' })

  const started = Date.now()
  const result = { checked: 0, sent: 0, none: 0, skipped: 0, failed: 0 }
  try {
    // Los nunca revisados primero: sin last_checked_at, usuarios sin ofertas nuevas se
    // quedarían al frente de la cola y dejarían sin turno a los demás.
    const { data, error } = await supabaseAdmin!.from('job_alerts')
      .select('user_email, user_id, unsubscribe_token, seen_urls')
      .eq('enabled', true)
      .order('last_checked_at', { ascending: true, nullsFirst: true })
      .limit(MAX_USERS_PER_RUN)
    if (error) throw new Error(error.message)

    for (const row of (data || []) as AlertRow[]) {
      if (Date.now() - started > RUN_BUDGET_MS) break
      result.checked++
      try {
        result[await digestFor(row)]++
      } catch (e: unknown) {
        result.failed++
        console.error('[alerts] fallo para un usuario:', (e as Error).message)
      }
      await supabaseAdmin!.from('job_alerts').update({ last_checked_at: new Date().toISOString() }).eq('user_email', row.user_email)
    }
    console.log('[alerts]', JSON.stringify(result))
    res.json(result)
  } catch (e: unknown) {
    console.error('[alerts] catch:', (e as Error).message)
    res.status(500).json({ error: (e as Error).message })
  }
}
