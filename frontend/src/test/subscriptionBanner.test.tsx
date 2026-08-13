/**
 * Tests de SubscriptionBanner: estados de trial/pago y a dónde llevan los CTA.
 * MP es Checkout Pro (pago manual, sí necesita recordatorio de renovación).
 * PayPal es Subscriptions (cobro automático, no lo necesita).
 *
 * El banner NO cobra directo desde acá: desde 4674bb3 todos sus CTA son <Link> a
 * /subscription, donde vive el checkbox de aceptación de Términos y renuncia al
 * derecho a retracto exigido antes del pago (Ley 19.496, art. 3° bis). La elección
 * entre MercadoPago y PayPal ocurre en esa página, no en el banner.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SubscriptionBanner from '../components/subscription/SubscriptionBanner'
import type { SubscriptionState } from '../hooks/useSubscription'
import { LanguageProvider } from '../lib/i18n/LanguageContext'
import { MemoryRouter } from 'react-router-dom'

// El banner usa <Link>, que sin Router de por medio revienta al renderizar.
function renderBanner(sub: SubscriptionState) {
  return render(
    <MemoryRouter>
      <LanguageProvider><SubscriptionBanner sub={sub} /></LanguageProvider>
    </MemoryRouter>
  )
}

const base: SubscriptionState = {
  loading: false,
  status: 'active',
  daysLeft: null,
  isActive: true,
  loadError: false,
  paymentSuspended: false,
  mpAutoRenew: true,
  openCheckout: vi.fn(),
  openPayPalCheckout: vi.fn(),
  cancel: vi.fn(),
  refresh: vi.fn(),
}

describe('SubscriptionBanner — plan activo', () => {
  it('no muestra nada con plan activo lejos de vencer', () => {
    const { container } = renderBanner({ ...base, daysLeft: 20 })
    expect(container.firstChild).toBeNull()
  })

  it('no muestra nada con plan activo sin fecha de vencimiento', () => {
    const { container } = renderBanner(base)
    expect(container.firstChild).toBeNull()
  })

  it('muestra recordatorio con botón Renovar cuando MP vence en ≤3 días', () => {
    renderBanner({ ...base, daysLeft: 2, paymentProvider: 'mercadopago' })
    expect(screen.getByText(/vence en 2 días/)).toBeInTheDocument()
    expect(screen.getByText(/Renovar/)).toBeInTheDocument()
  })

  it('NO muestra recordatorio de renovación si el proveedor es PayPal (cobra solo)', () => {
    const { container } = renderBanner({ ...base, daysLeft: 2, paymentProvider: 'paypal' })
    expect(container.firstChild).toBeNull()
  })

  it('el recordatorio de MP es descartable', () => {
    const { container } = renderBanner({ ...base, daysLeft: 3, paymentProvider: 'mercadopago' })
    fireEvent.click(container.querySelector('button:last-child')!)
    expect(container.firstChild).toBeNull()
  })
})

describe('SubscriptionBanner — trial', () => {
  it('trial que termina el mismo día dice "termina hoy", no "0 días restantes"', () => {
    renderBanner({ ...base, status: 'trial', daysLeft: 0 })
    expect(screen.getByText(/termina hoy/)).toBeInTheDocument()
  })

  it('el CTA con el precio lleva a /subscription en vez de cobrar directo', () => {
    renderBanner({ ...base, status: 'trial', daysLeft: 2 })
    expect(screen.getByRole('link', { name: /Suscribirse \$9.990\/mes/ }))
      .toHaveAttribute('href', '/subscription')
  })

  it('el banner de trial es descartable', () => {
    const { container } = renderBanner({ ...base, status: 'trial', daysLeft: 3 })
    fireEvent.click(container.querySelector('button:last-child')!)
    expect(container.firstChild).toBeNull()
  })
})

describe('SubscriptionBanner — plan vencido', () => {
  it('plan vencido muestra banner bloqueante con copy neutro (sirve para trial Y plan pagado)', () => {
    // Regresión: el backend marca 'expired' tanto al trial como al plan pagado que
    // terminó su mes; el copy no debe hablar de "prueba" porque el usuario pudo haber pagado.
    renderBanner({ ...base, status: 'expired', isActive: false, daysLeft: 0 })
    expect(screen.getByText('Tu plan venció')).toBeInTheDocument()
    expect(screen.queryByText(/prueba/i)).not.toBeInTheDocument()
  })

  it('ofrece reactivar llevando a /subscription (ahí están MP y PayPal)', () => {
    renderBanner({ ...base, status: 'expired', isActive: false, daysLeft: 0 })
    expect(screen.getByRole('link', { name: /Suscribirme/ }))
      .toHaveAttribute('href', '/subscription')
  })

  it('el banner bloqueante no se puede descartar', () => {
    const { container } = renderBanner({ ...base, status: 'cancelled', isActive: false, daysLeft: 0 })
    expect(container.querySelector('button')).toBeNull()
    expect(screen.getByText('Suscripción cancelada')).toBeInTheDocument()
  })
})
