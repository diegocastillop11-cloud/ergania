import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import PublicPage, { Block } from '../components/public/PublicPage'
import { C, blue2Link, sans } from '../components/legal/LegalLayout'
import { useDocumentMeta } from '../lib/useDocumentMeta'

export const TITLE = 'Contacto — Ergania'
export const DESCRIPTION =
  'Escríbenos a contacto@ergania.com o usa el formulario para consultas, problemas técnicos, sugerencias, reclamos o temas de privacidad y facturación.'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

const CATEGORIES = ['Consulta general', 'Problema técnico', 'Sugerencia', 'Reclamo', 'Otro']

const field: React.CSSProperties = {
  width: '100%', background: '#0E1533', border: `1px solid ${C.line}`,
  borderRadius: 10, padding: '11px 13px', fontFamily: sans, fontSize: 15,
  color: C.ink, outline: 'none',
}

const label: React.CSSProperties = {
  display: 'block', fontFamily: sans, fontSize: 13, fontWeight: 600,
  color: C.inkMuted, marginBottom: 6,
}

export default function Contacto() {
  useDocumentMeta(TITLE, DESCRIPTION)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSending(true)
    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, category, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No pudimos enviar tu mensaje.')
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos enviar tu mensaje.')
    } finally {
      setSending(false)
    }
  }

  return (
    <PublicPage
      title="Contacto"
      intro="¿Tienes una duda, encontraste un problema o quieres proponernos algo? Escríbenos y te respondemos por correo."
    >
      <Block title="Por correo">
        <p>
          Puedes escribirnos directamente a{' '}
          <a href="mailto:contacto@ergania.com" style={{ ...blue2Link, textDecoration: 'none' }}>
            contacto@ergania.com
          </a>
          . Usa esa misma dirección para consultas de facturación, para ejercer tus derechos sobre
          tus datos personales según nuestra{' '}
          <Link to="/privacidad" style={blue2Link}>Política de Privacidad</Link>, o para cualquier
          tema relacionado con los{' '}
          <Link to="/terminos" style={blue2Link}>Términos y Condiciones</Link>.
        </p>
      </Block>

      <Block title="Con el formulario">
        {sent ? (
          <div style={{
            padding: '22px 24px', borderRadius: 12,
            background: 'rgba(96,165,250,.10)', border: `1px solid ${C.line}`,
          }}>
            <p style={{ color: C.ink, fontWeight: 600, marginBottom: 6 }}>Mensaje enviado.</p>
            <p>Gracias por escribirnos. Te responderemos al correo que nos dejaste.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={label} htmlFor="contacto-nombre">Nombre</label>
              <input
                id="contacto-nombre" type="text" required value={name}
                onChange={e => setName(e.target.value)} style={field}
              />
            </div>

            <div>
              <label style={label} htmlFor="contacto-email">Correo electrónico</label>
              <input
                id="contacto-email" type="email" required value={email}
                onChange={e => setEmail(e.target.value)} style={field}
              />
            </div>

            <div>
              <label style={label} htmlFor="contacto-categoria">Motivo</label>
              <select
                id="contacto-categoria" required value={category}
                onChange={e => setCategory(e.target.value)} style={field}
              >
                <option value="">Selecciona un motivo</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label style={label} htmlFor="contacto-mensaje">Mensaje</label>
              <textarea
                id="contacto-mensaje" required rows={6} value={message}
                onChange={e => setMessage(e.target.value)}
                style={{ ...field, resize: 'vertical' }}
              />
            </div>

            {error && (
              <p style={{ color: '#FCA5A5', fontSize: 14 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={sending}
              style={{
                alignSelf: 'flex-start', background: C.blue2, color: '#05070F',
                border: 'none', borderRadius: 9, padding: '12px 26px',
                fontFamily: sans, fontSize: 15, fontWeight: 700,
                cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1,
              }}
            >
              {sending ? 'Enviando…' : 'Enviar mensaje'}
            </button>
          </form>
        )}
      </Block>
    </PublicPage>
  )
}
