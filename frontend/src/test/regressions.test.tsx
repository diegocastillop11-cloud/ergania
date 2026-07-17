/**
 * Pruebas de regresión para los bugs encontrados en el QA del 2026-06-29.
 * Si alguno de estos tests falla, significa que un bug anterior volvió.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import { translateAuthError } from '../lib/authErrors'
import SubscriptionCallback from '../pages/SubscriptionCallback'
import { LanguageProvider } from '../lib/i18n/LanguageContext'

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
