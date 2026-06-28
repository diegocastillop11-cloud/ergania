import { supabaseAdmin } from '../config/supabase'

const stripBOM = (s: string) => s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s
const MP_TOKEN = () => stripBOM(process.env.MERCADOPAGO_ACCESS_TOKEN || '')
const MP_API   = 'https://api.mercadopago.com'
const BACK_URL = () => {
  const raw = stripBOM(process.env.FRONTEND_URL || '')
  // Rechazar localhost o http:// — MP exige HTTPS público
  if (!raw || raw.includes('localhost') || !raw.startsWith('https://')) {
    return 'https://career-ops-ui-gules.vercel.app'
  }
  return raw.replace(/\/$/, '') // quitar trailing slash
}
const TRIAL_DAYS   = 3
const PLAN_AMOUNT  = 9990
const PLAN_CURRENCY = 'CLP'

async function mpFetch(path: string, method: 'GET' | 'POST' | 'PUT', body?: object) {
  const res = await fetch(`${MP_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${MP_TOKEN()}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`MercadoPago ${res.status}: ${text}`)
  return JSON.parse(text)
}

export async function getOrCreateSubscription(userId: string) {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (data) return data

  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS)

  const { data: created, error } = await supabaseAdmin
    .from('subscriptions')
    .insert({ user_id: userId, status: 'trial', trial_ends_at: trialEndsAt.toISOString() })
    .select()
    .single()

  if (error) throw error
  return created
}

export async function getSubscriptionStatus(userId: string) {
  let { data } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!data) return { status: 'none' as const, daysLeft: 0 }

  const now = new Date()

  if (data.status === 'trial') {
    const end = new Date(data.trial_ends_at)
    if (now > end) {
      await supabaseAdmin.from('subscriptions').update({ status: 'expired' }).eq('user_id', userId)
      return { status: 'expired' as const, daysLeft: 0 }
    }
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86_400_000)
    return { status: 'trial' as const, daysLeft, trialEndsAt: data.trial_ends_at }
  }

  if (data.status === 'active') {
    return {
      status: 'active' as const,
      daysLeft: null,
      currentPeriodEnd: data.current_period_end,
    }
  }

  return { status: data.status as 'expired' | 'cancelled' | 'pending_payment', daysLeft: 0 }
}

export async function createCheckoutLink(userId: string, userEmail: string) {
  if (!MP_TOKEN()) throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado')

  const preference = await mpFetch('/checkout/preferences', 'POST', {
    items: [{
      title: 'Ergania — Plan mensual',
      quantity: 1,
      unit_price: PLAN_AMOUNT,
      currency_id: PLAN_CURRENCY,
    }],
    payer: { email: userEmail },
    back_urls: {
      success: `${BACK_URL()}/subscription/success`,
      failure: `${BACK_URL()}/subscription/failure`,
      pending: `${BACK_URL()}/subscription/pending`,
    },
    auto_return: 'approved',
    metadata: { user_id: userId },
    notification_url: `${BACK_URL()}/api/subscription/webhook`,
  })

  await supabaseAdmin.from('subscriptions').upsert(
    { user_id: userId, mp_payer_email: userEmail, status: 'pending_payment', mp_preference_id: preference.id },
    { onConflict: 'user_id' }
  )

  return { checkoutUrl: preference.init_point as string }
}

export async function handleWebhook(topic: string, id: string) {
  if (topic !== 'payment') return

  const payment = await mpFetch(`/v1/payments/${id}`, 'GET')

  const userId = payment.metadata?.user_id
  if (!userId || payment.status !== 'approved') return

  const periodEnd = new Date()
  periodEnd.setDate(periodEnd.getDate() + 30)

  await supabaseAdmin.from('subscriptions').update({
    status: 'active',
    mp_payment_id: String(payment.id),
    current_period_end: periodEnd.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId)
}

export async function cancelSubscription(userId: string) {
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  if (error) throw error
}
