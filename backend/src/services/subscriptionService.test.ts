/**
 * Tests del webhook de MercadoPago, con foco en el cobro recurrente
 * (Preapproval). Acá se murió el intento anterior de esta feature: los eventos
 * de suscripción se descartaban en silencio y el usuario perdía acceso pese a
 * haber pagado. Estos tests reemplazan la prueba manual que no se podía hacer
 * con una sola cuenta de MP — no necesitan cuenta, ni plata, ni esperar la
 * hora que MP se demora en cobrar la primera cuota.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const updates: { table: string; values: Record<string, unknown>; userId?: string }[] = []
const inserts: { table: string; values: Record<string, unknown> }[] = []
let filas: Record<string, unknown> | null = null

vi.mock('../config/supabase', () => {
  const from = (table: string) => {
    let updateValues: Record<string, unknown> | null = null
    const api: Record<string, unknown> = {
      update(values: Record<string, unknown>) { updateValues = values; return api },
      insert(values: Record<string, unknown>) { inserts.push({ table, values }); return api },
      select() { return api },
      eq(_col: string, val: string) {
        if (updateValues) {
          updates.push({ table, values: updateValues, userId: val })
          updateValues = null
          return Promise.resolve({ error: null })
        }
        return api
      },
      single() { return Promise.resolve({ data: { id: 'receipt-1' }, error: null }) },
      maybeSingle() { return Promise.resolve({ data: filas, error: null }) },
    }
    return api
  }
  return {
    supabaseAdmin: {
      from,
      auth: { admin: { getUserById: async () => ({ data: { user: { email: 'usuario@ejemplo.cl' } } }) } },
    },
  }
})

vi.mock('./emailService', () => ({
  sendPaymentNotification: vi.fn().mockResolvedValue(undefined),
  sendSubscriptionConfirmation: vi.fn().mockResolvedValue(undefined),
}))

import { handleWebhook } from './subscriptionService'

// Respuestas de la API de MP indexadas por el path que consulta el servicio.
function mockMercadoPago(respuestas: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const path = url.replace('https://api.mercadopago.com', '')
    const match = Object.keys(respuestas).find(p => path.startsWith(p))
    if (!match) throw new Error(`Test sin respuesta mockeada para ${path}`)
    return { ok: true, text: async () => JSON.stringify(respuestas[match]) }
  }))
}

const cambiosEn = (userId: string) => updates.filter(u => u.userId === userId)

beforeEach(() => {
  updates.length = 0
  inserts.length = 0
  filas = null
  vi.unstubAllGlobals()
})

describe('handleWebhook — cobro recurrente (Preapproval)', () => {
  it('una cuota cobrada extiende 30 días y emite la boleta', async () => {
    filas = { user_id: 'user-nuevo' }
    mockMercadoPago({
      '/authorized_payments/ap-1': {
        preapproval_id: 'pre-1', status: 'processed',
        transaction_amount: 9990, payment: { id: 55501, status: 'approved' },
      },
    })

    await handleWebhook('subscription_authorized_payment', 'ap-1')

    const cambio = cambiosEn('user-nuevo').at(-1)
    expect(cambio?.values.status).toBe('active')
    expect(cambio?.values.mp_payment_id).toBe('55501')
    expect(cambio?.values.payment_suspended).toBe(false)

    const vence = new Date(cambio?.values.current_period_end as string)
    const diasHastaVencer = Math.round((vence.getTime() - Date.now()) / 86_400_000)
    expect(diasHastaVencer).toBe(30)

    expect(inserts.filter(i => i.table === 'payment_receipts')).toHaveLength(1)
    expect(inserts[0].values.monto).toBe(9990)
  })

  // El caso que más caro sale: la tarjeta rebota, MP reintenta hasta 4 veces en
  // 10 días. Cortarle el acceso al primer rebote es perder a un cliente que sí
  // quería pagar; darle el mes gratis es regalar el producto.
  it('una cuota rechazada no activa nada, solo marca el problema', async () => {
    filas = { user_id: 'user-tarjeta-mala' }
    mockMercadoPago({
      '/authorized_payments/ap-2': {
        preapproval_id: 'pre-2', status: 'recycling',
        transaction_amount: 9990, payment: { id: 55502, status: 'rejected' },
      },
    })

    await handleWebhook('subscription_authorized_payment', 'ap-2')

    const cambio = cambiosEn('user-tarjeta-mala').at(-1)
    expect(cambio?.values.payment_suspended).toBe(true)
    expect(cambio?.values.status).toBeUndefined()
    expect(inserts).toHaveLength(0)
  })

  // Verificado con un pago real (2026-08-10): en el checkout del plan MP cobra
  // al instante y recién ahí deja la suscripción 'authorized'. Por eso
  // 'authorized' ya da acceso, y el vencimiento sale de next_payment_date en
  // vez de sumar 30 días a ojo.
  it('autorizar la suscripción da acceso hasta la fecha del próximo cobro', async () => {
    mockMercadoPago({
      '/preapproval/pre-3': {
        id: 'pre-3', status: 'authorized', external_reference: 'user-autorizado',
        next_payment_date: '2026-09-10T12:50:26.000-04:00',
      },
    })

    await handleWebhook('subscription_preapproval', 'pre-3')

    const cambios = cambiosEn('user-autorizado')
    expect(cambios.some(c => c.values.mp_preapproval_id === 'pre-3')).toBe(true)

    const activacion = cambios.find(c => c.values.status === 'active')
    expect(activacion?.values.current_period_end).toBe('2026-09-10T16:50:26.000Z')
    expect(activacion?.values.payment_suspended).toBe(false)

    // La boleta la emite el webhook del pago, que sí sabe monto e id reales.
    // Si se emitiera acá también, saldrían dos por el mismo cobro.
    expect(inserts).toHaveLength(0)
  })

  it('cancelar en MP deja la fila cancelada', async () => {
    mockMercadoPago({
      '/preapproval/pre-4': { id: 'pre-4', status: 'cancelled', external_reference: 'user-que-cancelo' },
    })

    await handleWebhook('subscription_preapproval', 'pre-4')

    expect(cambiosEn('user-que-cancelo').at(-1)?.values.status).toBe('cancelled')
  })

  it('pausar en MP no borra el acceso ya pagado, solo lo marca', async () => {
    mockMercadoPago({
      '/preapproval/pre-5': { id: 'pre-5', status: 'paused', external_reference: 'user-pausado' },
    })

    await handleWebhook('subscription_preapproval', 'pre-5')

    const cambio = cambiosEn('user-pausado').at(-1)
    expect(cambio?.values.payment_suspended).toBe(true)
    expect(cambio?.values.status).toBeUndefined()
  })
})

describe('handleWebhook — Checkout Pro (los clientes que ya venían)', () => {
  it('un pago aprobado con metadata.user_id sigue activando igual que antes', async () => {
    mockMercadoPago({
      '/v1/payments/99001': {
        id: 99001, status: 'approved', transaction_amount: 9990,
        metadata: { user_id: 'user-viejo' }, payer: { email: 'viejo@ejemplo.cl' },
      },
    })

    await handleWebhook('payment', '99001')

    const cambio = cambiosEn('user-viejo').at(-1)
    expect(cambio?.values.status).toBe('active')
    expect(cambio?.values.mp_payment_id).toBe('99001')
    expect(inserts.filter(i => i.table === 'payment_receipts')).toHaveLength(1)
  })

  it('un pago no aprobado no toca nada', async () => {
    mockMercadoPago({
      '/v1/payments/99002': { id: 99002, status: 'rejected', metadata: { user_id: 'user-viejo' } },
    })

    await handleWebhook('payment', '99002')

    expect(updates).toHaveLength(0)
    expect(inserts).toHaveLength(0)
  })

  // Verificado con un pago real (2026-08-10): en un cobro de suscripción el
  // metadata llega VACÍO. El único lugar donde MP deja el preapproval es
  // point_of_interaction.transaction_data.subscription_id. Buscarlo en
  // metadata — como hacía la primera versión — no encuentra nunca nada.
  it('un pago de suscripción se resuelve por point_of_interaction', async () => {
    filas = { user_id: 'user-por-preapproval' }
    mockMercadoPago({
      '/v1/payments/99003': {
        id: 99003, status: 'approved', transaction_amount: 9990, metadata: {},
        point_of_interaction: { transaction_data: { subscription_id: 'pre-9' } },
      },
    })

    await handleWebhook('payment', '99003')

    expect(cambiosEn('user-por-preapproval').at(-1)?.values.status).toBe('active')
  })

  it('un pago que no se puede atribuir a nadie no activa a nadie', async () => {
    filas = null
    mockMercadoPago({
      '/v1/payments/99004': { id: 99004, status: 'approved', transaction_amount: 9990, metadata: {} },
    })

    await handleWebhook('payment', '99004')

    expect(updates).toHaveLength(0)
  })
})

describe('handleWebhook — topics desconocidos', () => {
  it('no revienta ni toca la base con un topic que no manejamos', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockMercadoPago({})

    await handleWebhook('plan', 'algo-inesperado')

    expect(updates).toHaveLength(0)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('topic no manejado'))
    warn.mockRestore()
  })
})
