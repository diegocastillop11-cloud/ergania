import { useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'

const TIMEOUT_MS = 15 * 60 * 1000
const KEY = 'ergania:lastActivity'
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const

// Basado en timestamp persistido, no en setTimeout: los timers largos son
// throttleados por el navegador en pestañas ocultas y no sobreviven recargas.
// El chequeo corre cada 30s, al volver a la pestaña y al montar.
export function useIdleLogout() {
  const { session, signOut } = useAuth()
  const hasSession = !!session

  useEffect(() => {
    if (!hasSession) return

    localStorage.setItem(KEY, String(Date.now()))
    const mark = () => localStorage.setItem(KEY, String(Date.now()))

    let closing = false
    const check = async () => {
      const last = Number(localStorage.getItem(KEY)) || Date.now()
      if (!closing && Date.now() - last >= TIMEOUT_MS) {
        closing = true
        try { await signOut() } finally { window.location.replace('/login') }
      }
    }

    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, mark, { passive: true }))
    document.addEventListener('visibilitychange', check)
    const interval = setInterval(check, 30_000)
    check()

    return () => {
      clearInterval(interval)
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, mark))
      document.removeEventListener('visibilitychange', check)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession])
}
