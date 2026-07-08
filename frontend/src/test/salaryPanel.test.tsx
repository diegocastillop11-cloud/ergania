/**
 * Tests para "¿Cuánto pedir?" por postulación (Fase 1 — Ticket "cuánto debería cobrar").
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import type { Application } from '../types/careers'

const postMock = vi.fn()

vi.mock('../lib/api', () => ({
  api: { post: (...args: unknown[]) => postMock(...args) },
}))

import { SalaryPanel } from '../pages/careers/CareersPostulaciones'

const baseApp: Application = {
  id: 'app-1',
  fecha: '2026-07-01',
  empresa: 'TRES60',
  rol: 'Ingeniero de Datos',
  jd: 'Buscamos un Ingeniero de Datos senior con experiencia en SQL Server...',
  estado: 'CV Generado',
  idioma: 'es',
}

describe('SalaryPanel — ¿cuánto pedir? por postulación', () => {
  beforeEach(() => {
    postMock.mockReset()
  })

  it('al abrir, genera la recomendación automáticamente usando el id de la postulación', async () => {
    postMock.mockResolvedValue({
      data: { rango_min: 1800000, rango_max: 2400000, moneda: 'CLP', explicacion: 'Estimación para este cargo.', basadoEnAncla: true },
    })
    render(<SalaryPanel app={baseApp} onClose={() => {}} />)

    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/salary-recommendation', expect.objectContaining({ applicationId: 'app-1' })))
    expect(await screen.findByText(/1.800.000 - 2.400.000 CLP/)).toBeInTheDocument()
    expect(screen.getByText(/Con referencia interna curada/)).toBeInTheDocument()
  })

  it('muestra el título con el rol y la empresa de la postulación', async () => {
    postMock.mockResolvedValue({ data: { rango_min: 1, rango_max: 2, moneda: 'CLP', explicacion: '', basadoEnAncla: false } })
    render(<SalaryPanel app={baseApp} onClose={() => {}} />)
    expect(screen.getByText(/Ingeniero de Datos en TRES60/)).toBeInTheDocument()
    await waitFor(() => expect(postMock).toHaveBeenCalled())
  })

  it('si falla, muestra el error con botón de reintentar', async () => {
    postMock.mockRejectedValue({ response: { data: { error: 'Falta país en el perfil' } } })
    render(<SalaryPanel app={baseApp} onClose={() => {}} />)

    await waitFor(() => expect(screen.getByText('Falta país en el perfil')).toBeInTheDocument())
    const retryBtn = screen.getByText('Reintentar')
    expect(retryBtn).toBeInTheDocument()

    postMock.mockResolvedValue({ data: { rango_min: 1000, rango_max: 2000, moneda: 'CLP', explicacion: 'ok', basadoEnAncla: false } })
    fireEvent.click(retryBtn)
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(2))
  })

  it('el botón de cerrar llama a onClose', async () => {
    postMock.mockResolvedValue({ data: { rango_min: 1, rango_max: 2, moneda: 'CLP', explicacion: '', basadoEnAncla: false } })
    const onClose = vi.fn()
    render(<SalaryPanel app={baseApp} onClose={onClose} />)
    await waitFor(() => expect(postMock).toHaveBeenCalled())

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(onClose).toHaveBeenCalled()
  })

  it('si la postulación ya tiene salario_clp (de Evaluar Oferta), lo muestra directo sin llamar a la IA', () => {
    const appConEstimado: Application = { ...baseApp, salario_clp: '$1.600.000 - $2.300.000 CLP mensual (estimado)' }
    render(<SalaryPanel app={appConEstimado} onClose={() => {}} />)

    expect(screen.getByText('$1.600.000 - $2.300.000 CLP mensual (estimado)')).toBeInTheDocument()
    expect(screen.getByText(/sin gastar una nueva consulta/)).toBeInTheDocument()
    expect(postMock).not.toHaveBeenCalled()
    expect(screen.getByText('Recalcular con IA')).toBeInTheDocument()
  })

  it('"Recalcular con IA" fuerza una nueva llamada aunque ya haya un estimado guardado', async () => {
    postMock.mockResolvedValue({
      data: { rango_min: 1900000, rango_max: 2500000, moneda: 'CLP', explicacion: 'Recalculado.', basadoEnAncla: false },
    })
    const appConEstimado: Application = { ...baseApp, salario_clp: '$1.600.000 - $2.300.000 CLP mensual (estimado)' }
    render(<SalaryPanel app={appConEstimado} onClose={() => {}} />)

    fireEvent.click(screen.getByText('Recalcular con IA'))

    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/salary-recommendation', expect.objectContaining({ applicationId: 'app-1' })))
    expect(await screen.findByText(/1.900.000 - 2.500.000 CLP/)).toBeInTheDocument()
  })
})
