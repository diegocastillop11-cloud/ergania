import { useState, useEffect, useCallback } from 'react'
import { fetchSubscriptionStatus, startCheckout, startPayPalCheckout, cancelSubscription, ComputedStatus } from '../lib/subscriptionApi'

export type SubscriptionState = {
  loading: boolean
  status: ComputedStatus['status']
  daysLeft: number | null
  isActive: boolean   // trial, active, o pending_payment dentro del trial
  loadError: boolean  // el chequeo de estado falló (red/backend) — no es lo mismo que "vencido"
  paymentProvider?: 'mercadopago' | 'paypal'
  paymentSuspended: boolean
  openCheckout: () => Promise<void>
  openPayPalCheckout: () => Promise<void>
  cancel: () => Promise<void>
  refresh: () => Promise<void>
}

export function useSubscription(): SubscriptionState {
  const [loading, setLoading]     = useState(true)
  const [computed, setComputed]   = useState<ComputedStatus | null>(null)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    try {
      const { computed } = await fetchSubscriptionStatus()
      setComputed(computed)
      setLoadError(false)
    } catch {
      // Falla transitoria (red, backend caído) — NO asumimos "vencido": eso
      // bloquearía a un usuario que sí está pagando por un simple hiccup.
      // Mantenemos el último estado conocido y solo marcamos el error para
      // no mostrarle el cobro hasta poder confirmar el estado real.
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCheckout = async () => {
    const { checkoutUrl } = await startCheckout()
    window.location.href = checkoutUrl
  }

  const openPayPalCheckout = async () => {
    const { checkoutUrl } = await startPayPalCheckout()
    window.location.href = checkoutUrl
  }

  const cancel = async () => {
    await cancelSubscription()
    await load()
  }

  const status = computed?.status ?? 'none'

  // pending_payment (checkout iniciado pero no confirmado) no bloquea mientras
  // le queden días del trial original — solo se le pide pagar cuando se le acaben
  const confirmedActive = status === 'trial' || status === 'active'
    || (status === 'pending_payment' && (computed?.daysLeft ?? 0) > 0)

  // Si nunca se pudo cargar el estado real (loadError y sin datos previos),
  // no bloqueamos por las dudas — un error de carga no es lo mismo que estar vencido.
  const isActive = computed === null && loadError ? true : confirmedActive

  return {
    loading,
    status,
    daysLeft: computed?.daysLeft ?? null,
    isActive,
    loadError,
    paymentProvider: computed?.paymentProvider,
    paymentSuspended: computed?.paymentSuspended ?? false,
    openCheckout,
    openPayPalCheckout,
    cancel,
    refresh: load,
  }
}
