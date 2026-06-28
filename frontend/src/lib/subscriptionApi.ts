import axios from 'axios'
import { supabase } from './supabase'

const api = axios.create({ baseURL: '/api/subscription' })

api.interceptors.request.use(async config => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

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

export async function cancelSubscription(): Promise<void> {
  await api.post('/cancel')
}

export interface SubscriptionRecord {
  id: string
  user_id: string
  status: 'trial' | 'active' | 'expired' | 'cancelled' | 'pending_payment' | 'none'
  trial_ends_at: string | null
  current_period_end: string | null
}

export interface ComputedStatus {
  status: 'trial' | 'active' | 'expired' | 'cancelled' | 'pending_payment' | 'none'
  daysLeft: number | null
  trialEndsAt?: string
  currentPeriodEnd?: string
}
