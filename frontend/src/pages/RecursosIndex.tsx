import { Link } from 'react-router-dom'
import { ARTICLES } from '../content/articles'
import { useDocumentMeta } from '../lib/useDocumentMeta'

const C = {
  panel: '#0B1330',
  ink: '#F1F2FB',
  inkSub: '#B7BAE0',
  inkMuted: '#7C82AE',
  line: 'rgba(255,255,255,.08)',
  blue2: '#60A5FA',
  violet2: '#A78BFA',
}

const display = "'Space Grotesk', -apple-system, 'Segoe UI', Arial, sans-serif"
const sans = "'Source Sans Pro', -apple-system, 'Segoe UI', Arial, sans-serif"

const TITLE = 'Recursos para tu búsqueda laboral — Ergania'
const DESCRIPTION = 'Guías prácticas sobre CV, entrevistas, pretensión de renta y búsqueda de trabajo remoto, escritas por el equipo de Ergania.'

export default function RecursosIndex() {
  useDocumentMeta(TITLE, DESCRIPTION)

  return (
    <div style={{ fontFamily: sans, background: C.panel, color: C.ink, minHeight: '100vh' }}>
      <header style={{ borderBottom: `1px solid ${C.line}`, padding: '20px 48px' }}>
        <Link to="/" style={{ display: 'inline-block' }}>
          <img src="/logo.png" alt="Ergania" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
        </Link>
      </header>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '64px 24px 96px' }}>
        <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: C.blue2, marginBottom: 14 }}>
          Recursos
        </p>
        <h1 style={{ fontFamily: display, fontSize: 38, fontWeight: 700, letterSpacing: -0.5, marginBottom: 16 }}>
          Guías para tu búsqueda laboral
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.65, color: C.inkSub, marginBottom: 48, maxWidth: 620 }}>
          Consejos prácticos sobre CV, entrevistas, pretensión de renta y trabajo remoto — escritos a partir de lo que vemos todos los días ayudando a personas a postular.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {ARTICLES.map(article => (
            <Link
              key={article.slug}
              to={`/recursos/${article.slug}`}
              style={{
                display: 'block', textDecoration: 'none', color: 'inherit',
                background: 'rgba(255,255,255,.03)', border: `1px solid ${C.line}`,
                borderRadius: 14, padding: '24px 26px',
              }}
            >
              <p style={{ fontFamily: sans, fontSize: 12, color: C.inkMuted, marginBottom: 8 }}>
                {new Date(article.publishedAt).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}
                {' · '}{article.readingTimeMin} min de lectura
              </p>
              <h2 style={{ fontFamily: display, fontSize: 21, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>
                {article.title}
              </h2>
              <p style={{ fontSize: 14.5, lineHeight: 1.65, color: C.inkSub, margin: 0 }}>
                {article.description}
              </p>
            </Link>
          ))}
        </div>
      </main>

      <footer style={{ borderTop: `1px solid ${C.line}`, padding: '32px 48px', textAlign: 'center' }}>
        <Link to="/" style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.violet2, textDecoration: 'none' }}>
          ← Volver a Ergania
        </Link>
      </footer>
    </div>
  )
}
