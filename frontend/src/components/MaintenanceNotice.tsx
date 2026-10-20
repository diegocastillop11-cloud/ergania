import { useEffect } from 'react'

// Aviso de pausa del proyecto. Para reactivar el sitio basta con poner esto en false.
// El modo offline (npm run local) es la copia personal del dueño: la pausa no le aplica.
export const SITE_PAUSED = import.meta.env.VITE_LOCAL_MODE !== '1'

export default function MaintenanceNotice() {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="pause-title"
      aria-describedby="pause-desc"
      className="fixed inset-0 z-[2147483647] flex items-center justify-center overflow-y-auto px-4 py-8"
      style={{
        background:
          'radial-gradient(ellipse at top, #1E1B4B 0%, #0B1330 55%, #070A16 100%)',
        fontFamily: "'Source Sans Pro', system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      <div
        className="w-full max-w-xl rounded-3xl p-8 sm:p-12 text-center"
        style={{
          background: 'rgba(11,19,48,0.8)',
          border: '1px solid rgba(167,139,250,0.25)',
          boxShadow: '0 30px 80px -20px rgba(96,165,250,0.25)',
          color: '#F1F2FB',
        }}
      >
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #60A5FA, #A78BFA)' }}
          aria-hidden="true"
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="#070A16">
            <rect x="6" y="5" width="4" height="14" rx="1.5" />
            <rect x="14" y="5" width="4" height="14" rx="1.5" />
          </svg>
        </div>

        <p
          className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]"
          style={{ color: '#22D3EE' }}
        >
          Aviso importante
        </p>

        <h1
          id="pause-title"
          className="mb-5 text-3xl sm:text-4xl font-bold leading-tight"
          style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
        >
          Ergania se toma una pausa
        </h1>

        <div id="pause-desc" className="space-y-4 text-base sm:text-lg leading-relaxed" style={{ color: '#B7BAE0' }}>
          <p>
            Hemos decidido poner nuestro proyecto en pausa por un tiempo. Por ahora la
            plataforma no estará disponible y no será posible iniciar sesión ni usar sus
            herramientas.
          </p>
          <p>
            Lamentamos sinceramente las molestias y agradecemos de corazón la confianza de
            cada persona que nos acompañó en su búsqueda de empleo. Su apoyo ha sido
            fundamental para nosotros.
          </p>
        </div>

        <div
          className="mx-auto my-7 h-px w-24"
          style={{ background: 'linear-gradient(90deg, transparent, #A78BFA, transparent)' }}
        />

        <p className="text-sm sm:text-base" style={{ color: '#7C82AE' }}>
          Esperamos volver pronto con novedades. Gracias por su comprensión.
          <br />
          <span style={{ color: '#B7BAE0' }}>— El equipo de Ergania</span>
        </p>
      </div>
    </div>
  )
}
