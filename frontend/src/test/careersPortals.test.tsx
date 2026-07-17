/**
 * Tests para la extensión de portales internacionales (Fase 1 — Ticket "job boards en inglés").
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PortalsConfig } from '../types/careers'

const getMock = vi.fn()
const putMock = vi.fn()

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => getMock(...args),
    put: (...args: unknown[]) => putMock(...args),
  },
}))

vi.mock('../components/careers/PerfilTabs', () => ({
  default: () => null,
}))

import CareersPortals from '../pages/careers/CareersPortals'
import { LanguageProvider } from '../lib/i18n/LanguageContext'

const emptyConfig: PortalsConfig = {
  title_filter: { positive: [], negative: [], seniority_boost: [] },
  tracked_companies: [],
  search_queries: [],
}

function renderPortals() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <LanguageProvider>
      <QueryClientProvider client={qc}>
        <CareersPortals />
      </QueryClientProvider>
    </LanguageProvider>
  )
}

describe('CareersPortals — regiones de job boards internacionales', () => {
  beforeEach(() => {
    getMock.mockReset()
    putMock.mockReset()
    putMock.mockResolvedValue({ data: {} })
  })

  it('muestra tabs para las 5 regiones (Chile, Remoto Global, EE.UU., España, LATAM)', async () => {
    getMock.mockResolvedValue({ data: emptyConfig })
    renderPortals()

    await waitFor(() => screen.getByText('Portales Recomendados'))

    expect(screen.getByRole('button', { name: '🇨🇱 Chile' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '🌎 Remoto Global' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '🇺🇸 Estados Unidos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '🇪🇸 España' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '🌎 LATAM' })).toBeInTheDocument()
  })

  it('cambia el listado de sugeridos al seleccionar la región EE.UU.', async () => {
    getMock.mockResolvedValue({ data: emptyConfig })
    renderPortals()

    await waitFor(() => screen.getByText('Portales Recomendados'))

    // Por defecto se muestra Chile
    expect(screen.getByText('GetOnBoard Chile')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Estados Unidos/ }))

    expect(screen.getByText('Indeed US')).toBeInTheDocument()
    expect(screen.queryByText('GetOnBoard Chile')).not.toBeInTheDocument()
  })

  it('agrega un portal sugerido de una región internacional y guarda vía PUT /portals', async () => {
    getMock.mockResolvedValue({ data: emptyConfig })
    renderPortals()

    await waitFor(() => screen.getByText('Portales Recomendados'))
    fireEvent.click(screen.getByRole('button', { name: /Remoto Global/ }))
    fireEvent.click(screen.getByText('RemoteOK'))

    await waitFor(() => expect(putMock).toHaveBeenCalledTimes(1))
    const [, payload] = putMock.mock.calls[0]
    expect(payload.tracked_companies).toHaveLength(1)
    expect(payload.tracked_companies[0]).toMatchObject({
      name: 'RemoteOK',
      country: 'Remoto',
      enabled: true,
    })
  })

  it('el filtro por país muestra un botón por cada país ya agregado', async () => {
    getMock.mockResolvedValue({
      data: {
        ...emptyConfig,
        tracked_companies: [
          { name: 'GetOnBoard Chile', careers_url: 'https://www.getonbrd.com/jobs', country: 'Chile', enabled: true },
          { name: 'InfoJobs', careers_url: 'https://www.infojobs.net', country: 'España', enabled: true },
        ],
      },
    })
    renderPortals()

    await waitFor(() => screen.getByText('Portales Recomendados'))

    const filterButtons = screen.getAllByRole('button', { name: 'Chile' })
    expect(filterButtons.length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'España' })).toBeInTheDocument()
  })
})
