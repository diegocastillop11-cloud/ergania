/**
 * Tests del recordatorio de vencimiento en SubscriptionBanner.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SubscriptionBanner from '../components/subscription/SubscriptionBanner'
import type { SubscriptionState } from '../hooks/useSubscription'

const base: SubscriptionState = {
  loading: false,
  status: 'active',
  daysLeft: null,
  isActive: true,
  openCheckout: vi.fn(),
  cancel: vi.fn(),
  refresh: vi.fn(),
}

describe('SubscriptionBanner — recordatorio de vencimiento', () => {
  it('no muestra nada con plan activo lejos de vencer', () => {
    const { container } = render(<SubscriptionBanner sub={{ ...base, daysLeft: 20 }} />)
    expect(container.firstChild).toBeNull()
  })

  it('no muestra nada con plan activo sin fecha de vencimiento', () => {
    const { container } = render(<SubscriptionBanner sub={base} />)
    expect(container.firstChild).toBeNull()
  })

  it('muestra recordatorio con botón Renovar cuando vence en ≤3 días', () => {
    render(<SubscriptionBanner sub={{ ...base, daysLeft: 2 }} />)
    expect(screen.getByText(/vence en 2 días/)).toBeInTheDocument()
    expect(screen.getByText(/Renovar/)).toBeInTheDocument()
  })

  it('dice "mañana" cuando queda 1 día', () => {
    render(<SubscriptionBanner sub={{ ...base, daysLeft: 1 }} />)
    expect(screen.getByText(/vence mañana/)).toBeInTheDocument()
  })

  it('el recordatorio es descartable', () => {
    const { container } = render(<SubscriptionBanner sub={{ ...base, daysLeft: 3 }} />)
    fireEvent.click(container.querySelector('button:last-child')!)
    expect(container.firstChild).toBeNull()
  })

  it('trial vencido sigue mostrando el banner bloqueante', () => {
    render(<SubscriptionBanner sub={{ ...base, status: 'expired', isActive: false, daysLeft: 0 }} />)
    expect(screen.getByText(/Período de prueba finalizado/)).toBeInTheDocument()
  })
})
