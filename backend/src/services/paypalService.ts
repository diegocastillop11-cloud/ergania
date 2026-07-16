import { Request } from 'express'
import { supabaseAdmin } from '../config/supabase'

const stripBOM = (s: string) => s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s
const PAYPAL_ENV = () => stripBOM(process.env.PAYPAL_ENV || 'sandbox').trim()
const PAYPAL_API = () => PAYPAL_ENV() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
const PAYPAL_CLIENT_ID = () => stripBOM(process.env.PAYPAL_CLIENT_ID || '')
const PAYPAL_CLIENT_SECRET = () => stripBOM(process.env.PAYPAL_CLIENT_SECRET || '')
const PAYPAL_PLAN_ID = () => stripBOM(process.env.PAYPAL_PLAN_ID || '')
const PAYPAL_WEBHOOK_ID = () => stripBOM(process.env.PAYPAL_WEBHOOK_ID || '')
const PROD_URL = 'https://ergania.com'

const BACK_URL = () => {
  const raw = stripBOM(process.env.FRONTEND_URL || '').trim()
  if (!raw || raw.includes('localhost') || !raw.startsWith('https://')) return PROD_URL
  return raw.replace(/\/$/, '')
}

// Cache en memoria — el token de client_credentials dura ~9h, no hace sentido
// pedir uno nuevo en cada request.
let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 10_000) return cachedToken.token

  const clientId = PAYPAL_CLIENT_ID()
  const clientSecret = PAYPAL_CLIENT_SECRET()
  if (!clientId || !clientSecret) throw new Error('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET no configurados')

  const res = await fetch(`${PAYPAL_API()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`PayPal oauth2 ${res.status}: ${text}`)
  const data = JSON.parse(text)
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return cachedToken.token
}

async function ppFetch(path: string, method: 'GET' | 'POST', body?: object) {
  const token = await getAccessToken()
  const res = await fetch(`${PAYPAL_API()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`PayPal ${path} ${res.status}: ${text}`)
  return text ? JSON.parse(text) : {}
}

export async function createPayPalCheckoutLink(userId: string, userEmail: string) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  const planId = PAYPAL_PLAN_ID()
  if (!planId) throw new Error('PAYPAL_PLAN_ID no configurado')

  const subscription = await ppFetch('/v1/billing/subscriptions', 'POST', {
    plan_id: planId,
    custom_id: userId,
    subscriber: { email_address: userEmail },
    application_context: {
      brand_name: 'Ergania',
      return_url: `${BACK_URL()}/subscription/success`,
      cancel_url: `${BACK_URL()}/subscription/failure`,
      user_action: 'SUBSCRIBE_NOW',
    },
  })

  const approveLink = (subscription.links as Array<{ rel: string; href: string }> | undefined)
    ?.find(l => l.rel === 'approve')?.href
  if (!approveLink) throw new Error('PayPal no devolvió link de aprobación')

  await supabaseAdmin.from('subscriptions').upsert(
    {
      user_id: userId,
      status: 'pending_payment',
      payment_provider: 'paypal',
      paypal_subscription_id: subscription.id,
      paypal_payer_email: userEmail,
    },
    { onConflict: 'user_id' }
  )

  return { checkoutUrl: approveLink }
}

async function verifyPayPalSignature(req: Request): Promise<boolean> {
  const webhookId = PAYPAL_WEBHOOK_ID()
  if (!webhookId) return true // verificación no configurada aún — permitir (mismo criterio que MP_WEBHOOK_SECRET)

  const transmissionId = req.headers['paypal-transmission-id'] as string | undefined
  const transmissionTime = req.headers['paypal-transmission-time'] as string | undefined
  const certUrl = req.headers['paypal-cert-url'] as string | undefined
  const authAlgo = req.headers['paypal-auth-algo'] as string | undefined
  const transmissionSig = req.headers['paypal-transmission-sig'] as string | undefined
  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) return false

  try {
    const result = await ppFetch('/v1/notifications/verify-webhook-signature', 'POST', {
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: webhookId,
      webhook_event: req.body,
    })
    return result.verification_status === 'SUCCESS'
  } catch {
    return false
  }
}

// Mapeo puro event_type → status local, sin efectos secundarios — testeable en aislamiento.
export function mapPayPalEventToStatus(eventType: string): 'active' | 'cancelled' | null {
  if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') return 'active'
  if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED') return 'cancelled'
  return null
}

export async function handlePayPalWebhook(req: Request) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')

  const verified = await verifyPayPalSignature(req)
  if (!verified) {
    console.warn('[paypal webhook] Firma inválida — ignorando')
    return
  }

  const event = req.body as { event_type: string; resource: Record<string, any> }
  const { event_type: eventType, resource } = event
  if (!eventType || !resource) return

  const mappedStatus = mapPayPalEventToStatus(eventType)

  if (mappedStatus === 'active') {
    const userId = resource.custom_id
    if (!userId) return
    const periodEnd = new Date()
    periodEnd.setDate(periodEnd.getDate() + 30)
    await supabaseAdmin.from('subscriptions').update({
      status: 'active',
      payment_provider: 'paypal',
      paypal_subscription_id: resource.id,
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
    return
  }

  if (mappedStatus === 'cancelled') {
    const paypalSubId = resource.id
    if (!paypalSubId) return
    await supabaseAdmin.from('subscriptions').update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    }).eq('paypal_subscription_id', paypalSubId)
    return
  }

  // Cobro recurrente aprobado — extiende el período y registra el comprobante.
  if (eventType === 'PAYMENT.SALE.COMPLETED') {
    const paypalSubId = resource.billing_agreement_id
    if (!paypalSubId) return

    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id')
      .eq('paypal_subscription_id', paypalSubId)
      .single()
    if (!sub) return

    const periodEnd = new Date()
    periodEnd.setDate(periodEnd.getDate() + 30)
    await supabaseAdmin.from('subscriptions').update({
      status: 'active',
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('user_id', sub.user_id)

    const monto = Number(resource.amount?.total ?? 0)
    const fecha = new Date().toISOString().slice(0, 10)
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(sub.user_id)
    const userEmail = userData?.user?.email || 'desconocido'

    const { data: receipt } = await supabaseAdmin.from('payment_receipts').insert({
      user_id: sub.user_id,
      user_email: userEmail,
      monto,
      moneda: 'USD',
      plan: 'Ergania — Plan mensual',
      provider: 'paypal',
      paypal_subscription_id: paypalSubId,
      fecha,
    }).select().single()

    const { sendPaymentNotification, sendSubscriptionConfirmation } = await import('./emailService')
    sendPaymentNotification(sub.user_id, paypalSubId, monto, userEmail, 'USD')
      .catch(err => console.error('[paypal webhook] Error enviando notificación admin:', err))

    if (userEmail !== 'desconocido') {
      sendSubscriptionConfirmation(userEmail, { monto, moneda: 'USD', plan: 'Ergania — Plan mensual', fecha, paymentId: paypalSubId })
        .then(() => { if (receipt?.id) return supabaseAdmin!.from('payment_receipts').update({ email_sent: true }).eq('id', receipt.id) })
        .catch(err => console.error('[paypal webhook] Error enviando confirmación al usuario:', err))
    }
  }
}
