/**
 * Tests para la recomendación salarial híbrida (Fase 1 — Ticket "cuánto debería cobrar").
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const getMock = vi.fn()
const putMock = vi.fn()
const postMock = vi.fn()

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => getMock(...args),
    put: (...args: unknown[]) => putMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}))

import CareersProfile from '../pages/careers/CareersProfile'

function renderProfile() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <CareersProfile />
    </QueryClientProvider>
  )
}

describe('CareersProfile — recomendación de "¿cuánto debería cobrar?"', () => {
  beforeEach(() => {
    getMock.mockReset()
    postMock.mockReset()
    getMock.mockImplementation((url: string) => {
      if (url === '/profile') return Promise.resolve({ data: {} })
      if (url === '/cv') return Promise.resolve({ data: { content: '' } })
      return Promise.resolve({ data: {} })
    })
  })

  it('muestra el botón "¿Cuánto debería cobrar?" en la sección de Compensación', async () => {
    renderProfile()
    await waitFor(() => expect(screen.getByText(/Compensación/)).toBeInTheDocument())
    expect(screen.getByText('¿Cuánto debería cobrar?')).toBeInTheDocument()
  })

  it('al hacer click, llama a POST /salary-recommendation y muestra el resultado', async () => {
    postMock.mockResolvedValue({
      data: {
        rango_min: 1800000, rango_max: 2400000, moneda: 'CLP',
        explicacion: 'Estimación basada en tu perfil.', basadoEnAncla: true,
        carrera: 'Data Analyst', pais: 'Chile',
      },
    })
    renderProfile()
    await waitFor(() => expect(screen.getByText('¿Cuánto debería cobrar?')).toBeInTheDocument())

    fireEvent.click(screen.getByText('¿Cuánto debería cobrar?'))

    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/salary-recommendation', expect.any(Object)))
    expect(await screen.findByText(/1.800.000 - 2.400.000 CLP/)).toBeInTheDocument()
    expect(screen.getByText(/con referencia interna/)).toBeInTheDocument()
  })

  it('"Usar este rango" copia el resultado al campo Rango objetivo', async () => {
    postMock.mockResolvedValue({
      data: {
        rango_min: 1800000, rango_max: 2400000, moneda: 'CLP',
        explicacion: 'Estimación basada en tu perfil.', basadoEnAncla: false,
        carrera: 'Data Analyst', pais: 'Chile',
      },
    })
    renderProfile()
    await waitFor(() => expect(screen.getByText('¿Cuánto debería cobrar?')).toBeInTheDocument())
    fireEvent.click(screen.getByText('¿Cuánto debería cobrar?'))
    await screen.findByText('Usar este rango')

    fireEvent.click(screen.getByText('Usar este rango'))

    const targetRangeInput = screen.getByPlaceholderText('$80M-120M CLP o USD 2000-3500/mes') as HTMLInputElement
    expect(targetRangeInput.value).toBe('1.800.000-2.400.000 CLP')
  })

  it('si falla, muestra el mensaje de error', async () => {
    postMock.mockRejectedValue({ response: { data: { error: 'Falta carrera o país' } } })
    renderProfile()
    await waitFor(() => expect(screen.getByText('¿Cuánto debería cobrar?')).toBeInTheDocument())

    fireEvent.click(screen.getByText('¿Cuánto debería cobrar?'))

    await waitFor(() => expect(screen.getByText('Falta carrera o país')).toBeInTheDocument())
  })
})
