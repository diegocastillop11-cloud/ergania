/**
 * Tests de SubscriptionBanner: estados de trial/pago y los dos proveedores.
 * MP es Checkout Pro (pago manual, sí necesita recordatorio de renovación).
 * PayPal es Subscriptions (cobro automático, no lo necesita).
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
  paymentSuspended: false,
  openCheckout: vi.fn(),
  openPayPalCheckout: vi.fn(),
  cancel: vi.fn(),
  refresh: vi.fn(),
}

describe('SubscriptionBanner — plan activo', () => {
  it('no muestra nada con plan activo lejos de vencer', () => {
    const { container } = render(<SubscriptionBanner sub={{ ...base, daysLeft: 20 }} />)
    expect(container.firstChild).toBeNull()
  })

  it('no muestra nada con plan activo sin fecha de vencimiento', () => {
    const { container } = render(<SubscriptionBanner sub={base} />)
    expect(container.firstChild).toBeNull()
  })

  it('muestra recordatorio con botón Renovar cuando MP vence en ≤3 días', () => {
    render(<SubscriptionBanner sub={{ ...base, daysLeft: 2, paymentProvider: 'mercadopago' }} />)
    expect(screen.getByText(/vence en 2 días/)).toBeInTheDocument()
    expect(screen.getByText(/Renovar/)).toBeInTheDocument()
  })

  it('NO muestra recordatorio de renovación si el proveedor es PayPal (cobra solo)', () => {
    const { container } = render(<SubscriptionBanner sub={{ ...base, daysLeft: 2, paymentProvider: 'paypal' }} />)
    expect(container.firstChild).toBeNull()
  })

  it('el recordatorio de MP es descartable', () => {
    const { container } = render(<SubscriptionBanner sub={{ ...base, daysLeft: 3, paymentProvider: 'mercadopago' }} />)
    fireEvent.click(container.querySelector('button:last-child')!)
    expect(container.firstChild).toBeNull()
  })
})

describe('SubscriptionBanner — trial', () => {
  it('trial que termina el mismo día dice "termina hoy", no "0 días restantes"', () => {
    render(<SubscriptionBanner sub={{ ...base, status: 'trial', daysLeft: 0 }} />)
    expect(screen.getByText(/termina hoy/)).toBeInTheDocument()
  })

  it('muestra los dos botones de pago (Mercado Pago y PayPal)', () => {
    render(<SubscriptionBanner sub={{ ...base, status: 'trial', daysLeft: 2 }} />)
    expect(screen.getByText(/Suscribirse \$9.990\/mes/)).toBeInTheDocument()
    expect(screen.getByText(/Pay with PayPal/)).toBeInTheDocument()
  })

  it('el banner de trial es descartable', () => {
    const { container } = render(<SubscriptionBanner sub={{ ...base, status: 'trial', daysLeft: 3 }} />)
    fireEvent.click(container.querySelector('button:last-child')!)
    expect(container.firstChild).toBeNull()
  })
})

describe('SubscriptionBanner — plan vencido', () => {
  it('plan vencido muestra banner bloqueante con copy neutro (sirve para trial Y plan pagado)', () => {
    // Regresión: el backend marca 'expired' tanto al trial como al plan pagado que
    // terminó su mes; el copy no debe hablar de "prueba" porque el usuario pudo haber pagado.
    render(<SubscriptionBanner sub={{ ...base, status: 'expired', isActive: false, daysLeft: 0 }} />)
    expect(screen.getByText('Tu plan venció')).toBeInTheDocument()
    expect(screen.queryByText(/prueba/i)).not.toBeInTheDocument()
  })

  it('ofrece ambos proveedores para reactivar', () => {
    render(<SubscriptionBanner sub={{ ...base, status: 'expired', isActive: false, daysLeft: 0 }} />)
    expect(screen.getByText(/Mercado Pago — \$9.990\/mes/)).toBeInTheDocument()
    expect(screen.getByText(/PayPal — \$12.99\/mo/)).toBeInTheDocument()
  })
})
