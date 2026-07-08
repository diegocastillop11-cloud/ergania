/**
 * Tests para la edición WYSIWYG del CV (Fase 1 — Ticket "CV editable").
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Application } from '../types/careers'

const patchMock = vi.fn()
const postMock = vi.fn()
const getMock = vi.fn()

vi.mock('../lib/api', () => ({
  api: {
    patch: (...args: unknown[]) => patchMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    get: (...args: unknown[]) => getMock(...args),
  },
}))

import { CvPreviewPanel } from '../pages/careers/CareersPostulaciones'

const baseApp: Application = {
  id: 'app-1',
  fecha: '2026-07-01',
  empresa: 'TRES60',
  rol: 'Ingeniero de Datos',
  cvHtml: '<html><body><h1>Diego Castillo</h1></body></html>',
  estado: 'CV Generado',
  idioma: 'es',
}

function makeFakeDoc(html: string) {
  return {
    designMode: 'off',
    documentElement: { outerHTML: html },
  }
}

function stubIframeDoc(html: string) {
  const iframe = document.querySelector('iframe') as HTMLIFrameElement
  const fakeDoc = makeFakeDoc(html)
  Object.defineProperty(iframe, 'contentDocument', { value: fakeDoc, configurable: true })
  return fakeDoc
}

describe('CvPreviewPanel — edición WYSIWYG del CV', () => {
  beforeEach(() => {
    patchMock.mockReset()
    patchMock.mockResolvedValue({ data: { ok: true } })
  })

  it('muestra el botón "Editar CV" cuando hay cvHtml', () => {
    render(<CvPreviewPanel app={baseApp} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /Editar CV/ })).toBeInTheDocument()
  })

  it('al hacer click en Editar CV, activa designMode y muestra Guardar/Cancelar', () => {
    render(<CvPreviewPanel app={baseApp} onClose={() => {}} />)
    const fakeDoc = stubIframeDoc(baseApp.cvHtml!)

    fireEvent.click(screen.getByRole('button', { name: /Editar CV/ }))

    expect(fakeDoc.designMode).toBe('on')
    expect(screen.getByRole('button', { name: /Guardar cambios/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar CV/ })).not.toBeInTheDocument()
  })

  it('Guardar cambios llama a PATCH /applications/:id/cv con el HTML editado', async () => {
    render(<CvPreviewPanel app={baseApp} onClose={() => {}} />)
    const editedHtml = '<html><body><h1>Diego Castillo (editado)</h1></body></html>'
    const fakeDoc = stubIframeDoc(editedHtml)

    fireEvent.click(screen.getByRole('button', { name: /Editar CV/ }))
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }))

    await waitFor(() => expect(patchMock).toHaveBeenCalledTimes(1))
    const [url, payload] = patchMock.mock.calls[0]
    expect(url).toBe('/applications/app-1/cv')
    expect(payload.cvHtml).toContain('Diego Castillo (editado)')
    expect(fakeDoc.designMode).toBe('off')

    await waitFor(() => expect(screen.getByRole('button', { name: /Editar CV/ })).toBeInTheDocument())
  })

  it('Cancelar descarta la edición y vuelve al modo lectura sin llamar a PATCH', () => {
    render(<CvPreviewPanel app={baseApp} onClose={() => {}} />)
    stubIframeDoc(baseApp.cvHtml!)

    fireEvent.click(screen.getByRole('button', { name: /Editar CV/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(patchMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Editar CV/ })).toBeInTheDocument()
  })

  it('si el guardado falla, muestra el error y reactiva el modo edición', async () => {
    patchMock.mockRejectedValue({ response: { data: { error: 'Error del servidor' } } })
    render(<CvPreviewPanel app={baseApp} onClose={() => {}} />)
    const fakeDoc = stubIframeDoc(baseApp.cvHtml!)

    fireEvent.click(screen.getByRole('button', { name: /Editar CV/ }))
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }))

    await waitFor(() => expect(screen.getByText('Error del servidor')).toBeInTheDocument())
    expect(fakeDoc.designMode).toBe('on')
  })
})
