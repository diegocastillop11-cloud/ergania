import { describe, it, expect } from 'vitest'
import { mapMpPreapprovalStatus } from './subscriptionService'

describe('mapMpPreapprovalStatus', () => {
  it('mapea authorized a active', () => {
    expect(mapMpPreapprovalStatus('authorized')).toBe('active')
  })

  it('mapea cancelled a cancelled', () => {
    expect(mapMpPreapprovalStatus('cancelled')).toBe('cancelled')
  })

  it('devuelve null para pending (aún no autorizado)', () => {
    expect(mapMpPreapprovalStatus('pending')).toBeNull()
  })

  it('devuelve null para paused/suspended (se manejan aparte como payment_suspended)', () => {
    expect(mapMpPreapprovalStatus('paused')).toBeNull()
    expect(mapMpPreapprovalStatus('suspended')).toBeNull()
  })

  it('devuelve null para estados desconocidos', () => {
    expect(mapMpPreapprovalStatus('algo-inesperado')).toBeNull()
  })
})
