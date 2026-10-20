/**
 * Sustituto de supabase-js para el modo offline (VITE_LOCAL_MODE=1, ver scripts/local.mjs).
 * Siempre hay una sesión abierta con un usuario fijo; el backend local acepta cualquier token.
 * Solo implementa lo que consume la app: login, sesión y user_metadata.
 */
const LOCAL_EMAIL = (import.meta.env.VITE_LOCAL_USER_EMAIL as string | undefined) ?? 'local@ergania.local'

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: LOCAL_EMAIL,
  aud: 'authenticated',
  app_metadata: {},
  user_metadata: { terms_accepted_at: '2026-01-01T00:00:00.000Z' },
  created_at: '2026-01-01T00:00:00.000Z',
}

const session = {
  access_token: 'local',
  refresh_token: 'local',
  token_type: 'bearer',
  expires_in: 3600 * 24 * 365,
  expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
  user,
}

const ok = { data: { session, user }, error: null }

export const localSupabase = {
  auth: {
    getSession: async () => ({ data: { session }, error: null }),
    refreshSession: async () => ({ data: { session, user }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async () => ok,
    signUp: async () => ok,
    signInWithOAuth: async () => ({ data: {}, error: null }),
    signOut: async () => ({ error: null }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
    updateUser: async () => ({ data: { user }, error: null }),
    setSession: async () => ok,
    getUser: async () => ({ data: { user }, error: null }),
  },
}
