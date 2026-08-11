import { useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'

const TIMEOUT_MS = 15 * 60 * 1000
const KEY = 'ergania:lastActivity'
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'] as const
// Escribir en localStorage en cada mousemove es caro y no aporta nada: refrescar la
// marca una vez cada 30s queda muy por debajo del timeout.
const MARK_EVERY_MS = 30_000

// Basado en timestamp persistido, no en setTimeout: los timers largos son
// throttleados por el navegador en pestañas ocultas y no sobreviven recargas.
// El chequeo corre cada 30s, al volver a la pestaña y al montar.
export function useIdleLogout() {
  const { session, signOut } = useAuth()
  const hasSession = !!session

  useEffect(() => {
    if (!hasSession) return

    let lastMark = 0
    const mark = () => {
      const now = Date.now()
      if (now - lastMark < MARK_EVERY_MS) return
      lastMark = now
      localStorage.setItem(KEY, String(now))
    }
    mark()

    let closing = false
    const check = async () => {
      const last = Number(localStorage.getItem(KEY)) || Date.now()
      if (!closing && Date.now() - last >= TIMEOUT_MS) {
        closing = true
        try { await signOut() } finally { window.location.replace('/login') }
      }
    }

    // capture: `scroll` no burbujea, así que un listener en window nunca ve el scroll
    // de un contenedor con overflow propio (paneles, modales, listas largas).
    const opts = { passive: true, capture: true } as const
    const listen   = (doc: Document) => ACTIVITY_EVENTS.forEach(ev => doc.addEventListener(ev, mark, opts))
    const unlisten = (doc: Document) => ACTIVITY_EVENTS.forEach(ev => doc.removeEventListener(ev, mark, opts))

    // Los eventos de un iframe no cruzan al documento padre. La guía de entrevista se
    // muestra en un <iframe srcDoc> (mismo origen, alcanzable por contentDocument), así
    // que leerla y anotarla no marcaba actividad: la sesión se cerraba a los 15 minutos
    // en plena lectura.
    const tracked = new Set<Document>()
    const trackIframes = () => {
      tracked.forEach(doc => { if (!doc.defaultView) tracked.delete(doc) })
      document.querySelectorAll('iframe').forEach(frame => {
        let doc: Document | null = null
        try { doc = frame.contentDocument } catch { return } // cross-origin: inalcanzable
        if (!doc || tracked.has(doc)) return
        tracked.add(doc)
        listen(doc)
      })
    }
    // `load` no burbujea pero sí se captura en document, y es el momento en que srcDoc
    // reemplaza el documento inicial del iframe por el definitivo.
    const onLoad = (e: Event) => {
      if ((e.target as HTMLElement | null)?.tagName === 'IFRAME') trackIframes()
    }

    listen(document)
    trackIframes()
    document.addEventListener('load', onLoad, true)
    document.addEventListener('visibilitychange', check)
    const interval = setInterval(check, 30_000)
    check()

    return () => {
      clearInterval(interval)
      unlisten(document)
      tracked.forEach(doc => { try { unlisten(doc) } catch { /* documento ya descartado */ } })
      tracked.clear()
      document.removeEventListener('load', onLoad, true)
      document.removeEventListener('visibilitychange', check)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession])
}
