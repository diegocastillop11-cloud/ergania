import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { translateAuthError } from './authErrors'

interface AuthContextType {
  user:    User | null
  session: Session | null
  loading: boolean
  signIn:  (email: string, password: string) => Promise<{ error: string | null }>
  signUp:  (email: string, password: string) => Promise<{ error: string | null, session: Session | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const userSignOut = useRef(false)
  const revokedFor  = useRef<string | null>(null)

  useEffect(() => {
    // Carga sesión inicial
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    // Escucha cambios de sesión (login, logout, refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      // Sesión única: el login más reciente revoca todas las demás sesiones del
      // usuario (el backend rechaza tokens de sesiones revocadas via getUser)
      if (event === 'SIGNED_IN' && session && revokedFor.current !== session.user.id) {
        revokedFor.current = session.user.id
        supabase.auth.signOut({ scope: 'others' }).catch(() => {})
      }

      // Cierre NO iniciado por el usuario (revocada desde otro dispositivo o expirada):
      // dejar marca para que Login explique por qué se cerró
      if (event === 'SIGNED_OUT') {
        if (!userSignOut.current) sessionStorage.setItem('ergania:sessionClosed', '1')
        userSignOut.current = false
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? translateAuthError(error.message) : null }
  }

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (!error && data?.session) {
      fetch('/api/admin/notify-signup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      }).catch(() => {})
    }
    return { error: error ? translateAuthError(error.message) : null, session: data?.session ?? null }
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    return { error: error ? translateAuthError(error.message) : null }
  }

  const signOut = async () => {
    userSignOut.current = true
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
