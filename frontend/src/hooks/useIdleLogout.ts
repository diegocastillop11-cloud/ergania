import { useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'

const TIMEOUT_MS = 15 * 60 * 1000
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const

export function useIdleLogout() {
  const { session, signOut } = useAuth()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!session) return

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => signOut(), TIMEOUT_MS)
    }

    reset()
    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, reset, { passive: true }))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, reset))
    }
  }, [session, signOut])
}
