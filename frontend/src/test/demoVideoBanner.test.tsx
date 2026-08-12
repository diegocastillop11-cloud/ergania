/**
 * Tests del banner del video demo dentro de la app (dashboard).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageProvider } from '../lib/i18n/LanguageContext'
import DemoVideoBanner from '../components/DemoVideoBanner'
import { DEMO_VIDEO_URL } from '../lib/demoVideo'

const fetchMock = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) =>
  Promise.resolve(new Response(null, { status: 204 })),
)
vi.stubGlobal('fetch', fetchMock)

function renderBanner() {
  return render(
    <LanguageProvider>
      <DemoVideoBanner />
    </LanguageProvider>,
  )
}

describe('DemoVideoBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchMock.mockClear()
  })

  it('muestra el texto y no monta el video hasta que se pide', () => {
    renderBanner()
    expect(screen.getByText('Aprende a usar Ergania paso a paso')).toBeTruthy()
    expect(document.querySelector('video')).toBeNull()
  })

  it('abre el modal con el video al hacer click en el CTA', () => {
    renderBanner()
    fireEvent.click(screen.getByText('Ver video'))

    const source = document.querySelector('video source')
    expect(source?.getAttribute('src')).toBe(DEMO_VIDEO_URL)
  })

  it('al descartar el banner no lo vuelve a mostrar', () => {
    const { unmount } = renderBanner()
    fireEvent.click(screen.getByLabelText('No mostrar de nuevo'))
    expect(screen.queryByText('Aprende a usar Ergania paso a paso')).toBeNull()

    unmount()
    renderBanner()
    expect(screen.queryByText('Aprende a usar Ergania paso a paso')).toBeNull()
  })

  it('descartar el banner mientras se ve el video no corta la reproducción', () => {
    renderBanner()
    fireEvent.click(screen.getByText('Ver video'))
    fireEvent.click(screen.getByLabelText('No mostrar de nuevo'))

    expect(document.querySelector('video')).not.toBeNull()
  })

  it('registra una sola reproducción aunque el video se pause y reanude', () => {
    renderBanner()
    fireEvent.click(screen.getByText('Ver video'))

    const video = document.querySelector('video')!
    fireEvent.play(video)
    fireEvent.play(video)
    fireEvent.play(video)

    const plays = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/video/play'))
    expect(plays).toHaveLength(1)
    expect(JSON.parse(String(plays[0][1]?.body))).toEqual({ source: 'dashboard' })
  })
})
