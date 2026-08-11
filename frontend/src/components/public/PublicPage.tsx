import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { C, display, sans } from '../legal/LegalLayout'

const NAV = [
  { to: '/recursos',   label: 'Recursos' },
  { to: '/nosotros',   label: 'Nosotros' },
  { to: '/contacto',   label: 'Contacto' },
  { to: '/privacidad', label: 'Privacidad' },
  { to: '/terminos',   label: 'Términos' },
]

interface Props {
  title: string
  intro?: string
  children: ReactNode
}

export default function PublicPage({ title, intro, children }: Props) {
  return (
    <div style={{ fontFamily: sans, background: C.panel, color: C.ink, minHeight: '100vh' }}>
      <header style={{ borderBottom: `1px solid ${C.line}` }}>
        <nav style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <Link to="/">
            <img src="/logo.png" alt="Ergania" style={{ height: 34, width: 'auto', objectFit: 'contain' }} />
          </Link>
          <Link to="/" style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: C.inkSub, textDecoration: 'none' }}>
            ← Volver al inicio
          </Link>
        </nav>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px 88px' }}>
        <h1 style={{ fontFamily: display, fontSize: 38, fontWeight: 700, color: C.ink, letterSpacing: -0.5, marginBottom: intro ? 14 : 40 }}>
          {title}
        </h1>
        {intro && (
          <p style={{ fontFamily: sans, fontSize: 17.5, lineHeight: 1.7, color: C.inkSub, marginBottom: 44 }}>
            {intro}
          </p>
        )}
        {children}
      </main>

      <footer style={{ background: C.footer, padding: '44px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <span style={{ fontFamily: display, fontWeight: 700, fontSize: 20, color: C.ink }}>ergania</span>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
            {NAV.map(item => (
              <Link key={item.to} to={item.to} style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.inkMuted, textDecoration: 'none' }}>
                {item.label}
              </Link>
            ))}
          </div>
          <p style={{ fontFamily: sans, fontSize: 12, color: 'rgba(241,242,251,.28)' }}>
            Hecho en Chile · 2026
          </p>
        </div>
      </footer>
    </div>
  )
}

export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 38 }}>
      <h2 style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 12 }}>{title}</h2>
      <div style={{ fontFamily: sans, fontSize: 16, lineHeight: 1.75, color: C.inkSub }}>{children}</div>
    </section>
  )
}
