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
const PLAN_AMOUNT   = 9990
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

export async function getOrCreateSubscription(userId: string, userEmail?: string) {
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

  // La notificación al ADMIN de nuevo usuario ya no se manda al toque (ver
  // sendPendingSignupDigest) — se acumula acá (signup_notified_at queda NULL
  // por defecto) y se avisa una vez al día en un solo correo, para no competir
  // por el cupo diario de Resend con emails que sí son urgentes.
  // El correo de bienvenida AL USUARIO sí va al toque, aparte de ese digest.
  if (userEmail) {
    const { sendWelcomeEmail } = await import('./emailService')
    sendWelcomeEmail(userEmail).catch(err => console.error('[welcome-email] error:', err.message))
  }

  return created
}

export async function sendPendingSignupDigest() {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id, created_at')
    .is('signup_notified_at', null)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`DB error: ${error.message}`)
  if (!data || data.length === 0) return { pending: 0, sent: 0 }

  const users: { email: string; createdAt: string }[] = []
  for (const row of data) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(row.user_id)
    if (userData?.user?.email) users.push({ email: userData.user.email, createdAt: row.created_at })
  }

  if (users.length > 0) {
    const { sendNewUsersDigest } = await import('./emailService')
    await sendNewUsersDigest(users)
  }

  await supabaseAdmin
    .from('subscriptions')
    .update({ signup_notified_at: new Date().toISOString() })
    .in('user_id', data.map(r => r.user_id))

  return { pending: data.length, sent: users.length }
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
      return {
        status: 'active' as const, daysLeft, currentPeriodEnd: data.current_period_end,
        paymentProvider: data.payment_provider, paymentSuspended: data.payment_suspended ?? false,
      }
    }
    return {
      status: 'active' as const, daysLeft: null, currentPeriodEnd: null,
      paymentProvider: data.payment_provider, paymentSuspended: data.payment_suspended ?? false,
    }
  }

  // Pago pendiente (checkout iniciado y abandonado, o webhook aún no confirma):
  // mientras no se le venza el trial original, sigue pudiendo usar la app —
  // no se le corta el acceso solo por haber intentado pagar.
  if (data.status === 'pending_payment' && data.trial_ends_at) {
    const end = new Date(data.trial_ends_at)
    if (now <= end) {
      const daysLeft = calendarDaysUntil(end, now)
      return { status: 'pending_payment' as const, daysLeft, trialEndsAt: data.trial_ends_at }
    }
  }

  return { status: data.status as 'expired' | 'cancelled' | 'pending_payment', daysLeft: 0 }
}

// MP vuelve a Checkout Pro (pago manual repetido cada mes) — la migración a
// Preapproval (cobro automático) se probó en producción y no se pudo
// confirmar con una transacción real (la única cuenta MP disponible para
// probar como comprador es la misma que recibe los pagos de Ergania, y MP no
// permite pagarse a uno mismo). Se revierte para no arriesgar el único medio
// de pago que sí tiene historial de funcionar con clientes reales. PayPal
// Subscriptions no se toca — ya se confirmó funcionando en producción.
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
    { user_id: userId, mp_payer_email: userEmail, status: 'pending_payment', mp_preference_id: preference.id, payment_provider: 'mercadopago' },
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
    provider: 'mercadopago',
    fecha,
  }).select().single()

  const { sendPaymentNotification, sendSubscriptionConfirmation } = await import('./emailService')
  sendPaymentNotification(userId, String(payment.id), monto, payment.payer?.email ?? 'desconocido', PLAN_CURRENCY)
    .catch(err => console.error('[webhook] Error enviando notificación admin:', err))

  if (userEmail !== 'desconocido') {
    sendSubscriptionConfirmation(userEmail, { monto, moneda: PLAN_CURRENCY, plan: 'Ergania — Plan mensual', fecha, paymentId: String(payment.id) })
      .then(() => { if (receipt?.id) return supabaseAdmin!.from('payment_receipts').update({ email_sent: true }).eq('id', receipt.id) })
      .catch(err => console.error('[webhook] Error enviando confirmación al usuario:', err))
  }
}

// Llamado por Vercel Cron una vez al día: avisa a subs activas que vencen en ≤3 días,
// una sola vez por período (reminder_for_period_end guarda para qué vencimiento ya se avisó).
// Solo aplica a MP (Checkout Pro, pago manual) — un usuario activo con PayPal
// (cobro automático) no necesita recordatorio de renovación.
export async function sendExpiryReminders() {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  const now = new Date()
  const cutoff = new Date(now.getTime() + 3 * 86_400_000)

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id, current_period_end, reminder_for_period_end, is_exempt, payment_provider')
    .eq('status', 'active')
    .not('current_period_end', 'is', null)
    .neq('payment_provider', 'paypal')
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

// Llamado por Vercel Cron una vez al día: pending_payment marca "inició un
// checkout de MercadoPago" — si a esta hora sigue en ese estado es porque
// nunca completó el pago (si hubiera pagado, el webhook ya lo habría dejado
// en 'active' sin importar el estado previo). Se limpia para que no quede
// "Pendiente" para siempre en el panel — vuelve a 'trial' si le queda trial,
// o 'expired' si no.
export async function revertStalePendingPayments() {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  const nowIso = new Date().toISOString()

  const { data: toTrial, error: e1 } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'trial' })
    .eq('status', 'pending_payment')
    .gt('trial_ends_at', nowIso)
    .select('user_id')
  if (e1) throw new Error(`DB error: ${e1.message}`)

  const { data: toExpired, error: e2 } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'expired' })
    .eq('status', 'pending_payment')
    .or(`trial_ends_at.is.null,trial_ends_at.lte.${nowIso}`)
    .select('user_id')
  if (e2) throw new Error(`DB error: ${e2.message}`)

  return { toTrial: toTrial?.length ?? 0, toExpired: toExpired?.length ?? 0 }
}

// Llamado por Vercel Cron una vez al día: los trials vencidos solo se marcan
// 'expired' cuando el propio usuario vuelve a entrar (getSubscriptionStatus
// lo recalcula en vivo en ese momento). Si el usuario nunca vuelve, la fila
// queda congelada en 'trial' para siempre y el reporte de Admin muestra un
// estado desactualizado — este cron la actualiza igual, sin depender de que
// el usuario abra la app de nuevo (no cambia el acceso real, que ya estaba
// bloqueado en tiempo real; solo mantiene el dato del panel correcto).
export async function expireStaleTrials() {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  const nowIso = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'expired' })
    .eq('status', 'trial')
    .lt('trial_ends_at', nowIso)
    .select('user_id')
  if (error) throw new Error(`DB error: ${error.message}`)

  return { expired: data?.length ?? 0 }
}

// MP (Checkout Pro) no tiene nada que cancelar del lado del proveedor — es
// pago manual, no hay cobro automático que apagar. PayPal sí (Subscriptions
// cobra solo), así que cancelar en la app también cancela en PayPal, si no
// seguiría cobrando el mes que viene aunque la fila local diga 'cancelled'.
export async function cancelSubscription(userId: string) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('payment_provider, paypal_subscription_id')
    .eq('user_id', userId)
    .single()

  if (sub?.payment_provider === 'paypal' && sub.paypal_subscription_id) {
    try {
      const { cancelPayPalSubscription } = await import('./paypalService')
      await cancelPayPalSubscription(sub.paypal_subscription_id)
    } catch (err) {
      console.error('[cancel] Error cancelando subscription en PayPal:', err instanceof Error ? err.message : err)
    }
  }

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  if (error) throw error
}
