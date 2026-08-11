import { Link } from 'react-router-dom'
import PublicPage, { Block } from '../components/public/PublicPage'
import { C, blue2Link } from '../components/legal/LegalLayout'
import { useDocumentMeta } from '../lib/useDocumentMeta'

export const TITLE = 'Sobre Ergania — quiénes somos y qué hacemos'
export const DESCRIPTION =
  'Ergania es una plataforma chilena que usa inteligencia artificial para acompañar la búsqueda de trabajo: adaptar el CV a cada oferta, estimar la renta de mercado y ordenar las postulaciones.'

const INTRO =
  'Ergania es una plataforma chilena de búsqueda de empleo asistida por inteligencia artificial. Nació de un problema concreto: postular bien a un trabajo toma horas por cada oferta, y casi nadie tiene esas horas mientras trabaja o mientras la cesantía aprieta.'

export default function Nosotros() {
  useDocumentMeta(TITLE, DESCRIPTION)

  return (
    <PublicPage title="Sobre Ergania" intro={INTRO}>
      <Block title="El problema que atacamos">
        <p style={{ marginBottom: 16 }}>
          Adaptar un CV a una oferta específica, escribir una carta de presentación coherente,
          averiguar cuánto paga realmente ese cargo en el mercado y no perder el hilo de a qué
          empresas ya postulaste: cada una de esas tareas es razonable por separado, pero juntas
          consumen entre 30 y 60 minutos por postulación. Multiplicado por diez ofertas a la
          semana, la búsqueda de trabajo se convierte en un segundo empleo no remunerado.
        </p>
        <p>
          El resultado habitual es que la gente termina enviando el mismo CV genérico a todas
          partes, que es exactamente lo que los filtros automáticos de las empresas descartan
          primero.
        </p>
      </Block>

      <Block title="Qué hace la plataforma">
        <p style={{ marginBottom: 16 }}>
          Ergania no postula por ti ni promete resultados. Lo que hace es sacarte de encima el
          trabajo mecánico para que llegues mejor preparado a las etapas que sí dependen de ti:
        </p>
        <ul style={{ margin: '0 0 16px', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <li>Busca ofertas en los principales portales de empleo y las reúne en un solo lugar.</li>
          <li>Evalúa qué tan bien calza tu perfil con una oferta puntual, con sus fortalezas y brechas.</li>
          <li>Genera una versión de tu CV adaptada a esa oferta, que después puedes editar tú mismo.</li>
          <li>Estima la renta líquida de mercado del cargo, investigando la oferta concreta y no un promedio genérico.</li>
          <li>Prepara una guía de entrevista con investigación de la empresa.</li>
          <li>Ordena todas tus postulaciones y en qué etapa va cada una.</li>
        </ul>
        <p>
          Funciona en español y se adapta al idioma y al país de la oferta, para que también sirva
          si postulas a un cargo remoto fuera de Chile.
        </p>
      </Block>

      <Block title="Quiénes estamos detrás">
        <p>
          Somos un equipo pequeño en Chile. Construimos Ergania porque vivimos de cerca lo agotador
          que es buscar trabajo con las herramientas actuales, y porque creemos que la asistencia de
          IA en este terreno tiene que ser honesta: ayudarte a presentar mejor lo que realmente
          hiciste, nunca a inventar experiencia que no tienes.
        </p>
      </Block>

      <Block title="Cómo nos financiamos">
        <p style={{ marginBottom: 16 }}>
          Ergania se sostiene con una suscripción mensual de pago, con una prueba gratuita de 3 días
          al registrarte. No vendemos tus datos personales ni tu CV a terceros; puedes revisar el
          detalle en nuestra{' '}
          <Link to="/privacidad" style={blue2Link}>Política de Privacidad</Link> y en los{' '}
          <Link to="/terminos" style={blue2Link}>Términos y Condiciones</Link>.
        </p>
        <p>
          En la sección de <Link to="/recursos" style={blue2Link}>Recursos</Link> publicamos guías
          abiertas sobre búsqueda laboral, de acceso libre y sin necesidad de tener una cuenta. Esas
          páginas pueden incluir publicidad de terceros, que se muestra siempre identificada como
          tal y separada del contenido editorial.
        </p>
      </Block>

      <Block title="Hablar con nosotros">
        <p>
          Puedes escribirnos desde la{' '}
          <Link to="/contacto" style={blue2Link}>página de contacto</Link> o directamente a{' '}
          <a href="mailto:contacto@ergania.com" style={{ ...blue2Link, textDecoration: 'none' }}>
            contacto@ergania.com
          </a>
          . Leemos todo lo que llega, incluidos los reclamos.
        </p>
      </Block>

      <div style={{
        marginTop: 8, padding: '24px 26px', borderRadius: 14,
        background: 'linear-gradient(160deg, rgba(96,165,250,.14), rgba(167,139,250,.14)), #12142F',
        border: `1px solid ${C.line}`, textAlign: 'center',
      }}>
        <p style={{ fontSize: 14.5, color: C.inkSub, marginBottom: 14 }}>
          Puedes probar la plataforma completa durante 3 días, sin costo.
        </p>
        <Link
          to="/login?tab=registro"
          style={{
            background: C.blue2, color: '#05070F', border: 'none', borderRadius: 9,
            padding: '12px 24px', fontSize: 15, fontWeight: 700,
            textDecoration: 'none', display: 'inline-block',
          }}
        >
          Crear una cuenta
        </Link>
      </div>
    </PublicPage>
  )
}
