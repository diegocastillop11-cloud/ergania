import { useEffect, useRef } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getArticleBySlug } from '../content/articles'
import { useDocumentMeta } from '../lib/useDocumentMeta'

// Se activa recién cuando exista un ad-slot real creado en el dashboard de
// AdSense (es un paso manual de Diego). El script de adsbygoogle.js lo carga
// index.html en todo el sitio — Google necesita verlo en el HTML servido, no
// inyectado por JS —, así que sin esto la página simplemente no dibuja el
// bloque manual, pero Auto ads sigue disponible.
const ADSENSE_SLOT = import.meta.env.VITE_ADSENSE_SLOT_RECURSOS as string | undefined

function AdSlot({ slot }: { slot: string }) {
  const ref = useRef<HTMLModElement>(null)
  useEffect(() => {
    try {
      ;(window as any).adsbygoogle = (window as any).adsbygoogle || []
      ;(window as any).adsbygoogle.push({})
    } catch {
      // adsbygoogle.js todavía no cargó — no bloquea el render del artículo
    }
  }, [])
  return (
    <ins
      ref={ref}
      className="adsbygoogle"
      style={{ display: 'block', margin: '40px 0' }}
      data-ad-client="ca-pub-2632840688699034"
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}

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

export default function RecursosArticle() {
  const { slug } = useParams<{ slug: string }>()
  const article = slug ? getArticleBySlug(slug) : undefined

  useDocumentMeta(
    article ? `${article.title} — Ergania` : 'Recursos — Ergania',
    article?.description ?? '',
  )

  if (!article) return <Navigate to="/recursos" replace />

  return (
    <div style={{ fontFamily: sans, background: C.panel, color: C.ink, minHeight: '100vh' }}>
      <header style={{ borderBottom: `1px solid ${C.line}`, padding: '20px 48px' }}>
        <Link to="/" style={{ display: 'inline-block' }}>
          <img src="/logo.png" alt="Ergania" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
        </Link>
      </header>

      <article style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px 40px' }}>
        <Link to="/recursos" style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.blue2, textDecoration: 'none' }}>
          ← Recursos
        </Link>

        <p style={{ fontFamily: sans, fontSize: 12, color: C.inkMuted, margin: '20px 0 10px' }}>
          {new Date(article.publishedAt).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}
          {' · '}{article.readingTimeMin} min de lectura
        </p>
        <h1 style={{ fontFamily: display, fontSize: 34, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.5, marginBottom: 32 }}>
          {article.title}
        </h1>

        <div style={{ fontSize: 16.5, lineHeight: 1.8, color: C.inkSub }}>
          {article.body.map((block, i) => {
            if (block.type === 'h2') {
              return <h2 key={i} style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: C.ink, margin: '36px 0 14px' }}>{block.text}</h2>
            }
            if (block.type === 'ul') {
              return (
                <ul key={i} style={{ margin: '0 0 20px', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {block.items.map((item, j) => <li key={j}>{item}</li>)}
                </ul>
              )
            }
            return <p key={i} style={{ margin: '0 0 20px' }}>{block.text}</p>
          })}
        </div>

        {ADSENSE_SLOT && <AdSlot slot={ADSENSE_SLOT} />}

        {article.relatedFeature && (
          <div style={{
            marginTop: 24, padding: '24px 26px', borderRadius: 14,
            background: 'linear-gradient(160deg, rgba(96,165,250,.14), rgba(167,139,250,.14)), #12142F',
            border: `1px solid ${C.line}`, textAlign: 'center',
          }}>
            <p style={{ fontSize: 14.5, color: C.inkSub, marginBottom: 14 }}>
              Ergania te ayuda a aplicar esto directamente en tus postulaciones.
            </p>
            <Link
              to={article.relatedFeature.href}
              className="lp-btn-primary"
              style={{
                background: C.blue2, color: '#05070F', border: 'none', borderRadius: 9,
                padding: '12px 24px', fontFamily: sans, fontSize: 15, fontWeight: 700,
                textDecoration: 'none', display: 'inline-block',
              }}
            >
              {article.relatedFeature.label}
            </Link>
          </div>
        )}
      </article>

      <footer style={{ borderTop: `1px solid ${C.line}`, padding: '32px 48px', textAlign: 'center' }}>
        <Link to="/recursos" style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.violet2, textDecoration: 'none' }}>
          ← Ver todos los recursos
        </Link>
      </footer>
    </div>
  )
}
