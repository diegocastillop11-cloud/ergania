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
const PLAN_NAME     = 'Ergania — Plan mensual'
// Plan de cobro recurrente creado con scripts/setup-mp-preapproval-plan.mjs.
// Queda atado a la cuenta MP que lo creó: si cambia la cuenta que recibe los
// pagos, hay que volver a correr el script y actualizar esta var.
const MP_PLAN_ID = () => stripBOM(process.env.MP_PREAPPROVAL_PLAN_ID || '').trim()

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

  // Si este correo ya eliminó una cuenta antes, no le regalamos otro trial de
  // 3 días — borrar y volver a registrarse con el mismo correo no debe ser una
  // forma gratis de estirar el trial indefinidamente.
  let alreadyDeletedBefore = false
  if (userEmail) {
    const { data: priorDeletion } = await supabaseAdmin
      .from('account_deletion_requests')
      .select('id')
      .eq('email', userEmail)
      .limit(1)
      .maybeSingle()
    alreadyDeletedBefore = !!priorDeletion
  }

  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS)

  const { data: created, error } = await supabaseAdmin
    .from('subscriptions')
    .insert({
      user_id: userId,
      status: alreadyDeletedBefore ? 'expired' : 'trial',
      trial_ends_at: trialEndsAt.toISOString(),
    })
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
  // No se manda si ya había eliminado la cuenta antes — no aplica un mensaje
  // de "bienvenida" y sin trial nuevo el correo confundiría más de lo que ayuda.
  if (userEmail && !alreadyDeletedBefore) {
    const { sendWelcomeEmail } = await import('./emailService')
    sendWelcomeEmail(userEmail).catch(err => console.error('[welcome-email] error:', err.message))
  }

  return created
}

// Tablas con datos propios del usuario, todas llaveadas por user_email.
// perfiles cascadea a perfil_profiles/perfil_cvs/perfil_portals (FK ON DELETE
// CASCADE, ver migración 004/005) — no hace falta listarlas aparte.
// payment_receipts y contact_messages/contact_replies NO se tocan: los
// primeros por obligación legal de conservar registros de pago (ver Política
// de Privacidad), los segundos porque son el historial de soporte, no datos
// de perfil.
const USER_DATA_TABLES = [
  'tracker_entries', 'pipeline_jobs', 'applications', 'reports',
  'profiles', 'cvs', 'portals_config', 'perfiles',
]

// Llamado tanto por el borrado self-service (Configuración) como por el admin
// (panel Admin) — un solo lugar que deja el motivo registrado, limpia los
// datos del usuario y borra la cuenta de Supabase Auth.
export async function requestAccountDeletion(userId: string, email: string, motivo: string) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')

  const { error: insertErr } = await supabaseAdmin
    .from('account_deletion_requests')
    .insert({ user_id: userId, email, motivo })
  if (insertErr) {
    console.error('[account-deletion/log] error:', insertErr.message)
    throw insertErr
  }

  for (const table of USER_DATA_TABLES) {
    const { error } = await supabaseAdmin.from(table).delete().eq('user_email', email)
    if (error) console.error(`[account-deletion/${table}] error:`, error.message)
  }

  await supabaseAdmin.from('subscriptions').delete().eq('user_id', userId)

  const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (authErr) throw authErr
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

// Decisión pura (sin DB) de qué status "cuenta" de verdad, dada una fila de
// subscriptions — misma lógica de fechas que getSubscriptionStatus, pero sin
// side effects. Existe para que el panel admin (getStats) muestre el mismo
// estado real que ve el usuario, en vez del status crudo guardado en la fila
// (que puede quedar desactualizado hasta que ese usuario vuelve a entrar).
export function computeEffectiveStatus(
  data: { status: string; is_exempt?: boolean | null; trial_ends_at?: string | null; current_period_end?: string | null },
  now: Date = new Date()
): string {
  if (data.is_exempt === true) return 'active'

  if (data.status === 'trial') {
    return data.trial_ends_at && now > new Date(data.trial_ends_at) ? 'expired' : 'trial'
  }

  if (data.status === 'active') {
    return data.current_period_end && now > new Date(data.current_period_end) ? 'expired' : 'active'
  }

  if (data.status === 'pending_payment' && data.trial_ends_at && now <= new Date(data.trial_ends_at)) {
    return 'pending_payment'
  }

  if (data.status === 'cancelled' && data.current_period_end) {
    return now <= new Date(data.current_period_end) ? 'active' : 'expired'
  }

  return data.status
}

export async function getSubscriptionStatus(userId: string) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  let { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  // PGRST116 = no rows found — caso normal si aún no se creó la fila.
  // Cualquier otro error (DB caída, timeout) debe propagarse: si lo tratamos
  // como "sin suscripción" el usuario ve la pantalla de cobro sin haber
  // vencido de verdad.
  if (error && error.code !== 'PGRST116') {
    console.error('[sub/status] error:', error.message, error.code)
    throw new Error(`DB error: ${error.message}`)
  }
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

  // Cancelado (el usuario canceló la renovación automática): igual que con
  // 'active', mantiene acceso hasta que venza el período ya pagado — no se
  // le corta en seco solo por haber cancelado. Detectado 2026-07-26: un
  // usuario canceló minutos después de pagar y perdía acceso al instante
  // pese a haber pagado el mes completo.
  if (data.status === 'cancelled' && data.current_period_end) {
    const end = new Date(data.current_period_end)
    if (now <= end) {
      const daysLeft = calendarDaysUntil(end, now)
      return {
        status: 'active' as const, daysLeft, currentPeriodEnd: data.current_period_end,
        paymentProvider: data.payment_provider, paymentSuspended: data.payment_suspended ?? false,
      }
    }
    await supabaseAdmin.from('subscriptions').update({ status: 'expired' }).eq('user_id', userId)
    return { status: 'expired' as const, daysLeft: 0 }
  }

  return { status: data.status as 'expired' | 'cancelled' | 'pending_payment', daysLeft: 0 }
}

// Los dos caminos de MP conviven a propósito (2026-08-10):
//
// - Checkout Pro (pago único, el usuario re-paga a mano cada 30 días) es el
//   flujo con el que ya pagaron los primeros clientes. Se les mantiene: migrar
//   a cobro automático a alguien que ya pagó de otra forma es pedirle que
//   autorice un cargo recurrente que nunca aceptó.
// - Preapproval (cobro automático) es el flujo de los usuarios nuevos. El
//   intento anterior se revirtió porque no se pudo probar de punta a punta —
//   la única cuenta MP disponible como comprador era la misma que recibe los
//   pagos, y MP no permite pagarse a uno mismo. Con la cuenta de empresa ya
//   existen dos cuentas distintas y la prueba real es posible.
//
// El criterio de ruteo es la fila, no una lista de user_ids: quien ya tiene un
// mp_payment_id y ningún mp_preapproval_id pagó por Checkout Pro y ahí sigue.
export async function createCheckoutLink(userId: string, userEmail: string) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  if (!MP_TOKEN()) throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado')

  const { data: existing } = await supabaseAdmin
    .from('subscriptions')
    .select('mp_payment_id, mp_preapproval_id')
    .eq('user_id', userId)
    .maybeSingle()

  const esClienteDeCheckoutPro = !!existing?.mp_payment_id && !existing?.mp_preapproval_id
  if (MP_PLAN_ID() && !esClienteDeCheckoutPro) {
    return createPreapprovalLink(userId, userEmail)
  }

  return createCheckoutProLink(userId, userEmail)
}

// Cobro automático mensual: se manda al usuario al checkout del PLAN, no se
// crea la suscripción por API.
//
// Probado contra la API real de MP (Chile, MLC) el 2026-08-10: `POST
// /preapproval` con un preapproval_plan_id responde 400 "card_token_id is
// required" — esa vía exige tokenizar la tarjeta en nuestro propio formulario,
// que es un proyecto aparte. La variante sin plan asociado responde 500. La
// única que funciona es el init_point del plan, donde MP se encarga del login
// y de los datos de la tarjeta.
//
// El costo de esa vía: no podemos mandarle un external_reference, así que MP
// no sabe de qué usuario nuestro se trata. La suscripción se asocia a la vuelta
// (ver linkPreapprovalToUser), cuando MP devuelve al usuario a /subscription/
// success con el preapproval_id y nosotros todavía sabemos quién es porque
// está logueado. mp_payer_email queda como red de respaldo para el webhook.
async function createPreapprovalLink(userId: string, userEmail: string) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')

  await supabaseAdmin.from('subscriptions').upsert(
    {
      user_id: userId, mp_payer_email: userEmail, status: 'pending_payment',
      payment_provider: 'mercadopago',
    },
    { onConflict: 'user_id' }
  )

  const plan = await mpFetch(`/preapproval_plan/${MP_PLAN_ID()}`, 'GET')
  return { checkoutUrl: plan.init_point as string }
}

async function createCheckoutProLink(userId: string, userEmail: string) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
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

// Deja la suscripción activa por 30 días más, emite la boleta y avisa por
// correo. Lo comparten los tres caminos que confirman plata recibida (webhook
// de Checkout Pro, cobro recurrente de Preapproval y el reconciliador), para
// que un cobro no quede registrado distinto según por dónde entró.
async function registrarPagoAprobado(
  userId: string,
  pago: { id: string; monto: number; payerEmail?: string },
  opciones: { notificarAdmin: boolean; hasta?: string } = { notificarAdmin: true }
) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')

  // En una suscripción, MP dice exactamente cuándo vuelve a cobrar; usar esa
  // fecha en vez de sumar 30 días evita que la app corte el acceso un día
  // antes (o lo regale un día de más) respecto de lo que el usuario paga.
  const periodEnd = opciones.hasta ? new Date(opciones.hasta) : (() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d
  })()

  await supabaseAdmin.from('subscriptions').update({
    status: 'active',
    mp_payment_id: pago.id,
    current_period_end: periodEnd.toISOString(),
    payment_suspended: false,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId)

  const fecha = new Date().toISOString().slice(0, 10)
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId)
  const userEmail = userData?.user?.email || pago.payerEmail || 'desconocido'

  const { data: receipt } = await supabaseAdmin.from('payment_receipts').insert({
    user_id: userId,
    user_email: userEmail,
    monto: pago.monto,
    moneda: PLAN_CURRENCY,
    plan: PLAN_NAME,
    mp_payment_id: pago.id,
    provider: 'mercadopago',
    fecha,
  }).select().single()

  const { sendPaymentNotification, sendSubscriptionConfirmation } = await import('./emailService')

  if (opciones.notificarAdmin) {
    sendPaymentNotification(userId, pago.id, pago.monto, pago.payerEmail ?? userEmail, PLAN_CURRENCY)
      .catch(err => console.error('[mp] Error enviando notificación admin:', err))
  }

  if (userEmail !== 'desconocido') {
    sendSubscriptionConfirmation(userEmail, { monto: pago.monto, moneda: PLAN_CURRENCY, plan: PLAN_NAME, fecha, paymentId: pago.id })
      .then(() => { if (receipt?.id) return supabaseAdmin!.from('payment_receipts').update({ email_sent: true }).eq('id', receipt.id) })
      .catch(err => console.error('[mp] Error enviando confirmación al usuario:', err))
  }

  return { userEmail, monto: pago.monto }
}

export async function handleWebhook(topic: string, id: string) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')

  // Checkout Pro: pago único. Los clientes que ya venían de este flujo siguen
  // acá, y también entra por acá el primer cobro de una suscripción nueva.
  if (topic === 'payment') {
    const payment = await mpFetch(`/v1/payments/${id}`, 'GET')
    if (payment.status !== 'approved') return

    // metadata.user_id solo viene en los pagos de Checkout Pro. En los de una
    // suscripción el metadata llega VACÍO (verificado con un pago real el
    // 2026-08-10): el único lugar donde MP deja el preapproval es
    // point_of_interaction.transaction_data.subscription_id.
    let userId: string | undefined = payment.metadata?.user_id
    const subscriptionId = payment.point_of_interaction?.transaction_data?.subscription_id
    if (!userId && subscriptionId) {
      userId = await buscarUsuarioPorPreapproval(String(subscriptionId))
    }
    if (!userId) {
      console.warn(`[webhook] pago ${id} aprobado sin user_id resoluble — no se activó ninguna cuenta`)
      return
    }

    await registrarPagoAprobado(userId, {
      id: String(payment.id),
      monto: payment.transaction_amount ?? 0,
      payerEmail: payment.payer?.email,
    })
    return
  }

  // Cambios de estado de la suscripción (autorizada, pausada, cancelada).
  if (topic === 'subscription_preapproval' || topic === 'preapproval') {
    const preapproval = await mpFetch(`/preapproval/${id}`, 'GET')
    // Tres formas de saber de quién es, de la más confiable a la menos:
    // la que MP nos devolvió (solo existe si algún día podemos mandar
    // external_reference), la que asoció la app a la vuelta del checkout, y
    // el correo con el que pagó.
    const userId = preapproval.external_reference
      || await buscarUsuarioPorPreapproval(id)
      || await buscarUsuarioPorEmail(preapproval.payer_email)
    if (!userId) {
      console.warn(`[webhook] preapproval ${id} (pagador ${preapproval.payer_email}) no se pudo atribuir a ningún usuario`)
      return
    }
    // Si llegamos por correo, dejamos la asociación hecha para los próximos
    // eventos, que sí van a poder resolverse por preapproval_id.
    await supabaseAdmin.from('subscriptions').update({
      mp_preapproval_id: id, updated_at: new Date().toISOString(),
    }).eq('user_id', userId)

    if (preapproval.status === 'authorized') {
      // Verificado con un pago real el 2026-08-10: en el checkout del plan MP
      // cobra al instante y recién entonces deja la suscripción 'authorized',
      // con next_payment_date un mes más adelante. Así que 'authorized' ya
      // significa plata recibida y da acceso. La boleta y el correo NO se
      // emiten acá: los emite el webhook del pago, que sí trae el monto y el
      // id reales — si no, saldrían dos boletas por el mismo cobro.
      await supabaseAdmin.from('subscriptions').update({
        status: 'active',
        current_period_end: preapproval.next_payment_date
          ? new Date(preapproval.next_payment_date).toISOString()
          : undefined,
        payment_suspended: false,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId)
      return
    }

    if (preapproval.status === 'cancelled') {
      await supabaseAdmin.from('subscriptions').update({
        status: 'cancelled', updated_at: new Date().toISOString(),
      }).eq('user_id', userId)
      return
    }

    if (preapproval.status === 'paused') {
      await supabaseAdmin.from('subscriptions').update({
        payment_suspended: true, updated_at: new Date().toISOString(),
      }).eq('user_id', userId)
    }
    return
  }

  // Cada cobro mensual del motor de suscripciones.
  if (topic === 'subscription_authorized_payment') {
    const cuota = await mpFetch(`/authorized_payments/${id}`, 'GET')
    const preapprovalId = String(cuota.preapproval_id ?? '')
    let userId = await buscarUsuarioPorPreapproval(preapprovalId)
    if (!userId && preapprovalId) {
      // Mismo respaldo que arriba: si la suscripción nunca quedó asociada,
      // se intenta por el correo del pagador antes de darla por perdida.
      const preapproval = await mpFetch(`/preapproval/${preapprovalId}`, 'GET').catch(() => null)
      userId = await buscarUsuarioPorEmail(preapproval?.payer_email)
      if (userId) {
        await supabaseAdmin.from('subscriptions').update({
          mp_preapproval_id: preapprovalId, updated_at: new Date().toISOString(),
        }).eq('user_id', userId)
      }
    }
    if (!userId) {
      console.warn(`[webhook] cuota ${id} del preapproval ${preapprovalId} sin fila asociada`)
      return
    }

    // MP reintenta hasta 4 veces en 10 días y cancela sola la suscripción tras
    // 3 cuotas rechazadas. Mientras reintenta ('recycling') no se corta el
    // acceso: se marca para poder avisarle al usuario que revise su tarjeta.
    if (cuota.status !== 'processed' || cuota.payment?.status !== 'approved') {
      await supabaseAdmin.from('subscriptions').update({
        payment_suspended: true, updated_at: new Date().toISOString(),
      }).eq('user_id', userId)
      console.warn(`[webhook] cuota ${id} no cobrada (status ${cuota.status}/${cuota.payment?.status}) — user ${userId} marcado payment_suspended`)
      return
    }

    await registrarPagoAprobado(userId, {
      id: String(cuota.payment?.id ?? id),
      monto: cuota.transaction_amount ?? PLAN_AMOUNT,
    })
    return
  }

  // Sin monitoreo en producción, un topic que no sabemos manejar se vería como
  // "el usuario pagó y no pasó nada". Al menos queda en los logs de Vercel.
  console.warn(`[webhook] topic no manejado: ${topic} (id ${id})`)
}

async function buscarUsuarioPorPreapproval(preapprovalId: string): Promise<string | undefined> {
  if (!supabaseAdmin || !preapprovalId) return undefined
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id')
    .eq('mp_preapproval_id', preapprovalId)
    .maybeSingle()
  return data?.user_id
}

// Último respaldo para cuando la suscripción no quedó asociada (el usuario
// cerró la pestaña antes de volver del checkout). Rara vez va a servir: en el
// checkout del plan MP devuelve payer_email vacío (verificado 2026-08-10), así
// que solo sirve si algún evento sí lo trae y además el usuario pagó con la
// misma dirección con la que se registró en Ergania.
async function buscarUsuarioPorEmail(email?: string): Promise<string | undefined> {
  if (!supabaseAdmin || !email) return undefined
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id')
    .eq('mp_payer_email', email)
    .eq('status', 'pending_payment')
    .maybeSingle()
  return data?.user_id
}

// Asocia una suscripción de MP a un usuario nuestro. Hace falta porque el
// checkout del plan no admite external_reference (ver createPreapprovalLink):
// MP nos devuelve al usuario con el preapproval_id en la URL y recién ahí,
// con la sesión de Ergania a mano, sabemos de quién es.
//
// El endpoint que llama a esto está autenticado, pero igual se valida que la
// suscripción sea de NUESTRO plan y que no esté ya tomada por otra cuenta —
// si no, cualquiera podría adueñarse de la suscripción pagada por otro.
export async function linkPreapprovalToUser(userId: string, preapprovalId: string) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  if (!preapprovalId) throw new Error('preapproval_id requerido')

  const preapproval = await mpFetch(`/preapproval/${preapprovalId}`, 'GET')

  if (MP_PLAN_ID() && preapproval.preapproval_plan_id !== MP_PLAN_ID()) {
    throw new Error('La suscripción no corresponde al plan de Ergania')
  }

  const dueñoActual = await buscarUsuarioPorPreapproval(preapprovalId)
  if (dueñoActual && dueñoActual !== userId) {
    console.warn(`[link] preapproval ${preapprovalId} ya es del usuario ${dueñoActual}; lo pidió ${userId}`)
    throw new Error('Esa suscripción ya está asociada a otra cuenta')
  }

  const activa = preapproval.status === 'authorized'

  await supabaseAdmin.from('subscriptions').update({
    mp_preapproval_id: preapprovalId,
    payment_provider: 'mercadopago',
    // La suscripción ya está pagada (ver el comentario del webhook): se da
    // acceso acá mismo, sin esperar al webhook. La boleta la sigue emitiendo
    // el webhook del pago, que es el único que sabe el monto y el id reales.
    ...(activa ? {
      status: 'active',
      payment_suspended: false,
      ...(preapproval.next_payment_date
        ? { current_period_end: new Date(preapproval.next_payment_date).toISOString() }
        : {}),
    } : {}),
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId)

  return { status: preapproval.status as string, activa }
}

// Llamado por Vercel Cron una vez al día: avisa a subs activas que vencen en ≤3 días,
// una sola vez por período (reminder_for_period_end guarda para qué vencimiento ya se avisó).
// Solo aplica a quien renueva a mano (MP Checkout Pro) — a un usuario con
// cobro automático (PayPal o Preapproval de MP) el recordatorio le diría que
// haga algo que ya pasa solo, y lo empujaría a pagar dos veces.
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
    .is('mp_preapproval_id', null)
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

// Llamado por Vercel Cron una vez al día: avisa a quien le queda ≤24h de
// trial y todavía no pagó, para que no se quede sin acceso de sorpresa.
// trial_reminder_sent evita mandarlo más de una vez por usuario.
export async function sendTrialEndingReminders() {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  const now = new Date()
  const cutoff = new Date(now.getTime() + 24 * 3_600_000)

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id')
    .eq('status', 'trial')
    .eq('trial_reminder_sent', false)
    .gt('trial_ends_at', now.toISOString())
    .lte('trial_ends_at', cutoff.toISOString())

  if (error) throw new Error(`DB error: ${error.message}`)

  let sent = 0
  const { sendTrialEndingReminder } = await import('./emailService')

  for (const sub of data ?? []) {
    try {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(sub.user_id)
      const email = userData?.user?.email
      if (!email) continue

      await sendTrialEndingReminder(email)
      await supabaseAdmin.from('subscriptions').update({ trial_reminder_sent: true }).eq('user_id', sub.user_id)
      sent++
    } catch (err) {
      // No marcar como enviado: el cron de mañana reintenta
      console.error(`[trial-reminders] fallo para user ${sub.user_id}:`, err instanceof Error ? err.message : err)
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

// Red de seguridad para cuando el webhook de MP no llega (mismo bug de
// redirect 308 que afectó a PayPal — ver CLAUDE.md). Para cada suscripción
// que localmente quedó vencida/pendiente pero alcanzó a iniciar un checkout
// de MP sin que un pago quedara registrado, busca en MercadoPago si en
// realidad sí se aprobó un pago para esa preferencia y, si es así, activa acá
// mismo en vez de esperar a que el cliente reclame.
export async function reconcileMercadoPagoPayments() {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')

  const { data: candidates, error } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id, mp_preference_id, mp_preapproval_id')
    .neq('payment_provider', 'paypal')
    .in('status', ['expired', 'pending_payment'])
    .is('mp_payment_id', null)
    .or('mp_preference_id.not.is.null,mp_preapproval_id.not.is.null')

  if (error) throw new Error(`DB error: ${error.message}`)

  const fixed: { email: string; provider: string; amount: number; moneda: string; refId: string }[] = []

  for (const row of candidates ?? []) {
    // Cada fila se consulta según su flujo: Checkout Pro deja una preference
    // con merchant orders; Preapproval no tiene preference, hay que preguntarle
    // a la suscripción si ya cobró alguna cuota.
    try {
      if (row.mp_preapproval_id) {
        const sub = await mpFetch(`/preapproval/${row.mp_preapproval_id}`, 'GET')
        if (sub.status !== 'authorized') continue

        // Sin boleta: acá no tenemos el id ni el monto del cobro (el objeto
        // preapproval no los expone — summarized viene en null incluso con un
        // cobro real). La boleta la emite el webhook del pago; esto solo
        // devuelve el acceso a alguien que pagó y se quedó afuera.
        await supabaseAdmin.from('subscriptions').update({
          status: 'active',
          payment_suspended: false,
          ...(sub.next_payment_date
            ? { current_period_end: new Date(sub.next_payment_date).toISOString() }
            : {}),
          updated_at: new Date().toISOString(),
        }).eq('user_id', row.user_id)

        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(row.user_id)
        fixed.push({
          email: userData?.user?.email || 'desconocido', provider: 'mercadopago',
          amount: PLAN_AMOUNT, moneda: PLAN_CURRENCY, refId: String(row.mp_preapproval_id),
        })
        continue
      }

      const cobro = await buscarCobroDePreference(row.mp_preference_id as string)
      if (!cobro) continue

      const { userEmail, monto } = await registrarPagoAprobado(
        row.user_id, { id: cobro.id, monto: cobro.monto }, { notificarAdmin: false }
      )
      fixed.push({ email: userEmail, provider: 'mercadopago', amount: monto, moneda: PLAN_CURRENCY, refId: cobro.id })
    } catch (err) {
      console.error(`[reconcile/mp] no se pudo consultar al usuario ${row.user_id}:`, err instanceof Error ? err.message : err)
      continue
    }
  }

  return { checked: candidates?.length ?? 0, fixed }
}

async function buscarCobroDePreference(prefId: string) {
  if (!prefId) return undefined
  const search: { elements?: { payments?: { id: number; status: string; transaction_amount?: number }[] }[] } =
    await mpFetch(`/merchant_orders/search?preference_id=${prefId}`, 'GET')

  const approved = search.elements?.flatMap(o => o.payments ?? []).find(p => p.status === 'approved')
  return approved ? { id: String(approved.id), monto: approved.transaction_amount ?? 0 } : undefined
}


// Checkout Pro no tiene nada que cancelar del lado del proveedor — es pago
// manual, no hay cobro automático que apagar. PayPal y el Preapproval de MP sí
// cobran solos, así que cancelar en la app tiene que apagarlos allá también; si
// no, seguirían cobrando el mes que viene aunque la fila local diga 'cancelled'.
export async function cancelSubscription(userId: string) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')

  const { data: sub, error: selectErr } = await supabaseAdmin
    .from('subscriptions')
    .select('payment_provider, paypal_subscription_id, mp_preapproval_id')
    .eq('user_id', userId)
    .single()

  // Un error real acá (no "sin fila") no puede tratarse en silencio: si el
  // usuario es de PayPal y no detectamos el provider, se salta la cancelación
  // en PayPal y sigue cobrando cada mes aunque la app diga "cancelado".
  if (selectErr && selectErr.code !== 'PGRST116') {
    console.error('[cancel] error leyendo subscription:', selectErr.message, selectErr.code)
    throw new Error(`DB error: ${selectErr.message}`)
  }

  if (sub?.payment_provider === 'paypal' && sub.paypal_subscription_id) {
    try {
      const { cancelPayPalSubscription } = await import('./paypalService')
      await cancelPayPalSubscription(sub.paypal_subscription_id)
    } catch (err) {
      console.error('[cancel] Error cancelando subscription en PayPal:', err instanceof Error ? err.message : err)
    }
  }

  // A diferencia de PayPal, acá el error NO se traga: si MP rechaza la
  // cancelación y igual marcáramos 'cancelled' localmente, el usuario vería
  // "suscripción cancelada" mientras le siguen llegando cargos cada mes. Es
  // preferible que vea un error y reintente.
  if (sub?.payment_provider === 'mercadopago' && sub.mp_preapproval_id) {
    await mpFetch(`/preapproval/${sub.mp_preapproval_id}`, 'PUT', { status: 'cancelled' })
  }

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  if (error) throw error
}
