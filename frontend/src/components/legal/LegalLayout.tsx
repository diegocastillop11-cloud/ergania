import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

export const C = {
  panel:    '#0B1330',
  panelAlt: '#10142B',
  footer:   '#070A16',
  ink:      '#F1F2FB',
  inkSub:   '#B7BAE0',
  inkMuted: '#7C82AE',
  line:     'rgba(255,255,255,.08)',
  blue2:    '#60A5FA',
}

export const display = "'Space Grotesk', -apple-system, 'Segoe UI', Arial, sans-serif"
export const sans    = "'Source Sans Pro', -apple-system, 'Segoe UI', Arial, sans-serif"

export const blue2Link = { color: C.blue2, fontWeight: 600 } as const

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{ fontFamily: display, fontSize: 21, fontWeight: 700, color: C.ink, marginBottom: 12 }}>{title}</h2>
      <div style={{ fontFamily: sans, fontSize: 15.5, lineHeight: 1.7, color: C.inkSub }}>{children}</div>
    </section>
  )
}

interface LegalLayoutProps {
  title: string
  updated: string
  otherPage: { to: string; label: string }
  children: ReactNode
}

export default function LegalLayout({ title, updated, otherPage, children }: LegalLayoutProps) {
  return (
    <div style={{ fontFamily: sans, background: C.panel, color: C.ink, minHeight: '100vh' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(11,19,48,.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: `1px solid ${C.line}` }}>
        <nav style={{ maxWidth: 1200, margin: '0 auto', padding: '0 48px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/">
            <img src="/logo.png" alt="Ergania" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <Link to={otherPage.to} style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: C.inkMuted, textDecoration: 'none' }}>
              {otherPage.label}
            </Link>
            <Link to="/" style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: C.inkSub, textDecoration: 'none' }}>
              ← Volver al inicio
            </Link>
          </div>
        </nav>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '64px 48px 96px' }}>
        <h1 style={{ fontFamily: display, fontSize: 38, fontWeight: 700, color: C.ink, letterSpacing: -0.5, marginBottom: 8 }}>
          {title}
        </h1>
        <p style={{ fontFamily: sans, fontSize: 14, color: C.inkMuted, marginBottom: 48 }}>
          Última actualización: {updated}
        </p>

        {children}
      </main>

      <footer style={{ background: C.footer, padding: '44px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: display, fontWeight: 700, fontSize: 20, color: C.ink }}>ergania</span>
          <p style={{ fontFamily: sans, fontSize: 12, color: 'rgba(241,242,251,.28)' }}>
            Hecho en Chile · 2026
          </p>
        </div>
      </footer>
    </div>
  )
}
