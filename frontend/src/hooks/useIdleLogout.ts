import { useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'

const TIMEOUT_MS = 15 * 60 * 1000
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const

export function useIdleLogout() {
  const { session, signOut } = useAuth()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const signOutRef = useRef(signOut)
  signOutRef.current = signOut

  const hasSession = !!session

  useEffect(() => {
    // Depende solo de hasSession (booleano): session/signOut cambian de
    // referencia en cada refresh silencioso de token de Supabase, y si
    // estuvieran en las deps el timer se reiniciaba solo sin actividad real.
    if (!hasSession) return

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => signOutRef.current(), TIMEOUT_MS)
    }

    reset()
    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, reset, { passive: true }))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, reset))
    }
  }, [hasSession])
}
