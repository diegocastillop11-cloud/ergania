import { Link } from 'react-router-dom'

const C = {
  cream:    '#FAF7F2',
  creamAlt: '#F0EBE3',
  brown:    '#2E1508',
  brownSec: '#7A5C4A',
  muted:    '#9B7E6A',
  terra:    '#C4633A',
  white:    '#FFFFFF',
}

const serif = "'Playfair Display', serif"
const sans  = "'Source Sans Pro', sans-serif"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{ fontFamily: serif, fontSize: 22, fontWeight: 700, color: C.brown, marginBottom: 12 }}>{title}</h2>
      <div style={{ fontFamily: sans, fontSize: 15.5, lineHeight: 1.7, color: C.brownSec }}>{children}</div>
    </section>
  )
}

export default function Privacy() {
  return (
    <div style={{ fontFamily: sans, background: C.cream, color: C.brown, minHeight: '100vh' }}>
      <header style={{ background: C.cream, borderBottom: `1px solid rgba(46,21,8,.08)`, position: 'sticky', top: 0, zIndex: 100 }}>
        <nav style={{ maxWidth: 1200, margin: '0 auto', padding: '0 48px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/">
            <img src="/logo.png" alt="Ergania" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
          </Link>
          <Link to="/" style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: C.brownSec, textDecoration: 'none' }}>
            ← Volver al inicio
          </Link>
        </nav>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '64px 48px 96px' }}>
        <h1 style={{ fontFamily: serif, fontSize: 40, fontWeight: 700, color: C.brown, letterSpacing: -0.5, marginBottom: 8 }}>
          Política de Privacidad
        </h1>
        <p style={{ fontFamily: sans, fontSize: 14, color: C.muted, marginBottom: 48 }}>
          Última actualización: 15 de julio de 2026
        </p>

        <Section title="Qué datos recopilamos">
          <p style={{ marginBottom: 12 }}>
            Cuando creas una cuenta en Ergania recopilamos tu correo electrónico y nombre. Al usar
            la plataforma nos entregas además datos de tu perfil profesional: tu CV, experiencia
            laboral, estudios, y opcionalmente tu perfil de LinkedIn — información que tú mismo
            subes o completas para que podamos generar CVs, cartas de presentación y
            recomendaciones adaptadas a ti.
          </p>
          <p>
            Si contratas una suscripción, el pago se procesa directamente por MercadoPago.
            Ergania no almacena los datos de tu tarjeta ni medio de pago en ningún momento.
          </p>
        </Section>

        <Section title="Cómo usamos tus datos">
          <p>
            Usamos tu información para operar el servicio: generar y editar tu CV, evaluar ofertas
            de trabajo, sugerir cargos, optimizar tu perfil de LinkedIn y hacer seguimiento de tus
            postulaciones. Para esto, partes de tu perfil (nunca tus credenciales ni datos de pago)
            se envían a la API de Anthropic (Claude) para su procesamiento con inteligencia
            artificial.
          </p>
        </Section>

        <Section title="Con quién compartimos datos">
          <p style={{ marginBottom: 12 }}>
            No vendemos tus datos personales. Los compartimos únicamente con los proveedores que
            necesitamos para operar:
          </p>
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li><strong style={{ color: C.brown }}>Supabase</strong> — autenticación y almacenamiento de tu cuenta y datos de perfil.</li>
            <li><strong style={{ color: C.brown }}>Anthropic (Claude)</strong> — procesamiento de IA sobre tu CV y perfil.</li>
            <li><strong style={{ color: C.brown }}>MercadoPago</strong> — procesamiento de pagos de tu suscripción.</li>
            <li><strong style={{ color: C.brown }}>Google AdSense</strong> — muestra anuncios en nuestra página de inicio pública para financiar el servicio (ver sección de Cookies abajo).</li>
          </ul>
        </Section>

        <Section title="Cookies y publicidad">
          <p style={{ marginBottom: 12 }}>
            Nuestra página de inicio (ergania.com) usa Google AdSense para mostrar anuncios.
            Google y sus socios publicitarios pueden usar cookies y tecnologías similares para
            mostrar anuncios en base a tus visitas a este y otros sitios, y para medir su
            rendimiento.
          </p>
          <p>
            Puedes revisar y ajustar la personalización de anuncios de Google en{' '}
            <a
              href="https://myadcenter.google.com/personalizationoff"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: C.terra, fontWeight: 600 }}
            >
              Google Ad Settings
            </a>. Estos anuncios solo se muestran en nuestra página pública de inicio, nunca dentro
            de la plataforma una vez que iniciaste sesión.
          </p>
        </Section>

        <Section title="Fuentes de información de terceros y limitación de responsabilidad">
          <p style={{ marginBottom: 12 }}>
            Ergania recopila y presenta información de carácter público, disponible en portales
            de empleo operados por terceros —incluyendo, sin limitarse a, LinkedIn, Indeed,
            GetOnBoard, Computrabajo, Bumeran, Laborum y Trabajando.cl—, así como en las ofertas
            laborales que el usuario incorpora directamente a la plataforma o que son evaluadas a
            solicitud de este. La totalidad de dicha información es de propiedad exclusiva de los
            respectivos portales o empleadores, por lo que Ergania no efectúa verificación,
            edición ni otorga garantía alguna respecto de su contenido.
          </p>
          <p style={{ marginBottom: 12 }}>
            En consecuencia, Ergania no asume responsabilidad alguna por la exactitud, vigencia,
            legalidad o contenido de las ofertas, avisos o sitios web de terceros a los que haga
            referencia o a los cuales enlace. Se recomienda encarecidamente a los usuarios
            verificar dicha información directamente con el portal o empleador correspondiente,
            de manera previa a postular, a compartir datos personales o a adoptar cualquier
            decisión fundada en dicho contenido.
          </p>
          <p>
            Asimismo, en caso de que el usuario haga uso de un servicio prestado por un tercero al
            cual Ergania lo redirija —a modo ejemplar, al postular a través de un portal
            externo—, dicho uso se regirá exclusivamente por los términos y condiciones y la
            política de privacidad establecidos por ese tercero, quedando expresamente excluida
            la aplicación de los términos y políticas de Ergania respecto de dicha interacción.
          </p>
        </Section>

        <Section title="Tus derechos">
          <p>
            Puedes pedirnos acceder, corregir o eliminar tus datos personales, o cerrar tu cuenta
            por completo, escribiéndonos a través del correo de contacto. Eliminaremos tu
            información de nuestros sistemas salvo la que estemos obligados a conservar por ley
            (por ejemplo, registros de pagos).
          </p>
        </Section>

        <Section title="Contacto">
          <p>
            Si tienes preguntas sobre esta política o sobre tus datos, escríbenos a{' '}
            <a href="mailto:contacto@ergania.com" style={{ color: C.terra, fontWeight: 600 }}>
              contacto@ergania.com
            </a>.
          </p>
        </Section>
      </main>

      <footer style={{ background: C.brown, padding: '44px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: C.cream }}>ergania</span>
          <p style={{ fontFamily: sans, fontSize: 12, color: 'rgba(250,247,242,.30)' }}>
            Hecho en Chile · 2026
          </p>
        </div>
      </footer>
    </div>
  )
}
