import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextType {
  user:    User | null
  session: Session | null
  loading: boolean
  signIn:  (email: string, password: string) => Promise<{ error: string | null }>
  signUp:  (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AUTH_ERRORS: Record<string, string> = {
  'Invalid login credentials':              'Correo o contraseña incorrectos',
  'Email not confirmed':                    'Debes confirmar tu correo antes de ingresar',
  'User already registered':               'Ya existe una cuenta con ese correo',
  'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres',
  'Signup is disabled':                     'El registro está desactivado temporalmente',
  'Email rate limit exceeded':             'Demasiados intentos. Espera unos minutos e intenta de nuevo',
  'Invalid email':                          'El correo electrónico no es válido',
  'User not found':                         'No existe una cuenta con ese correo',
  'over_email_send_rate_limit':            'Demasiados correos enviados. Espera antes de intentar de nuevo',
}

function translateAuthError(msg: string): string {
  for (const [en, es] of Object.entries(AUTH_ERRORS)) {
    if (msg.toLowerCase().includes(en.toLowerCase())) return es
  }
  return msg
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Carga sesión inicial
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    // Escucha cambios de sesión (login, logout, refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? translateAuthError(error.message) : null }
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error ? translateAuthError(error.message) : null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
