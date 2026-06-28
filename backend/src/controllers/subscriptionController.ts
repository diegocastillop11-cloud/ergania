import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import * as svc from '../services/subscriptionService'

async function getUserFromToken(req: Request) {
  if (!supabaseAdmin) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados en Vercel')
  const auth = req.headers['authorization']
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) throw new Error('Token requerido')
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) throw new Error(`Token inválido: ${error?.message}`)
  return data.user
}

export async function getStatus(req: Request, res: Response) {
  try {
    const user = await getUserFromToken(req)
    const status = await svc.getOrCreateSubscription(user.id)
    const computed = await svc.getSubscriptionStatus(user.id)
    res.json({ subscription: status, computed })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    res.status(401).json({ error: msg })
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

// MercadoPago IPN — no auth, MP signs the request
export async function webhook(req: Request, res: Response) {
  try {
    const topic = (req.query.topic || req.query.type) as string
    const id    = (req.query.id || req.query['data.id']) as string
    if (topic && id) await svc.handleWebhook(topic, id)
    res.sendStatus(200)
  } catch {
    res.sendStatus(200) // always 200 to avoid MP retries on logic errors
  }
}
