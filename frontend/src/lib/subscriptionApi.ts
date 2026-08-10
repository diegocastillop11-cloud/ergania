import axios from 'axios'
import { supabase } from './supabase'
import { handleUnauthorized } from './api'

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/subscription` })

api.interceptors.request.use(async config => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

// Extrae el campo "error" del body JSON del backend y lo lanza como mensaje
api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401 && await handleUnauthorized()) {
      return new Promise(() => {}) // redirigiendo a /login — no propagar el error
    }
    const msg = err.response?.data?.error || err.message
    return Promise.reject(new Error(msg))
  }
)

export async function fetchSubscriptionStatus() {
  const { data } = await api.get<{
    subscription: SubscriptionRecord
    computed: ComputedStatus
  }>('/status')
  return data
}

export async function startCheckout(): Promise<{ checkoutUrl: string }> {
  const { data } = await api.post('/checkout')
  return data
}

export async function startPayPalCheckout(): Promise<{ checkoutUrl: string }> {
  const { data } = await api.post('/checkout/paypal')
  return data
}

export async function linkPreapproval(preapprovalId: string): Promise<{ status: string; cobrado: boolean }> {
  const { data } = await api.post('/link-preapproval', { preapproval_id: preapprovalId })
  return data
}

export async function cancelSubscription(): Promise<void> {
  await api.post('/cancel')
}

export async function deleteAccount(motivo: string): Promise<void> {
  await api.post('/delete-account', { motivo })
}

export interface SubscriptionRecord {
  id: string
  user_id: string
  status: 'trial' | 'active' | 'expired' | 'cancelled' | 'pending_payment' | 'none'
  trial_ends_at: string | null
  current_period_end: string | null
  payment_provider?: 'mercadopago' | 'paypal'
  payment_suspended?: boolean
  // Distinguen los dos flujos de MP: quien ya pagó por Checkout Pro (pago
  // manual) tiene mp_payment_id sin mp_preapproval_id. Ver createCheckoutLink.
  mp_payment_id?: string | null
  mp_preapproval_id?: string | null
}

export interface ComputedStatus {
  status: 'trial' | 'active' | 'expired' | 'cancelled' | 'pending_payment' | 'none'
  daysLeft: number | null
  trialEndsAt?: string
  currentPeriodEnd?: string
  paymentProvider?: 'mercadopago' | 'paypal'
  paymentSuspended?: boolean
}
