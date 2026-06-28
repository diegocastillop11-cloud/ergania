import dotenv from 'dotenv'
import path from 'path'
// override:true para que el .env siempre gane sobre vars heredadas vacías del shell padre
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true })

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const stripBOM = (s: string) => s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s
const url = stripBOM(process.env.SUPABASE_URL ?? '')
const key = stripBOM(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '')

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
