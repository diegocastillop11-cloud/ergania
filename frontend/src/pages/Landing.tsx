import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Smartphone } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { CosmicButton } from '../components/ui/cosmic-button'
import { logApkDownload } from '../lib/logApkDownload'

const ADSENSE_CLIENT = 'ca-pub-2632840688699034'

const C = {
  heroA:    '#1E1B4B',
  heroB:    '#0F1B3D',
  heroC:    '#0B1330',
  panel:    '#0B1330',
  panelAlt: '#10142B',
  footer:   '#070A16',
  ink:      '#F1F2FB',
  inkSub:   '#B7BAE0',
  inkMuted: '#7C82AE',
  line:     'rgba(255,255,255,.08)',
  blue:     '#3B82F6',
  blue2:    '#60A5FA',
  violet:   '#8B5CF6',
  violet2:  '#A78BFA',
  violet3:  '#C4B5FD',
  cyan:     '#22D3EE',
  white:    '#FFFFFF',
}

const gradAccent = `linear-gradient(90deg, ${C.blue2}, ${C.violet2})`

const display = "'Space Grotesk', -apple-system, 'Segoe UI', Arial, sans-serif"
const sans    = "'Source Sans Pro', -apple-system, 'Segoe UI', Arial, sans-serif"

function useCosmicNav() {
  const navigate = useNavigate()
  return (path: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    navigate(path)
  }
}

export default function Landing() {
  const { user, loading } = useAuth()
  const { t, language, setLanguage } = useTranslation()
  const cosmicNav = useCosmicNav()

  useEffect(() => {
    if (loading || user) return
    if (document.querySelector(`script[data-adsbygoogle-client="${ADSENSE_CLIENT}"]`)) return
    const script = document.createElement('script')
    script.async = true
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
    script.crossOrigin = 'anonymous'
    script.dataset.adsbygoogleClient = ADSENSE_CLIENT
    document.head.appendChild(script)
    return () => { script.remove() }
  }, [loading, user])

  if (!loading && user) return <Navigate to="/dashboard" replace />

  return (
    <div style={{ fontFamily: sans, background: C.panel, color: C.ink, minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        html { scroll-behavior: smooth; }
        .lp-btn-primary {
          background: ${C.blue2}; color: #05070F; border: none;
          border-radius: 9px; padding: 12px 24px; font-family: ${sans};
          font-size: 15px; font-weight: 700; cursor: pointer;
          text-decoration: none; display: inline-block; transition: filter .18s;
        }
        .lp-btn-primary:hover { filter: brightness(1.1); }
        .lp-btn-ghost {
          font-family: ${sans}; font-size: 15px; font-weight: 600;
          color: ${C.inkSub}; text-decoration: underline;
          text-underline-offset: 3px; cursor: pointer;
        }
        .lp-btn-ghost:hover { color: ${C.ink}; }
        .lp-btn-outline {
          display: inline-block; border: 2px solid ${C.white}; color: ${C.white};
          background: transparent; border-radius: 10px; padding: 14px 36px;
          font-family: ${sans}; font-size: 16px; font-weight: 700;
          text-decoration: none; transition: background .2s, color .2s;
        }
        .lp-btn-outline:hover { background: ${C.white}; color: ${C.blue}; }
        .lp-nav-link {
          font-family: ${sans}; font-size: 14px; font-weight: 600;
          color: ${C.inkSub}; text-decoration: none; transition: color .2s;
        }
        .lp-nav-link:hover { color: ${C.ink}; }
        .lp-android-link {
          display: inline-flex; align-items: center; gap: 8px; font-family: ${sans};
          font-size: 14px; font-weight: 600; color: ${C.cyan}; text-decoration: none;
          background: rgba(34,211,238,.10); border: 1px solid rgba(34,211,238,.28);
          border-radius: 100px; padding: 10px 20px; transition: background .18s, border-color .18s, transform .18s;
        }
        .lp-android-link:hover { background: rgba(34,211,238,.16); border-color: rgba(34,211,238,.45); transform: translateY(-1px); }
        .lp-feature-card {
          background: rgba(255,255,255,.03); border: 1px solid ${C.line};
          border-radius: 14px; padding: 30px 26px; transition: border-color .2s, background .2s;
        }
        .lp-feature-card:hover { border-color: rgba(96,165,250,.35); background: rgba(255,255,255,.045); }
        .lp-testimonial-card {
          background: rgba(255,255,255,.03); border: 1px solid ${C.line}; border-radius: 14px;
          padding: 28px 24px; display: flex; flex-direction: column; gap: 16px;
          text-decoration: none; color: inherit; cursor: pointer;
          transition: border-color .18s, background .18s, transform .18s;
        }
        .lp-testimonial-card:hover {
          border-color: rgba(96,165,250,.4); background: rgba(255,255,255,.05); transform: translateY(-2px);
        }
        .lp-plan-card {
          background: rgba(255,255,255,.03); border: 1px solid ${C.line}; border-radius: 18px;
          padding: 34px 30px; display: flex; flex-direction: column; position: relative;
        }
        .lp-plan-card.popular {
          border: 1px solid transparent;
          background: linear-gradient(160deg, rgba(96,165,250,.14), rgba(167,139,250,.14)), #12142F;
        }
        .lp-plan-card.popular::before {
          content: ""; position: absolute; inset: -1px; border-radius: 18px; padding: 1px;
          background: ${gradAccent};
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none;
        }
        .lp-plan-badge {
          position: absolute; top: -13px; left: 50%; transform: translateX(-50%);
          background: ${gradAccent}; color: #05070F; font-family: ${sans}; font-size: 10px; font-weight: 700;
          letter-spacing: 1px; padding: 4px 14px; border-radius: 20px; white-space: nowrap;
        }
        .lp-plan-cta-outline {
          display: block; text-align: center; border: 1.5px solid ${C.blue2}; color: ${C.blue2};
          font-family: ${sans}; font-size: 15px; font-weight: 700; padding: 12px 0; border-radius: 9px;
          text-decoration: none; transition: background .18s, color .18s;
        }
        .lp-plan-cta-outline:hover { background: ${C.blue2}; color: #05070F; }
        .lp-plan-cta-solid {
          display: block; text-align: center; padding: 13px 0; border-radius: 9px; font-family: ${sans};
          font-size: 15px; font-weight: 700; color: #05070F; background: ${gradAccent};
          text-decoration: none; border: none; cursor: pointer;
        }
        .lp-check { color: ${C.blue2}; font-weight: 700; margin-right: 10px; }
        .lp-hero-logo-glow {
          position: absolute; inset: -30%; border-radius: 50%;
          background: radial-gradient(circle, rgba(96,165,250,.35), rgba(139,92,246,.18) 55%, transparent 75%);
          filter: blur(18px); pointer-events: none;
        }
        @media (max-width: 860px) {
          .lp-grid-3 { grid-template-columns: 1fr !important; }
          .lp-grid-2 { grid-template-columns: 1fr !important; }
          .lp-plans { grid-template-columns: 1fr !important; max-width: 420px !important; }
          .lp-hero-h1 { font-size: 34px !important; }
          .lp-hide-sm { display: none !important; }
          .lp-section { padding: 60px 24px !important; }
          .lp-hero { padding: 60px 24px 76px !important; }
        }
        @media (max-width: 640px) {
          .lp-hero-ctas { flex-direction: column !important; align-items: stretch !important; }
          .lp-hero-ctas > a { width: 100%; text-align: center; }
        }
      `}</style>

      {/* ── NAV ── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(11,19,48,.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: `1px solid ${C.line}` }}>
        <nav style={{ maxWidth: 1200, margin: '0 auto', padding: '0 48px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <img src="/logo.png" alt="Ergania" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
          <div className="lp-hide-sm" style={{ display: 'flex', gap: 32 }}>
            <a href="#como-funciona" className="lp-nav-link">{t('landing.nav.features')}</a>
            <a href="#precios"       className="lp-nav-link">{t('landing.nav.pricing')}</a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, border: `1px solid ${C.line}`, borderRadius: 8, padding: 2 }}>
              <button
                onClick={() => setLanguage('es')}
                aria-label="Español"
                style={{
                  fontFamily: sans, fontSize: 12, fontWeight: 700, padding: '4px 9px', borderRadius: 6,
                  border: 'none', cursor: 'pointer', transition: 'background .2s, color .2s',
                  background: language === 'es' ? C.blue2 : 'transparent',
                  color: language === 'es' ? '#05070F' : C.inkSub,
                }}
              >
                ES
              </button>
              <button
                onClick={() => setLanguage('en')}
                aria-label="English"
                style={{
                  fontFamily: sans, fontSize: 12, fontWeight: 700, padding: '4px 9px', borderRadius: 6,
                  border: 'none', cursor: 'pointer', transition: 'background .2s, color .2s',
                  background: language === 'en' ? C.blue2 : 'transparent',
                  color: language === 'en' ? '#05070F' : C.inkSub,
                }}
              >
                EN
              </button>
            </div>
            <Link to="/login" style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: C.inkSub, textDecoration: 'none' }}>
              {t('landing.nav.login')}
            </Link>
            <Link to="/login?tab=registro" className="lp-btn-primary" style={{ padding: '9px 20px', fontSize: 14, borderRadius: 8 }}>
              {t('landing.nav.tryNow')}
            </Link>
          </div>
        </nav>
      </header>

      {/* ── HERO ── */}
      <section className="lp-hero" style={{ background: `radial-gradient(circle at 18% -10%, ${C.heroA} 0%, ${C.heroB} 55%, ${C.heroC} 100%)`, padding: '88px 48px 100px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 420, height: 420, borderRadius: '50%', background: C.blue, opacity: .18, filter: 'blur(70px)', top: -120, left: -80, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 340, height: 340, borderRadius: '50%', background: C.violet, opacity: .16, filter: 'blur(70px)', bottom: -100, right: -60, pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, margin: '0 auto' }}>
          <div style={{ position: 'relative', display: 'block', width: 'fit-content', margin: '0 auto 26px' }}>
            <div className="lp-hero-logo-glow" />
            <img src="/logo.png" alt="Ergania" style={{ position: 'relative', height: 84, width: 'auto', objectFit: 'contain' }} />
          </div>

          <span style={{ display: 'inline-block', fontFamily: sans, fontSize: 12, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: C.violet3, background: 'rgba(139,92,246,.16)', border: '1px solid rgba(139,92,246,.25)', borderRadius: 100, padding: '6px 14px', marginBottom: 26 }}>
            {t('landing.hero.badge')}
          </span>

          <h1 className="lp-hero-h1" style={{ fontFamily: display, fontSize: 54, fontWeight: 700, lineHeight: 1.12, letterSpacing: -1, margin: '0 0 20px' }}>
            {t('landing.hero.title1')}<br />
            <span style={{ background: gradAccent, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
              {t('landing.hero.title2')}
            </span>
          </h1>

          <p style={{ fontFamily: sans, fontSize: 18, fontWeight: 400, lineHeight: 1.65, color: C.inkSub, maxWidth: 500, margin: '0 auto 36px' }}>
            {t('landing.hero.subtitle')}
          </p>

          <div className="lp-hero-ctas" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, flexWrap: 'wrap', marginBottom: 36 }}>
            <CosmicButton
              href="/login?tab=registro"
              onClick={cosmicNav('/login?tab=registro')}
              target="_self"
              rel={undefined}
            >
              {t('landing.hero.ctaPrimary')}
            </CosmicButton>
            <a href="#como-funciona" className="lp-btn-ghost">{t('landing.hero.ctaGhost')}</a>
          </div>

          <a href="/ergania.apk" download onClick={logApkDownload} className="lp-android-link" style={{ marginBottom: 40 }}>
            <Smartphone size={16} />
            {t('landing.hero.androidCta')}
          </a>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ display: 'flex' }}>
              {['#60A5FA', '#A78BFA', '#3B82F6', '#22D3EE'].map((bg, i) => (
                <div key={i} style={{ width: 36, height: 36, borderRadius: '50%', background: bg, border: `2.5px solid ${C.heroC}`, marginLeft: i === 0 ? 0 : -9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: display, fontWeight: 700, fontSize: 13, color: '#05070F' }}>
                  {['M','R','C','J'][i]}
                </div>
              ))}
            </div>
            <p style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: C.inkSub }}>
              <strong style={{ color: C.ink }}>+2.400</strong> {t('landing.hero.socialProof')}
            </p>
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section id="como-funciona" className="lp-section" style={{ padding: '84px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: C.blue2, marginBottom: 14 }}>{t('landing.howItWorks.kicker')}</p>
          <h2 style={{ fontFamily: display, fontSize: 38, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.2, marginBottom: 48, maxWidth: 640 }}>
            {t('landing.howItWorks.title')}
          </h2>
          <div className="lp-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 36 }}>
            {[
              { n: '1', title: t('landing.howItWorks.step1title'), desc: t('landing.howItWorks.step1desc') },
              { n: '2', title: t('landing.howItWorks.step2title'), desc: t('landing.howItWorks.step2desc') },
              { n: '3', title: t('landing.howItWorks.step3title'), desc: t('landing.howItWorks.step3desc') },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${C.blue}, ${C.violet})`, color: '#fff', fontFamily: display, fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</div>
                <h3 style={{ fontFamily: display, fontSize: 19, fontWeight: 700, lineHeight: 1.3 }}>{s.title}</h3>
                <p style={{ fontFamily: sans, fontSize: 15, lineHeight: 1.7, color: C.inkSub }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="lp-section" style={{ background: C.panelAlt, padding: '84px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: C.blue2, marginBottom: 14 }}>{t('landing.features.kicker')}</p>
          <h2 style={{ fontFamily: display, fontSize: 38, fontWeight: 700, marginBottom: 44 }}>{t('landing.features.title')}</h2>
          <div className="lp-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {[
              { title: t('landing.features.f1title'), desc: t('landing.features.f1desc') },
              { title: t('landing.features.f2title'), desc: t('landing.features.f2desc') },
              { title: t('landing.features.f3title'), desc: t('landing.features.f3desc') },
            ].map(f => (
              <div key={f.title} className="lp-feature-card">
                <h3 style={{ fontFamily: display, fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{f.title}</h3>
                <p style={{ fontFamily: sans, fontSize: 14.5, lineHeight: 1.68, color: C.inkSub }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ── */}
      <section className="lp-section" style={{ padding: '84px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: C.blue2, marginBottom: 14 }}>{t('landing.testimonials.kicker')}</p>
          <h2 style={{ fontFamily: display, fontSize: 38, fontWeight: 700, marginBottom: 44 }}>{t('landing.testimonials.title')}</h2>
          <div className="lp-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 22 }}>
            {[
              { initial: 'A', bg: '#60A5FA', name: 'Alberto', quote: t('landing.testimonials.t1quote'), href: 'https://maps.app.goo.gl/ge1J29uMzRC2SU518' },
              { initial: 'F', bg: '#A78BFA', name: 'Felipe',   quote: t('landing.testimonials.t2quote'), href: 'https://maps.app.goo.gl/Ndd71vFVguyETAQC8' },
            ].map(item => (
              <a key={item.name} href={item.href} target="_blank" rel="noopener noreferrer" className="lp-testimonial-card">
                <p style={{ color: C.cyan, fontSize: 13, letterSpacing: 2, margin: 0 }}>★★★★★</p>
                <blockquote style={{ margin: 0, fontFamily: sans, fontSize: 15, lineHeight: 1.65, color: C.ink, flex: 1 }}>{item.quote}</blockquote>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: item.bg, color: '#05070F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: display, fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{item.initial}</div>
                  <p style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, margin: 0 }}>{item.name}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: sans, fontSize: 12, fontWeight: 600, color: C.blue2, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                  {t('landing.testimonials.verifiedTag')}
                  <span aria-hidden="true">↗</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRECIOS ── */}
      <section id="precios" className="lp-section" style={{ background: C.panelAlt, padding: '84px 48px', textAlign: 'center' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: C.blue2, marginBottom: 14 }}>{t('landing.pricing.kicker')}</p>
          <h2 style={{ fontFamily: display, fontSize: 38, fontWeight: 700, marginBottom: 10 }}>{t('landing.pricing.title')}</h2>
          <p style={{ fontFamily: sans, fontSize: 16, color: C.inkSub, marginBottom: 44 }}>{t('landing.pricing.subtitle')}</p>

          <div className="lp-plans" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 22, maxWidth: 780, margin: '0 auto 28px' }}>
            {/* Gratis */}
            <div className="lp-plan-card" style={{ textAlign: 'left' }}>
              <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.inkMuted, marginBottom: 12 }}>{t('landing.pricing.freeLabel')}</p>
              <div style={{ fontFamily: display, fontSize: 40, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>{t('landing.pricing.freePrice')}</div>
              <p style={{ fontFamily: sans, fontSize: 13, color: C.inkMuted, marginBottom: 26 }}>{t('landing.pricing.freePeriod')}</p>
              <div style={{ flex: 1, marginBottom: 26 }}>
                {[t('landing.pricing.freeF1'), t('landing.pricing.freeF2'), t('landing.pricing.freeF3')].map(f => (
                  <div key={f} style={{ fontFamily: sans, fontSize: 14, color: C.inkSub, padding: '8px 0', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center' }}>
                    <span className="lp-check">✓</span>{f}
                  </div>
                ))}
              </div>
              <Link to="/login?tab=registro" className="lp-plan-cta-outline">
                {t('landing.pricing.freeCta')}
              </Link>
            </div>

            {/* Pro */}
            <div className="lp-plan-card popular" style={{ textAlign: 'left' }}>
              <div className="lp-plan-badge">
                {t('landing.pricing.proBadge')}
              </div>
              <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.blue2, marginBottom: 12 }}>{t('landing.pricing.proLabel')}</p>
              <div style={{ fontFamily: display, fontSize: 40, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>{t('landing.pricing.proPrice')}</div>
              <p style={{ fontFamily: sans, fontSize: 13, color: C.inkMuted, marginBottom: 26 }}>{t('landing.pricing.proPeriod')}</p>
              <div style={{ flex: 1, marginBottom: 26 }}>
                {[t('landing.pricing.proF1'), t('landing.pricing.proF2'), t('landing.pricing.proF3'), t('landing.pricing.proF4')].map(f => (
                  <div key={f} style={{ fontFamily: sans, fontSize: 14, color: C.inkSub, padding: '8px 0', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center' }}>
                    <span className="lp-check">✓</span>{f}
                  </div>
                ))}
              </div>
              <Link to="/login?tab=registro" className="lp-plan-cta-solid">
                {t('landing.pricing.proCta')}
              </Link>
            </div>
          </div>

          <p style={{ fontFamily: sans, fontSize: 13, color: C.inkMuted }} dangerouslySetInnerHTML={{ __html: t('landing.pricing.footnote') }} />
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="lp-section" style={{ background: `linear-gradient(135deg, #1B2A6B 0%, #3B2E8C 100%)`, padding: '88px 48px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 380, height: 380, borderRadius: '50%', background: C.blue2, opacity: .22, filter: 'blur(70px)', top: -100, left: -80, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: C.violet3, opacity: .18, filter: 'blur(70px)', bottom: -80, right: 60, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontFamily: display, fontSize: 42, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.15, marginBottom: 30 }}>
            {t('landing.finalCta.title')}
          </h2>
          <CosmicButton
            href="/login?tab=registro"
            onClick={cosmicNav('/login?tab=registro')}
            target="_self"
            rel={undefined}
          >
            {t('landing.finalCta.cta')}
          </CosmicButton>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: C.footer, padding: '44px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
          <span style={{ fontFamily: display, fontWeight: 700, fontSize: 22, color: C.ink }}>ergania</span>
          <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href="#como-funciona" style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.inkMuted, textDecoration: 'none' }}>{t('landing.nav.features')}</a>
            <a href="#precios" style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.inkMuted, textDecoration: 'none' }}>{t('landing.nav.pricing')}</a>
            <Link to="/privacidad" style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.inkMuted, textDecoration: 'none' }}>{t('landing.footer.privacy')}</Link>
          </div>
          <p style={{ fontFamily: sans, fontSize: 12, color: 'rgba(241,242,251,.28)' }}>
            {t('landing.footer.madeIn')}
          </p>
        </div>
      </footer>
    </div>
  )
}
