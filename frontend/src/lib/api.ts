/**
 * Cliente axios global para Career Ops.
 * Inyecta el Bearer token de Supabase Auth en cada request.
 * El backend lo verifica y extrae el email del JWT.
 */
import axios from 'axios'
import { supabase } from './supabase'

export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/careers`,
})

// Interceptor: lee la sesión activa y manda el access_token
api.interceptors.request.use(async config => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// 401 del backend: si el refresh también falla, la sesión fue revocada
// (login en otro dispositivo) — cerrar solo este cliente y explicar en /login
export async function handleUnauthorized(): Promise<boolean> {
  const { error } = await supabase.auth.refreshSession()
  if (!error) return false
  sessionStorage.setItem('ergania:sessionClosed', '1')
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  window.location.replace('/login')
  return true
}

api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401 && await handleUnauthorized()) {
      return new Promise(() => {}) // redirigiendo a /login — no propagar el error
    }
    return Promise.reject(err)
  }
)
