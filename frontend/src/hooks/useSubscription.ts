import { useState, useEffect, useCallback } from 'react'
import { fetchSubscriptionStatus, startCheckout, startPayPalCheckout, cancelSubscription, ComputedStatus, SubscriptionRecord } from '../lib/subscriptionApi'

// Último estado CONFIRMADO por el backend, cacheado por pestaña. Sin esto, cada
// recarga de página arranca con computed=null — y si justo esa carga falla por
// red, cualquiera (no solo un usuario legítimo con un hiccup) entraría gratis,
// incluyendo alguien ya vencido/cancelado que sabíamos que no debía pasar. Se
// limpia en el logout (AuthContext) para no filtrar el estado entre usuarios
// que compartan la misma pestaña/equipo.
export const SUBSCRIPTION_CACHE_KEY = 'ergania:sub:lastKnown'

function readCachedStatus(): ComputedStatus | null {
  try {
    const raw = sessionStorage.getItem(SUBSCRIPTION_CACHE_KEY)
    return raw ? JSON.parse(raw) as ComputedStatus : null
  } catch {
    return null
  }
}

function writeCachedStatus(computed: ComputedStatus) {
  try { sessionStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(computed)) } catch { /* storage no disponible */ }
}

export type SubscriptionState = {
  loading: boolean
  status: ComputedStatus['status']
  daysLeft: number | null
  isActive: boolean   // trial, active, o pending_payment dentro del trial
  loadError: boolean  // el chequeo de estado falló (red/backend) — no es lo mismo que "vencido"
  paymentProvider?: 'mercadopago' | 'paypal'
  paymentSuspended: boolean
  // Si al suscribirse el cobro va a quedar recurrente. Falso solo para los
  // clientes que ya pagaron por Checkout Pro, que siguen renovando a mano.
  mpAutoRenew: boolean
  openCheckout: () => Promise<void>
  openPayPalCheckout: () => Promise<void>
  cancel: () => Promise<void>
  refresh: () => Promise<void>
}

export function useSubscription(): SubscriptionState {
  const [loading, setLoading]     = useState(true)
  const [computed, setComputed]   = useState<ComputedStatus | null>(null)
  const [record, setRecord]       = useState<SubscriptionRecord | null>(null)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    try {
      const { computed, subscription } = await fetchSubscriptionStatus()
      setComputed(computed)
      setRecord(subscription)
      setLoadError(false)
      writeCachedStatus(computed)
    } catch {
      // Falla transitoria (red, backend caído) — NO asumimos "vencido": eso
      // bloquearía a un usuario que sí está pagando por un simple hiccup.
      // Mantenemos el último estado conocido (memoria o, si esta es la
      // primera carga de la pestaña, el cache de la última vez que sí
      // confirmamos) y solo marcamos el error para no mostrarle el cobro
      // hasta poder confirmar el estado real.
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

  // Si esta carga falló y no tenemos datos en memoria, usamos el último
  // estado confirmado de esta pestaña (si existe) en vez de asumir cualquier
  // cosa — así alguien ya vencido/cancelado sigue vencido/cancelado aunque
  // justo esta carga haya fallado por red.
  const effective = computed ?? (loadError ? readCachedStatus() : null)
  const status = effective?.status ?? 'none'

  // pending_payment (checkout iniciado pero no confirmado) no bloquea mientras
  // le queden días del trial original — solo se le pide pagar cuando se le acaben
  const confirmedActive = status === 'trial' || status === 'active'
    || (status === 'pending_payment' && (effective?.daysLeft ?? 0) > 0)

  // Solo dejamos pasar sin confirmar cuando NUNCA hubo un estado conocido —
  // ni en memoria ni cacheado de una carga anterior de esta pestaña. Eso
  // reduce el "fail-open" a "nunca se pudo verificar todavía", no a
  // "ya sabíamos que no tenía acceso y hubo un hiccup".
  const isActive = effective === null && loadError ? true : confirmedActive

  return {
    loading,
    status,
    daysLeft: effective?.daysLeft ?? null,
    isActive,
    loadError,
    paymentProvider: effective?.paymentProvider,
    paymentSuspended: effective?.paymentSuspended ?? false,
    // Ante la duda (aún no cargó el registro) se asume recurrente, que es el
    // caso de todos los usuarios nuevos.
    mpAutoRenew: !(record?.mp_payment_id && !record?.mp_preapproval_id),
    openCheckout,
    openPayPalCheckout,
    cancel,
    refresh: load,
  }
}
