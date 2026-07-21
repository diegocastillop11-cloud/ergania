import { Request, Response } from 'express'
import crypto from 'crypto'
import { supabaseAdmin } from '../config/supabase'
import * as svc from '../services/subscriptionService'
import * as paypalSvc from '../services/paypalService'

function verifyMPSignature(req: Request): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) return true // verificación no configurada aún — permitir

  const sig = req.headers['x-signature'] as string | undefined
  const reqId = req.headers['x-request-id'] as string | undefined
  const dataId = (req.query['data.id'] || req.query.id) as string | undefined
  if (!sig || !reqId || !dataId) return false

  const ts = sig.match(/ts=(\d+)/)?.[1]
  const v1 = sig.match(/v1=([a-f0-9]+)/)?.[1]
  if (!ts || !v1) return false

  const manifest = `id:${dataId};request-id:${reqId};ts:${ts};`
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(v1, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

async function getUserFromToken(req: Request) {
  if (!supabaseAdmin) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados en Vercel')
  const auth = req.headers['authorization']
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) throw new Error('Token requerido')
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) {
    console.error('[sub/auth] getUser error:', error?.message, '| token prefix:', token.substring(0, 20))
    throw new Error(`Token inválido: ${error?.message}`)
  }
  return data.user
}

export async function getStatus(req: Request, res: Response) {
  try {
    const user = await getUserFromToken(req)
    console.log('[getStatus] user.id:', user.id)
    const status = await svc.getOrCreateSubscription(user.id, user.email)
    const computed = await svc.getSubscriptionStatus(user.id)
    res.json({ subscription: status, computed })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    console.error('[getStatus] catch:', msg)
    const isAuthError = msg.includes('Token') || msg.includes('requerido') || msg.includes('configurados')
    res.status(isAuthError ? 401 : 500).json({ error: msg })
  }
}

export async function createCheckout(req: Request, res: Response) {
  try {
    const user = await getUserFromToken(req)
    if (!user.email) throw new Error('Usuario sin email')
    const result = await svc.createCheckoutLink(user.id, user.email)
    res.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    res.status(400).json({ error: msg })
  }
}

export async function createPayPalCheckout(req: Request, res: Response) {
  try {
    const user = await getUserFromToken(req)
    if (!user.email) throw new Error('Usuario sin email')
    const result = await paypalSvc.createPayPalCheckoutLink(user.id, user.email)
    res.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    res.status(400).json({ error: msg })
  }
}

export async function cancelSub(req: Request, res: Response) {
  try {
    const user = await getUserFromToken(req)
    await svc.cancelSubscription(user.id)
    res.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    res.status(400).json({ error: msg })
  }
}

// Vercel Cron (diario) — auth por CRON_SECRET, no por token de usuario
export async function reminders(req: Request, res: Response) {
  const secret = process.env.CRON_SECRET
  // Header: Vercel Cron. Query ?key=: prueba manual desde el navegador.
  const authorized = secret && (req.headers['authorization'] === `Bearer ${secret}` || req.query.key === secret)
  if (!authorized) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  try {
    const result = await svc.sendExpiryReminders()
    console.log('[reminders]', JSON.stringify(result))
    res.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    console.error('[reminders] catch:', msg)
    res.status(500).json({ error: msg })
  }
}

// Vercel Cron (diario) — mismo mecanismo de auth que reminders
export async function signupDigest(req: Request, res: Response) {
  const secret = process.env.CRON_SECRET
  const authorized = secret && (req.headers['authorization'] === `Bearer ${secret}` || req.query.key === secret)
  if (!authorized) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  try {
    const result = await svc.sendPendingSignupDigest()
    console.log('[signup-digest]', JSON.stringify(result))
    res.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    console.error('[signup-digest] catch:', msg)
    res.status(500).json({ error: msg })
  }
}

// Vercel Cron (diario) — mismo mecanismo de auth que signupDigest
export async function revertPending(req: Request, res: Response) {
  const secret = process.env.CRON_SECRET
  const authorized = secret && (req.headers['authorization'] === `Bearer ${secret}` || req.query.key === secret)
  if (!authorized) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  try {
    const result = await svc.revertStalePendingPayments()
    console.log('[revert-pending]', JSON.stringify(result))
    res.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    console.error('[revert-pending] catch:', msg)
    res.status(500).json({ error: msg })
  }
}

// Vercel Cron (diario) — mismo mecanismo de auth que revertPending
export async function expireTrials(req: Request, res: Response) {
  const secret = process.env.CRON_SECRET
  const authorized = secret && (req.headers['authorization'] === `Bearer ${secret}` || req.query.key === secret)
  if (!authorized) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  try {
    const result = await svc.expireStaleTrials()
    console.log('[expire-trials]', JSON.stringify(result))
    res.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    console.error('[expire-trials] catch:', msg)
    res.status(500).json({ error: msg })
  }
}

// Vercel Cron (2x/día) — mismo mecanismo de auth que expireTrials. Red de
// seguridad si un webhook de pago no llega (ver reconcile* en los services).
export async function reconcile(req: Request, res: Response) {
  const secret = process.env.CRON_SECRET
  const authorized = secret && (req.headers['authorization'] === `Bearer ${secret}` || req.query.key === secret)
  if (!authorized) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  try {
    const [pp, mp] = await Promise.all([
      paypalSvc.reconcilePayPalSubscriptions(),
      svc.reconcileMercadoPagoPayments(),
    ])
    const fixed = [...pp.fixed, ...mp.fixed]
    console.log('[reconcile]', JSON.stringify({ checked: pp.checked + mp.checked, fixed: fixed.length }))
    if (fixed.length > 0) {
      const { sendReconciliationAlert } = await import('../services/emailService')
      await sendReconciliationAlert(fixed)
    }
    res.json({ checked: pp.checked + mp.checked, fixed })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    console.error('[reconcile] catch:', msg)
    res.status(500).json({ error: msg })
  }
}

// MercadoPago IPN — no auth, MP signs the request
export async function webhook(req: Request, res: Response) {
  if (!verifyMPSignature(req)) {
    console.warn('[webhook] Firma MP inválida — ignorando')
    return res.sendStatus(200) // 200 para evitar reintentos de MP
  }
  try {
    const topic = (req.query.topic || req.query.type) as string
    const id    = (req.query.id || req.query['data.id']) as string
    if (topic && id) await svc.handleWebhook(topic, id)
    res.sendStatus(200)
  } catch {
    res.sendStatus(200) // always 200 to avoid MP retries on logic errors
  }
}

// PayPal webhook — verificación propia (verify-webhook-signature), no reusa verifyMPSignature
export async function paypalWebhook(req: Request, res: Response) {
  try {
    await paypalSvc.handlePayPalWebhook(req)
    res.sendStatus(200)
  } catch (err) {
    console.error('[paypal webhook] catch:', err instanceof Error ? err.message : err)
    res.sendStatus(200) // always 200 to avoid PayPal retries on logic errors
  }
}
