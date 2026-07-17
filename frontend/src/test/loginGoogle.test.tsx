/**
 * Tests para el botón "Ingresar con Google" (Ticket 4 — login con Google).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const signInWithOAuthMock = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithOAuth: (...args: unknown[]) => signInWithOAuthMock(...args),
    },
  },
}))

import Login from '../pages/Login'
import { AuthProvider } from '../lib/AuthContext'
import { LanguageProvider } from '../lib/i18n/LanguageContext'

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LanguageProvider>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>
  )
}

describe('Login — Ingresar con Google', () => {
  beforeEach(() => {
    signInWithOAuthMock.mockReset()
    signInWithOAuthMock.mockResolvedValue({ data: {}, error: null })
  })

  it('muestra el botón "Ingresar con Google"', () => {
    renderLogin()
    expect(screen.getByText('Ingresar con Google')).toBeInTheDocument()
  })

  it('al hacer click, llama a signInWithOAuth con provider google y redirectTo a /dashboard', async () => {
    renderLogin()
    fireEvent.click(screen.getByText('Ingresar con Google'))

    await waitFor(() => expect(signInWithOAuthMock).toHaveBeenCalledTimes(1))
    const [args] = signInWithOAuthMock.mock.calls[0]
    expect(args.provider).toBe('google')
    expect(args.options.redirectTo).toContain('/dashboard')
  })

  it('en modo registro, el botón dice "Registrarme con Google"', () => {
    renderLogin()
    fireEvent.click(screen.getByText('Registrarme'))
    expect(screen.getByText('Registrarme con Google')).toBeInTheDocument()
  })

  it('si signInWithOAuth falla, muestra el error', async () => {
    signInWithOAuthMock.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } })
    renderLogin()
    fireEvent.click(screen.getByText('Ingresar con Google'))
    await waitFor(() => expect(screen.getByText('Correo o contraseña incorrectos')).toBeInTheDocument())
  })
})
