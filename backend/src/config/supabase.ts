import dotenv from 'dotenv'
import path from 'path'
// override:true para que el .env siempre gane sobre vars heredadas vacías del shell padre
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true })

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const clean = (s: string) => { const t = (s ?? '').trim(); return t.charCodeAt(0) === 0xFEFF ? t.slice(1) : t }
const url = clean(process.env.SUPABASE_URL ?? '')
const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '')

console.log('[Supabase] URL prefix:', url.substring(0, 30))

if (!url || !key) {
  console.warn('[Supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados — usando modo local')
}

/**
 * Cliente admin con service_role.
 * null si las vars de entorno no están configuradas.
 */
export const supabaseAdmin: SupabaseClient | null = (url && key)
  ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  : null
