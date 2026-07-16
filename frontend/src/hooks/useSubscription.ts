import { useState, useEffect, useCallback } from 'react'
import { fetchSubscriptionStatus, startCheckout, startPayPalCheckout, cancelSubscription, ComputedStatus } from '../lib/subscriptionApi'

export type SubscriptionState = {
  loading: boolean
  status: ComputedStatus['status']
  daysLeft: number | null
  isActive: boolean   // trial, active, o pending_payment dentro del trial
  paymentProvider?: 'mercadopago' | 'paypal'
  paymentSuspended: boolean
  openCheckout: () => Promise<void>
  openPayPalCheckout: () => Promise<void>
  cancel: () => Promise<void>
  refresh: () => Promise<void>
}

export function useSubscription(): SubscriptionState {
  const [loading, setLoading]   = useState(true)
  const [computed, setComputed] = useState<ComputedStatus>({ status: 'none', daysLeft: null })

  const load = useCallback(async () => {
    try {
      const { computed } = await fetchSubscriptionStatus()
      setComputed(computed)
    } catch {
      // Not fatal — show as expired so the banner appears
      setComputed({ status: 'expired', daysLeft: 0 })
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

  // pending_payment (checkout iniciado pero no confirmado) no bloquea mientras
  // le queden días del trial original — solo se le pide pagar cuando se le acaben
  const isActive = computed.status === 'trial' || computed.status === 'active'
    || (computed.status === 'pending_payment' && (computed.daysLeft ?? 0) > 0)

  return {
    loading,
    status: computed.status,
    daysLeft: computed.daysLeft,
    isActive,
    paymentProvider: computed.paymentProvider,
    paymentSuspended: computed.paymentSuspended ?? false,
    openCheckout,
    openPayPalCheckout,
    cancel,
    refresh: load,
  }
}
