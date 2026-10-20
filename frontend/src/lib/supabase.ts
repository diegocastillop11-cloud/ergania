import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { localSupabase } from './localSupabase'

const url  = import.meta.env.VITE_SUPABASE_URL  as string
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key) {
  console.warn('[Supabase] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env.local')
}

export const supabase: SupabaseClient = import.meta.env.VITE_LOCAL_MODE === '1'
  ? (localSupabase as unknown as SupabaseClient)
  : createClient(url, key)
