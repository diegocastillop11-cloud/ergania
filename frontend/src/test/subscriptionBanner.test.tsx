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

  it('dice "hoy" cuando vence el mismo día (daysLeft 0, días calendario)', () => {
    // Regresión: antes daysLeft se calculaba con Math.ceil de horas y nunca era 0,
    // así que un plan que vencía HOY decía "vence mañana".
    render(<SubscriptionBanner sub={{ ...base, daysLeft: 0 }} />)
    expect(screen.getByText(/vence hoy/)).toBeInTheDocument()
  })

  it('trial que termina el mismo día dice "termina hoy", no "0 días restantes"', () => {
    render(<SubscriptionBanner sub={{ ...base, status: 'trial', daysLeft: 0 }} />)
    expect(screen.getByText(/termina hoy/)).toBeInTheDocument()
  })

  it('el recordatorio es descartable', () => {
    const { container } = render(<SubscriptionBanner sub={{ ...base, daysLeft: 3 }} />)
    fireEvent.click(container.querySelector('button:last-child')!)
    expect(container.firstChild).toBeNull()
  })

  it('plan vencido muestra banner bloqueante con copy neutro (sirve para trial Y plan pagado)', () => {
    // Regresión: el backend marca 'expired' tanto al trial como al plan pagado que
    // terminó su mes; el copy no debe hablar de "prueba" porque el usuario pudo haber pagado.
    render(<SubscriptionBanner sub={{ ...base, status: 'expired', isActive: false, daysLeft: 0 }} />)
    expect(screen.getByText('Tu plan venció')).toBeInTheDocument()
    expect(screen.queryByText(/prueba/i)).not.toBeInTheDocument()
  })
})
