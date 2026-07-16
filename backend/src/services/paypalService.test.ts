import { describe, it, expect } from 'vitest'
import { mapPayPalEventToStatus } from './paypalService'

describe('mapPayPalEventToStatus', () => {
  it('mapea BILLING.SUBSCRIPTION.ACTIVATED a active', () => {
    expect(mapPayPalEventToStatus('BILLING.SUBSCRIPTION.ACTIVATED')).toBe('active')
  })

  it('mapea BILLING.SUBSCRIPTION.CANCELLED a cancelled', () => {
    expect(mapPayPalEventToStatus('BILLING.SUBSCRIPTION.CANCELLED')).toBe('cancelled')
  })

  it('devuelve null para PAYMENT.SALE.COMPLETED (se maneja aparte)', () => {
    expect(mapPayPalEventToStatus('PAYMENT.SALE.COMPLETED')).toBeNull()
  })

  it('devuelve null para eventos desconocidos', () => {
    expect(mapPayPalEventToStatus('SOME.RANDOM.EVENT')).toBeNull()
  })

  it('devuelve null para string vacío', () => {
    expect(mapPayPalEventToStatus('')).toBeNull()
  })
})
