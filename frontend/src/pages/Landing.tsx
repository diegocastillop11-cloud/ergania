import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

const C = {
  cream:    '#FAF7F2',
  creamAlt: '#F0EBE3',
  brown:    '#2E1508',
  brownSec: '#7A5C4A',
  muted:    '#9B7E6A',
  terra:    '#C4633A',
  sage:     '#6B8F71',
  white:    '#FFFFFF',
}

const serif  = "'Playfair Display', serif"
const sans   = "'Source Sans Pro', sans-serif"

export default function Landing() {
  const { user, loading } = useAuth()
  if (!loading && user) return <Navigate to="/dashboard" replace />

  return (
    <div style={{ fontFamily: sans, background: C.cream, color: C.brown, minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        .lp-btn-primary {
          background: ${C.terra}; color: ${C.white}; border: none;
          border-radius: 8px; padding: 12px 28px; font-family: ${sans};
          font-size: 15px; font-weight: 700; cursor: pointer;
          text-decoration: none; display: inline-block; transition: background .2s;
        }
        .lp-btn-primary:hover { background: #b05630; }
        .lp-btn-ghost {
          font-family: ${sans}; font-size: 15px; font-weight: 600;
          color: ${C.brownSec}; text-decoration: underline;
          text-underline-offset: 3px; cursor: pointer;
        }
        .lp-btn-ghost:hover { color: ${C.brown}; }
        .lp-btn-outline {
          display: inline-block; border: 2px solid ${C.white}; color: ${C.white};
          background: transparent; border-radius: 10px; padding: 14px 36px;
          font-family: ${sans}; font-size: 16px; font-weight: 700;
          text-decoration: none; transition: background .2s, color .2s;
        }
        .lp-btn-outline:hover { background: ${C.white}; color: ${C.terra}; }
        .lp-feature-card {
          background: ${C.cream}; border: 1.5px solid rgba(46,21,8,.10);
          border-radius: 16px; padding: 32px 28px; transition: border-color .2s;
        }
        .lp-feature-card:hover { border-color: rgba(196,99,58,.30); }
        .lp-plan-card {
          background: ${C.cream}; border: 1.5px solid rgba(46,21,8,.10);
          border-radius: 16px; padding: 36px 32px; display: flex; flex-direction: column;
        }
        .lp-plan-card.popular { border: 2px solid ${C.terra}; position: relative; }
        .lp-testimonial-card {
          background: ${C.cream}; border-radius: 16px; padding: 32px 28px;
          border: 1.5px solid rgba(46,21,8,.07); display: flex; flex-direction: column; gap: 18px;
        }
        .lp-nav-link {
          font-family: ${sans}; font-size: 15px; font-weight: 600;
          color: ${C.muted}; text-decoration: none; transition: color .2s;
        }
        .lp-nav-link:hover { color: ${C.brown}; }
        .lp-check-terra { color: ${C.terra}; font-weight: 700; margin-right: 10px; }
        .lp-check-sage  { color: ${C.sage};  font-weight: 700; margin-right: 10px; }
        @media (max-width: 860px) {
          .lp-grid-3 { grid-template-columns: 1fr !important; }
          .lp-grid-2 { grid-template-columns: 1fr !important; }
          .lp-hero-h1 { font-size: 38px !important; }
          .lp-hide-sm { display: none !important; }
          .lp-section { padding: 60px 24px !important; }
          .lp-hero { padding: 64px 24px 80px !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <header style={{ background: C.cream, borderBottom: `1px solid rgba(46,21,8,.08)`, position: 'sticky', top: 0, zIndex: 100 }}>
        <nav style={{ maxWidth: 1200, margin: '0 auto', padding: '0 48px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 700, fontSize: 24, color: C.brown }}>ergania</span>
          <div className="lp-hide-sm" style={{ display: 'flex', gap: 32 }}>
            <a href="#como-funciona" className="lp-nav-link">Funciones</a>
            <a href="#precios"       className="lp-nav-link">Precios</a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Link to="/login" style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: C.brownSec, textDecoration: 'none' }}>
              Iniciar sesión
            </Link>
            <Link to="/login" className="lp-btn-primary" style={{ padding: '9px 20px', fontSize: 14, borderRadius: 8 }}>
              Probar ahora
            </Link>
          </div>
        </nav>
      </header>

      {/* ── HERO ── */}
      <section className="lp-hero" style={{ background: C.cream, padding: '88px 48px 96px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* decorative circles */}
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: C.terra, opacity: .09, top: -140, right: 40, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', background: C.sage, opacity: .16, bottom: -60, left: 100, pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto' }}>
          <span style={{ display: 'inline-block', fontFamily: sans, fontSize: 12, fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', color: C.terra, background: 'rgba(196,99,58,.10)', borderRadius: 100, padding: '5px 14px', marginBottom: 24 }}>
            IA para tu búsqueda laboral · Chile
          </span>

          <h1 className="lp-hero-h1" style={{ fontFamily: serif, fontSize: 56, fontWeight: 700, lineHeight: 1.13, color: C.brown, letterSpacing: -1, marginBottom: 22 }}>
            Encuentra tu trabajo ideal,<br />deja que la IA te ayude
          </h1>

          <p style={{ fontFamily: sans, fontSize: 18, fontWeight: 400, lineHeight: 1.65, color: C.brownSec, maxWidth: 520, margin: '0 auto 36px' }}>
            Ergania adapta tu CV a cada oferta, evalúa si conviene postular,
            y te prepara para la entrevista.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 44 }}>
            <Link to="/login" className="lp-btn-primary" style={{ fontSize: 17, padding: '13px 32px', borderRadius: 10 }}>
              Probar gratis 3 días →
            </Link>
            <a href="#como-funciona" className="lp-btn-ghost">Ver cómo funciona</a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ display: 'flex' }}>
              {['#A0604A', '#7A8F6B', '#C4633A', '#5C7E8F'].map((bg, i) => (
                <div key={i} style={{ width: 36, height: 36, borderRadius: '50%', background: bg, border: `2.5px solid ${C.cream}`, marginLeft: i === 0 ? 0 : -9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontStyle: 'italic', fontSize: 13, fontWeight: 700, color: C.white }}>
                  {['M','R','C','J'][i]}
                </div>
              ))}
            </div>
            <p style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: C.brownSec }}>
              <strong style={{ color: C.brown }}>+2.400 personas</strong> buscando trabajo
            </p>
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section id="como-funciona" className="lp-section" style={{ background: C.creamAlt, padding: '88px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: C.terra, marginBottom: 14 }}>Cómo funciona</p>
          <h2 style={{ fontFamily: serif, fontSize: 38, fontWeight: 700, color: C.brown, letterSpacing: -0.5, lineHeight: 1.2, marginBottom: 52 }}>
            Tres pasos hacia tu próxima oportunidad
          </h2>
          <div className="lp-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 36 }}>
            {[
              { n: '1', title: 'Sube tu CV', desc: 'Carga tu currículum en PDF o Word. Lo analizamos para entender tu perfil al máximo.' },
              { n: '2', title: 'Pega la oferta', desc: 'Copia la descripción del cargo que te interesa. Evaluamos la compatibilidad con tu perfil al instante.' },
              { n: '3', title: 'Recibe tu postulación lista', desc: 'Obtienes tu CV adaptado, una carta de presentación y una guía para la entrevista.' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: C.terra, color: C.white, fontFamily: serif, fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</div>
                <h3 style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: C.brown, lineHeight: 1.3 }}>{s.title}</h3>
                <p style={{ fontFamily: sans, fontSize: 15, lineHeight: 1.7, color: C.brownSec }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="lp-section" style={{ background: C.cream, padding: '88px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: C.terra, marginBottom: 14 }}>Funciones</p>
          <h2 style={{ fontFamily: serif, fontSize: 38, fontWeight: 700, color: C.brown, marginBottom: 44 }}>Herramientas pensadas para ti</h2>
          <div className="lp-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20 }}>
            {[
              { title: 'CV Adaptado con IA',           desc: 'Ajusta automáticamente tu CV para cada cargo, resaltando lo que importa al reclutador.' },
              { title: 'Evaluación de Ofertas',        desc: 'Score de compatibilidad: sueldo, stack, cultura y distancia. Sabe si conviene postular antes de gastar tiempo.' },
              { title: 'Preparación para entrevistas', desc: 'Preguntas frecuentes del rol, respuestas guiadas y consejos específicos para esa empresa.' },
            ].map(f => (
              <div key={f.title} className="lp-feature-card">
                <h3 style={{ fontFamily: serif, fontSize: 19, fontWeight: 700, color: C.brown, marginBottom: 10 }}>{f.title}</h3>
                <p style={{ fontFamily: sans, fontSize: 15, lineHeight: 1.68, color: C.brownSec }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ── */}
      <section className="lp-section" style={{ background: C.creamAlt, padding: '88px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: C.terra, marginBottom: 14 }}>Testimonios</p>
          <h2 style={{ fontFamily: serif, fontSize: 38, fontWeight: 700, color: C.brown, marginBottom: 44 }}>Personas que ya encontraron su próximo trabajo</h2>
          <div className="lp-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
            {[
              { initial: 'M', bg: '#A0604A', name: 'María José', role: 'Diseñadora UX',        quote: '"Postulé a 12 empresas en una semana. Antes me demoraba días en preparar cada postulación."' },
              { initial: 'R', bg: '#5C7E8F', name: 'Rodrigo',    role: 'Analista de Datos',   quote: '"El score de compatibilidad me salvó de postular a trabajos que no encajaban. Ahorré semanas."' },
              { initial: 'C', bg: '#7A8F6B', name: 'Camila',     role: 'Marketing Digital',   quote: '"La preparación para entrevistas fue más útil que cualquier curso que había tomado."' },
            ].map(t => (
              <div key={t.name} className="lp-testimonial-card">
                <p style={{ color: C.terra, fontSize: 13, letterSpacing: 2 }}>★★★★★</p>
                <p style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 16, lineHeight: 1.65, color: C.brown, flex: 1 }}>{t.quote}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: t.bg, color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontStyle: 'italic', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{t.initial}</div>
                  <div>
                    <p style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, color: C.brown }}>{t.name}</p>
                    <p style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRECIOS ── */}
      <section id="precios" className="lp-section" style={{ background: C.cream, padding: '88px 48px', textAlign: 'center' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: C.terra, marginBottom: 14 }}>Precios</p>
          <h2 style={{ fontFamily: serif, fontSize: 38, fontWeight: 700, color: C.brown, marginBottom: 10 }}>Simple y directo</h2>
          <p style={{ fontFamily: sans, fontSize: 17, color: C.brownSec, marginBottom: 52 }}>3 días gratis, luego $9.990/mes. Cancela cuando quieras.</p>

          <div className="lp-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 24, maxWidth: 800, margin: '0 auto 28px' }}>
            {/* Gratis */}
            <div className="lp-plan-card" style={{ textAlign: 'left' }}>
              <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.muted, marginBottom: 12 }}>Prueba gratis</p>
              <div style={{ fontFamily: serif, fontSize: 42, fontWeight: 700, color: C.brown, lineHeight: 1, marginBottom: 4 }}>$0</div>
              <p style={{ fontFamily: sans, fontSize: 13, color: C.muted, marginBottom: 28 }}>durante 3 días</p>
              <div style={{ flex: 1, marginBottom: 28 }}>
                {['CV adaptado con IA', 'Evaluación de ofertas', 'Prep de entrevistas'].map(f => (
                  <div key={f} style={{ fontFamily: sans, fontSize: 14, color: C.brownSec, padding: '7px 0', borderBottom: `1px solid rgba(46,21,8,.07)`, display: 'flex', alignItems: 'center' }}>
                    <span className="lp-check-sage">✓</span>{f}
                  </div>
                ))}
              </div>
              <Link to="/login" style={{ display: 'block', textAlign: 'center', border: `1.5px solid ${C.terra}`, color: C.terra, fontFamily: sans, fontSize: 15, fontWeight: 700, padding: '12px 0', borderRadius: 8, textDecoration: 'none' }}>
                Comenzar gratis
              </Link>
            </div>

            {/* Pro */}
            <div className="lp-plan-card popular" style={{ textAlign: 'left' }}>
              <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: C.terra, color: C.cream, fontFamily: sans, fontSize: 10, fontWeight: 700, letterSpacing: '1px', padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                MÁS POPULAR
              </div>
              <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.terra, marginBottom: 12 }}>Plan mensual</p>
              <div style={{ fontFamily: serif, fontSize: 42, fontWeight: 700, color: C.brown, lineHeight: 1, marginBottom: 4 }}>$9.990</div>
              <p style={{ fontFamily: sans, fontSize: 13, color: C.muted, marginBottom: 28 }}>por mes · cancela cuando quieras</p>
              <div style={{ flex: 1, marginBottom: 28 }}>
                {['Todo lo del plan gratis', 'Postulaciones ilimitadas', 'Escáner de portales Chile', 'Soporte prioritario'].map(f => (
                  <div key={f} style={{ fontFamily: sans, fontSize: 14, color: C.brownSec, padding: '7px 0', borderBottom: `1px solid rgba(46,21,8,.07)`, display: 'flex', alignItems: 'center' }}>
                    <span className="lp-check-terra">✓</span>{f}
                  </div>
                ))}
              </div>
              <Link to="/login" className="lp-btn-primary" style={{ display: 'block', textAlign: 'center', padding: '13px 0', borderRadius: 8, fontSize: 15 }}>
                Probar 3 días gratis →
              </Link>
            </div>
          </div>

          <p style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>
            Pago seguro con <strong style={{ color: C.brownSec }}>MercadoPago</strong> · Sin permanencia · Cancela desde tu cuenta
          </p>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="lp-section" style={{ background: C.terra, padding: '88px 48px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 380, height: 380, borderRadius: '50%', background: 'rgba(255,255,255,.07)', top: -100, left: -80, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,.05)', bottom: -80, right: 60, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontFamily: serif, fontSize: 44, fontWeight: 700, color: C.white, letterSpacing: -0.5, lineHeight: 1.15, marginBottom: 16 }}>
            Empieza tu búsqueda hoy
          </h2>
          <p style={{ fontFamily: sans, fontSize: 17, color: 'rgba(250,247,242,.82)', lineHeight: 1.6, marginBottom: 40 }}>
            Sin suscripción. Solo trae tu API key de Gemini y comienza.
          </p>
          <Link to="/login" className="lp-btn-outline">Probar Ergania gratis →</Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: C.brown, padding: '44px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <span style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 700, fontSize: 26, color: C.cream }}>ergania</span>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['Funciones', 'Precios', 'Privacidad'].map(l => (
              <a key={l} href={l === 'Precios' ? '#precios' : '#'} style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: 'rgba(250,247,242,.50)', textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
          <p style={{ fontFamily: sans, fontSize: 12, color: 'rgba(250,247,242,.30)' }}>
            Hecho con <span style={{ color: C.terra }}>♥</span> en Chile · 2026
          </p>
        </div>
      </footer>
    </div>
  )
}
