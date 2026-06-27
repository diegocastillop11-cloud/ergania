/**
 * Cliente axios global para Career Ops.
 * Inyecta el Bearer token de Supabase Auth en cada request.
 * El backend lo verifica y extrae el email del JWT.
 */
import axios from 'axios'
import { supabase } from './supabase'

export const api = axios.create({
  baseURL: '/api/careers',
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
