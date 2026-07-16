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
// El monto ($9.990/mes) vive en el plan de MP (MP_PREAPPROVAL_PLAN_ID) — no se
// pasa por request como antes con Checkout Pro.
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

  // La notificación de nuevo usuario ya no se manda al toque (ver
  // sendPendingSignupDigest) — se acumula acá (signup_notified_at queda NULL
  // por defecto) y se avisa una vez al día en un solo correo, para no competir
  // por el cupo diario de Resend con emails que sí son urgentes.

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

// Preapproval (cobro automático) reemplaza Checkout Pro — no hay usuarios activos
// en el flujo viejo que migrar (confirmado antes de este cambio), así que no queda
// código de Checkout Pro en paralelo.
export async function createCheckoutLink(userId: string, userEmail: string) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  if (!MP_TOKEN()) throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado')
  const planId = stripBOM(process.env.MP_PREAPPROVAL_PLAN_ID || '')
  if (!planId) throw new Error('MP_PREAPPROVAL_PLAN_ID no configurado')
  console.log('[MP] back_url base:', BACK_URL())

  const preapproval = await mpFetch('/preapproval', 'POST', {
    preapproval_plan_id: planId,
    payer_email: userEmail,
    external_reference: userId,
    back_url: `${BACK_URL()}/subscription/success`,
  })

  await supabaseAdmin.from('subscriptions').upsert(
    { user_id: userId, mp_payer_email: userEmail, status: 'pending_payment', mp_preapproval_id: preapproval.id, payment_provider: 'mercadopago' },
    { onConflict: 'user_id' }
  )

  // NOTA: verificar en sandbox el nombre exacto del campo de redirect que
  // devuelve /preapproval sin card_token_id — la documentación pública no lo
  // expuso al momento de escribir esto. init_point es el equivalente usado
  // por Checkout Pro; si Preapproval usa otro nombre, ajustar acá.
  const checkoutUrl = preapproval.init_point as string | undefined
  if (!checkoutUrl) throw new Error('MP no devolvió URL de autorización — revisar respuesta de /preapproval')
  return { checkoutUrl }
}

const MP_STATUS_MAP: Record<string, 'active' | 'cancelled' | null> = {
  authorized: 'active',
  cancelled: 'cancelled',
}

// Mapeo puro status MP → status local, testeable en aislamiento.
export function mapMpPreapprovalStatus(mpStatus: string): 'active' | 'cancelled' | null {
  return MP_STATUS_MAP[mpStatus] ?? null
}

export async function handleWebhook(topic: string, id: string) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')

  if (topic === 'subscription_preapproval') {
    const preapproval = await mpFetch(`/preapproval/${id}`, 'GET')
    const userId = preapproval.external_reference
    if (!userId) return

    const mapped = mapMpPreapprovalStatus(preapproval.status)
    if (mapped === 'active') {
      await supabaseAdmin.from('subscriptions').update({
        status: 'active',
        mp_preapproval_id: preapproval.id,
        payment_suspended: false,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId)
    } else if (mapped === 'cancelled') {
      await supabaseAdmin.from('subscriptions').update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId)
    } else if (preapproval.status === 'paused' || preapproval.status === 'suspended') {
      // MP agotó los reintentos automáticos de cobro — pedir actualizar la tarjeta,
      // sin cortar el acceso todavía (current_period_end sigue vigente).
      await supabaseAdmin.from('subscriptions').update({
        payment_suspended: true,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId)
    }
    return
  }

  if (topic !== 'payment' && topic !== 'subscription_authorized_payment') return

  const payment = await mpFetch(`/v1/payments/${id}`, 'GET')

  // Checkout Pro (histórico) usaba metadata.user_id; Preapproval usa external_reference.
  const userId = payment.metadata?.user_id || payment.external_reference
  if (!userId || payment.status !== 'approved') return

  const periodEnd = new Date()
  periodEnd.setDate(periodEnd.getDate() + 30)

  await supabaseAdmin.from('subscriptions').update({
    status: 'active',
    mp_payment_id: String(payment.id),
    current_period_end: periodEnd.toISOString(),
    payment_suspended: false,
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

// sendExpiryReminders (recordatorio de renovación manual) se retiró junto con
// la migración de MP a Preapproval — MP y PayPal cobran solos ahora, no hay
// vencimiento que recordarle a mano al usuario. revertStalePendingPayments
// abajo SÍ sigue vigente: un checkout (MP o PayPal) que el usuario abandona
// sin autorizar deja la fila local en 'pending_payment' sin importar el
// proveedor, y eso hay que limpiarlo igual que antes.

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

export async function cancelSubscription(userId: string) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  if (error) throw error
}
