/**
 * Tests del endpoint que recibe las notificaciones de MercadoPago.
 *
 * Este archivo cubre el segundo punto de fallo silencioso del cobro recurrente:
 * las notificaciones de suscripción llegan como POST con el id en el body, no
 * en la query. Si la firma se valida contra la query (como estaba), NUNCA
 * coincide y cada cobro mensual se descarta con un 200 — MP lo da por
 * entregado, no reintenta, y el usuario pierde acceso habiendo pagado.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import type { Request, Response } from 'express'

const handleWebhook = vi.fn().mockResolvedValue(undefined)
vi.mock('../services/subscriptionService', () => ({ handleWebhook: (...a: unknown[]) => handleWebhook(...a) }))
vi.mock('../services/paypalService', () => ({}))
vi.mock('../config/supabase', () => ({ supabaseAdmin: {} }))

import { webhook } from './subscriptionController'

const SECRET = 'secreto-de-prueba'

function firmar(dataId: string, requestId: string, ts = '1700000000') {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
  const v1 = crypto.createHmac('sha256', SECRET).update(manifest).digest('hex')
  return `ts=${ts},v1=${v1}`
}

function fakeReq(opciones: { body?: unknown; query?: unknown; headers?: Record<string, string> }) {
  return { body: opciones.body ?? {}, query: opciones.query ?? {}, headers: opciones.headers ?? {} } as unknown as Request
}

const fakeRes = () => ({ sendStatus: vi.fn() }) as unknown as Response

beforeEach(() => {
  handleWebhook.mockClear()
  delete process.env.MP_WEBHOOK_SECRET
})

describe('webhook de MercadoPago', () => {
  it('acepta una notificación de suscripción que trae el id en el body', async () => {
    process.env.MP_WEBHOOK_SECRET = SECRET
    const req = fakeReq({
      body: { type: 'subscription_authorized_payment', data: { id: 'ap-123' } },
      headers: { 'x-signature': firmar('ap-123', 'req-1'), 'x-request-id': 'req-1' },
    })

    await webhook(req, fakeRes())

    expect(handleWebhook).toHaveBeenCalledWith('subscription_authorized_payment', 'ap-123')
  })

  it('sigue aceptando la notificación vieja con los datos en la query', async () => {
    process.env.MP_WEBHOOK_SECRET = SECRET
    const req = fakeReq({
      query: { topic: 'payment', id: '99001' },
      headers: { 'x-signature': firmar('99001', 'req-2'), 'x-request-id': 'req-2' },
    })

    await webhook(req, fakeRes())

    expect(handleWebhook).toHaveBeenCalledWith('payment', '99001')
  })

  it('descarta una notificación con firma falsa', async () => {
    process.env.MP_WEBHOOK_SECRET = SECRET
    const req = fakeReq({
      body: { type: 'subscription_authorized_payment', data: { id: 'ap-999' } },
      headers: { 'x-signature': 'ts=1700000000,v1=' + 'a'.repeat(64), 'x-request-id': 'req-3' },
    })

    await webhook(req, fakeRes())

    expect(handleWebhook).not.toHaveBeenCalled()
  })

  it('responde 200 aunque el procesamiento falle, para que MP no reintente en loop', async () => {
    handleWebhook.mockRejectedValueOnce(new Error('MercadoPago 500'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = fakeRes()

    await webhook(fakeReq({ query: { topic: 'payment', id: '1' } }), res)

    expect(res.sendStatus).toHaveBeenCalledWith(200)
    expect(error).toHaveBeenCalled() // el 200 no debe borrar el rastro del fallo
    error.mockRestore()
  })
})
