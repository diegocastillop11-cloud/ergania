/**
 * Pruebas de regresión para los bugs encontrados en el QA del 2026-06-29.
 * Si alguno de estos tests falla, significa que un bug anterior volvió.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import { translateAuthError } from '../lib/authErrors'
import SubscriptionCallback from '../pages/SubscriptionCallback'
import { LanguageProvider } from '../lib/i18n/LanguageContext'
import { FaqsTab } from '../pages/Admin'

// ─── ISSUE-001: Errores de Supabase deben mostrarse en español ───────────────

describe('ISSUE-001: traducción de errores de autenticación', () => {
  it('traduce "Invalid login credentials"', () => {
    expect(translateAuthError('Invalid login credentials')).toBe('Correo o contraseña incorrectos')
  })

  it('traduce "Email not confirmed"', () => {
    expect(translateAuthError('Email not confirmed')).toBe('Debes confirmar tu correo antes de ingresar')
  })

  it('traduce "User already registered"', () => {
    expect(translateAuthError('User already registered')).toBe('Ya existe una cuenta con ese correo')
  })

  it('es case-insensitive', () => {
    expect(translateAuthError('INVALID LOGIN CREDENTIALS')).toBe('Correo o contraseña incorrectos')
  })

  it('retorna el mensaje original si no hay traducción', () => {
    const msg = 'Some unknown error from Supabase'
    expect(translateAuthError(msg)).toBe(msg)
  })
})

// ─── ISSUE-003: Rutas de callback de MercadoPago deben renderizar contenido ──

describe('ISSUE-003: páginas de callback de MercadoPago', () => {
  const renderCallback = (path: string) =>
    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/subscription/success"  element={<SubscriptionCallback />} />
            <Route path="/subscription/failure"  element={<SubscriptionCallback />} />
            <Route path="/subscription/pending"  element={<SubscriptionCallback />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    )

  it('muestra "¡Pago recibido!" en /subscription/success', () => {
    renderCallback('/subscription/success')
    expect(screen.getByText('¡Pago recibido!')).toBeInTheDocument()
  })

  it('muestra "El pago no se completó" en /subscription/failure', () => {
    renderCallback('/subscription/failure')
    expect(screen.getByText('El pago no se completó')).toBeInTheDocument()
  })

  it('muestra "Pago en proceso" en /subscription/pending', () => {
    renderCallback('/subscription/pending')
    expect(screen.getByText('Pago en proceso')).toBeInTheDocument()
  })
})

// ─── ISSUE-004: Rutas desconocidas deben redirigir a "/" ─────────────────────

describe('ISSUE-004: catch-all redirige rutas desconocidas', () => {
  it('redirige /ruta-inexistente a /', () => {
    render(
      <MemoryRouter initialEntries={['/ruta-inexistente']}>
        <Routes>
          <Route path="/" element={<div>Landing</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Landing')).toBeInTheDocument()
  })
})

// ─── ISSUE-005: editar una pregunta frecuente lejos del form debe llevar la vista al form ──
// Reportado por un admin no-principal: "hago click en el lápiz y no pasa nada" — el form de
// edición vive arriba de la lista, así que editar un item sin scroll-into-view deja el form
// pre-llenado fuera de la vista y parece que el click no hizo nada. No es un bug de permisos
// (el mismo código corre para los 3 admins de ADMIN_EMAILS).

describe('ISSUE-005: FaqsTab lleva el form de edición a la vista al hacer click en editar', () => {
  const faqs = [
    { id: 'faq-1', question: '¿Pregunta uno?', answer: 'Respuesta uno', order_index: 0, published: true },
    { id: 'faq-2', question: '¿Pregunta dos?', answer: 'Respuesta dos', order_index: 1, published: true },
  ]

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({ faqs }) }))
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('al hacer click en editar, precarga el form y hace scroll hacia él', async () => {
    render(<FaqsTab token="test-token" />)

    await waitFor(() => expect(screen.getByText('¿Pregunta dos?')).toBeInTheDocument())

    const editBtn = screen.getByLabelText('Editar pregunta: ¿Pregunta dos?')
    fireEvent.click(editBtn)

    expect(await screen.findByText('Editar pregunta')).toBeInTheDocument()
    expect(screen.getByDisplayValue('¿Pregunta dos?')).toBeInTheDocument()
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })
})
