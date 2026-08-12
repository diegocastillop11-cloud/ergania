import { useRef } from 'react'
import { logVideoPlay, type VideoPlaySource } from './logVideoPlay'

/**
 * Devuelve un handler para `onPlay` que registra la reproducción una sola vez.
 *
 * El evento `play` del navegador dispara también al reanudar después de una pausa y
 * después de un seek, así que engancharlo directo contaría 5 reproducciones de una
 * persona que pausó 4 veces. El ref se resetea solo al desmontar el componente, que es
 * justo lo que queremos: cerrar y reabrir el modal sí cuenta como una vista nueva.
 */
export function useLogFirstPlay(source: VideoPlaySource) {
  const logged = useRef(false)

  return () => {
    if (logged.current) return
    logged.current = true
    logVideoPlay(source)
  }
}
