/**
 * Tests de SubscriptionBanner: estados de trial/pago y los dos proveedores
 * (MercadoPago Preapproval + PayPal Subscriptions), ambos con cobro automático
 * — ya no existe recordatorio de renovación manual (ver 018_mp_preapproval.sql).
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
  it('no muestra nada con plan activo y cobro al día, sin importar days left', () => {
    const { container } = render(<SubscriptionBanner sub={{ ...base, daysLeft: 20 }} />)
    expect(container.firstChild).toBeNull()
  })

  it('no muestra nada con plan activo cerca de vencer — MP y PayPal cobran solos', () => {
    // Antes de migrar MP a Preapproval, esto mostraba un recordatorio "Renovar".
    // Con cobro automático en ambos proveedores, ya no hay nada que recordarle al usuario.
    const { container } = render(<SubscriptionBanner sub={{ ...base, daysLeft: 2 }} />)
    expect(container.firstChild).toBeNull()
  })

  it('muestra banner de actualizar método de pago si el cobro automático quedó suspendido', () => {
    render(<SubscriptionBanner sub={{ ...base, paymentSuspended: true }} />)
    expect(screen.getByText(/No pudimos cobrar tu suscripción/)).toBeInTheDocument()
    expect(screen.getByText(/Actualizar método de pago/)).toBeInTheDocument()
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
