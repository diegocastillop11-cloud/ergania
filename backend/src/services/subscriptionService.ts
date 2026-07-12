import { supabaseAdmin } from '../config/supabase'
import { calendarDaysUntil } from '../utils/days'

const stripBOM = (s: string) => s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s
const MP_TOKEN = () => stripBOM(process.env.MERCADOPAGO_ACCESS_TOKEN || '')
const MP_API   = 'https://api.mercadopago.com'
const PROD_URL = 'https://ergania.com'

const BACK_URL = () => {
  const raw = stripBOM(process.env.FRONTEND_URL || '').trim()
  if (!raw || raw.includes('localhost') || !raw.startsWith('https://')) return PROD_URL
  return raw.replace(/\/$/, '')
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
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  const { data, error: selectErr } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  // PGRST116 = no rows found — normal case for new users
  if (selectErr && selectErr.code !== 'PGRST116') {
    console.error('[sub/select] error:', selectErr.message, selectErr.code)
    throw new Error(`DB error: ${selectErr.message}`)
  }
  if (data) return data

  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS)

  const { data: created, error } = await supabaseAdmin
    .from('subscriptions')
    .insert({ user_id: userId, status: 'trial', trial_ends_at: trialEndsAt.toISOString() })
    .select()
    .single()

  if (error) {
    console.error('[sub/insert] error:', error.message, error.code)
    throw error
  }
  return created
}

export async function getSubscriptionStatus(userId: string) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  let { data } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!data) return { status: 'none' as const, daysLeft: 0 }

  // Cuenta exenta (admin/test) — siempre activa sin pago
  if (data.is_exempt === true) {
    return { status: 'active' as const, daysLeft: null, isExempt: true }
  }

  const now = new Date()

  if (data.status === 'trial') {
    const end = new Date(data.trial_ends_at)
    if (now > end) {
      await supabaseAdmin.from('subscriptions').update({ status: 'expired' }).eq('user_id', userId)
      return { status: 'expired' as const, daysLeft: 0 }
    }
    const daysLeft = calendarDaysUntil(end, now)
    return { status: 'trial' as const, daysLeft, trialEndsAt: data.trial_ends_at }
  }

  if (data.status === 'active') {
    // Verificar si el período mensual venció → expirar y forzar renovación
    if (data.current_period_end) {
      const end = new Date(data.current_period_end)
      if (now > end) {
        await supabaseAdmin!.from('subscriptions').update({ status: 'expired' }).eq('user_id', userId)
        return { status: 'expired' as const, daysLeft: 0 }
      }
      const daysLeft = calendarDaysUntil(end, now)
      return { status: 'active' as const, daysLeft, currentPeriodEnd: data.current_period_end }
    }
    return { status: 'active' as const, daysLeft: null, currentPeriodEnd: null }
  }

  return { status: data.status as 'expired' | 'cancelled' | 'pending_payment', daysLeft: 0 }
}

export async function createCheckoutLink(userId: string, userEmail: string) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  if (!MP_TOKEN()) throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado')
  console.log('[MP] back_url base:', BACK_URL())

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
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
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

  const monto = payment.transaction_amount ?? 0
  const fecha = new Date().toISOString().slice(0, 10)
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId)
  const userEmail = userData?.user?.email || payment.payer?.email || 'desconocido'

  const { data: receipt } = await supabaseAdmin.from('payment_receipts').insert({
    user_id: userId,
    user_email: userEmail,
    monto,
    moneda: PLAN_CURRENCY,
    plan: 'Ergania — Plan mensual',
    mp_payment_id: String(payment.id),
    fecha,
  }).select().single()

  const { sendPaymentNotification, sendSubscriptionConfirmation } = await import('./emailService')
  sendPaymentNotification(userId, String(payment.id), monto, payment.payer?.email ?? 'desconocido')
    .catch(err => console.error('[webhook] Error enviando notificación admin:', err))

  if (userEmail !== 'desconocido') {
    sendSubscriptionConfirmation(userEmail, { monto, moneda: PLAN_CURRENCY, plan: 'Ergania — Plan mensual', fecha, paymentId: String(payment.id) })
      .then(() => { if (receipt?.id) return supabaseAdmin!.from('payment_receipts').update({ email_sent: true }).eq('id', receipt.id) })
      .catch(err => console.error('[webhook] Error enviando confirmación al usuario:', err))
  }
}

// Llamado por Vercel Cron una vez al día: avisa a subs activas que vencen en ≤3 días,
// una sola vez por período (reminder_for_period_end guarda para qué vencimiento ya se avisó)
export async function sendExpiryReminders() {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  const now = new Date()
  const cutoff = new Date(now.getTime() + 3 * 86_400_000)

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id, current_period_end, reminder_for_period_end, is_exempt')
    .eq('status', 'active')
    .not('current_period_end', 'is', null)
    .gt('current_period_end', now.toISOString())
    .lte('current_period_end', cutoff.toISOString())

  if (error) throw new Error(`DB error: ${error.message}`)

  let sent = 0
  const { sendRenewalReminder } = await import('./emailService')

  for (const sub of data ?? []) {
    if (sub.is_exempt) continue
    if (sub.reminder_for_period_end === sub.current_period_end) continue

    try {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(sub.user_id)
      const email = userData?.user?.email
      if (!email) continue

      const daysLeft = calendarDaysUntil(new Date(sub.current_period_end), now)
      await sendRenewalReminder(email, daysLeft)

      await supabaseAdmin
        .from('subscriptions')
        .update({ reminder_for_period_end: sub.current_period_end })
        .eq('user_id', sub.user_id)
      sent++
    } catch (err) {
      // No marcar como enviado: el cron de mañana reintenta
      console.error(`[reminders] fallo para user ${sub.user_id}:`, err instanceof Error ? err.message : err)
    }
  }

  return { checked: data?.length ?? 0, sent }
}

export async function cancelSubscription(userId: string) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  if (error) throw error
}
