/**
 * Regresión: la sesión se cerraba por inactividad mientras el usuario leía la guía de
 * entrevista. La guía vive en un <iframe srcDoc> y los eventos de un iframe no cruzan al
 * documento padre, donde estaban los listeners — clickear y scrollear ahí adentro no
 * contaba como actividad. Mismo problema con el scroll de contenedores internos: `scroll`
 * no burbujea hasta window.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIdleLogout } from '../hooks/useIdleLogout'

const signOut = vi.fn()
vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } }, signOut }),
}))

const TIMEOUT_MS = 15 * 60 * 1000
const replace = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  signOut.mockClear()
  replace.mockClear()
  localStorage.clear()
  document.body.innerHTML = ''
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, replace },
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useIdleLogout', () => {
  it('cierra la sesión tras 15 minutos sin actividad', async () => {
    renderHook(() => useIdleLogout())

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 30_000)

    expect(signOut).toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith('/login')
  })

  it('la actividad dentro de un iframe cuenta como actividad', async () => {
    const frame = document.createElement('iframe')
    document.body.appendChild(frame)
    const frameDoc = frame.contentDocument!
    expect(frameDoc).toBeTruthy()

    renderHook(() => useIdleLogout())

    // A los 14 min el usuario hace click dentro de la guía: eso debe reiniciar el contador.
    await vi.advanceTimersByTimeAsync(14 * 60 * 1000)
    frameDoc.dispatchEvent(new Event('mousedown'))

    // 14 min más (28 en total, pero solo 14 desde el último click) → sigue adentro.
    await vi.advanceTimersByTimeAsync(14 * 60 * 1000)

    expect(signOut).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it('engancha iframes montados después (srcDoc dispara load)', async () => {
    renderHook(() => useIdleLogout())

    const frame = document.createElement('iframe')
    document.body.appendChild(frame)
    const frameDoc = frame.contentDocument!
    frame.dispatchEvent(new Event('load'))

    await vi.advanceTimersByTimeAsync(14 * 60 * 1000)
    frameDoc.dispatchEvent(new Event('mousedown'))
    await vi.advanceTimersByTimeAsync(14 * 60 * 1000)

    expect(signOut).not.toHaveBeenCalled()
  })

  it('el scroll de un contenedor interno cuenta como actividad (no burbujea a window)', async () => {
    const panel = document.createElement('div')
    document.body.appendChild(panel)

    renderHook(() => useIdleLogout())

    await vi.advanceTimersByTimeAsync(14 * 60 * 1000)
    panel.dispatchEvent(new Event('scroll')) // sin bubbles, como el scroll real
    await vi.advanceTimersByTimeAsync(14 * 60 * 1000)

    expect(signOut).not.toHaveBeenCalled()
  })
})
