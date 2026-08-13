import dotenv from 'dotenv'
import path from 'path'
// override:true para que el .env siempre gane sobre vars heredadas vacías del shell padre
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true })

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const clean = (s: string) => { const t = (s ?? '').trim(); return t.charCodeAt(0) === 0xFEFF ? t.slice(1) : t }
// VITE_SUPABASE_URL como fallback — garantiza el mismo proyecto que el frontend
const url = clean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '')

console.log('[Supabase] url:', url.substring(0, 40), '| key prefix:', key.substring(0, 10))

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

/**
 * Supabase corta toda respuesta en 1000 filas: es el `perPage` máximo de
 * `auth.admin.listUsers` y el `max-rows` de PostgREST para cualquier `select`.
 * No devuelve error ni aviso — simplemente entrega 1000 y calla, así que un
 * conteo sin paginar se ve correcto hasta que la tabla cruza ese número y ahí
 * queda clavado para siempre (el panel de Admin marcó "1000 usuarios totales"
 * durante días con 1106 reales).
 */
const PAGE_SIZE = 1000
/** Tope defensivo: 100 páginas = 100k filas. Una serverless function no debe
 *  quedarse iterando si una query devuelve páginas llenas indefinidamente. */
const MAX_PAGES = 100

/** Todas las cuentas de auth.users, no solo la primera página. */
export async function listAllAuthUsers(client: SupabaseClient): Promise<any[]> {
  const all: any[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: PAGE_SIZE })
    if (error) {
      console.error(`[Supabase] listAllAuthUsers falló en la página ${page}:`, error.message)
      break
    }
    const users = data?.users ?? []
    all.push(...users)
    if (users.length < PAGE_SIZE) break
  }
  return all
}

/**
 * Recorre un `select` completo por rangos. Se le pasa la query como función
 * porque cada llamada necesita sus propios filtros y `order` — el `order` no es
 * opcional cuando hay más de una página: sin él PostgREST no garantiza un orden
 * estable entre rangos y se pueden repetir o perder filas.
 *
 *   const subs = await fetchAllRows((from, to) =>
 *     supabaseAdmin.from('subscriptions').select('*').order('created_at', { ascending: false }).range(from, to))
 */
export async function fetchAllRows<T = any>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label = 'select',
): Promise<T[]> {
  const all: T[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await query(from, from + PAGE_SIZE - 1)
    if (error) {
      // Se devuelve lo acumulado en vez de lanzar: los callers ya tratan un
      // resultado vacío como "sin datos" y un throw acá tumbaría todo el panel.
      console.error(`[Supabase] fetchAllRows(${label}) falló en el offset ${from}:`, error.message)
      break
    }
    const rows = data ?? []
    all.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }
  return all
}
