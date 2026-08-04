import LegalLayout, { Section, C, blue2Link } from '../components/legal/LegalLayout'

export default function Privacy() {
  return (
    <LegalLayout
      title="Política de Privacidad"
      updated="4 de agosto de 2026"
      otherPage={{ to: '/terminos', label: 'Términos y Condiciones' }}
    >
      <Section title="Qué datos recopilamos">
        <p style={{ marginBottom: 12 }}>
          Cuando creas una cuenta en Ergania recopilamos tu correo electrónico y nombre. Al usar
          la plataforma nos entregas además datos de tu perfil profesional: tu CV, experiencia
          laboral, estudios, y opcionalmente tu perfil de LinkedIn — información que tú mismo
          subes o completas para que podamos generar CVs, cartas de presentación y
          recomendaciones adaptadas a ti.
        </p>
        <p>
          Si contratas una suscripción, el pago se procesa directamente por MercadoPago o PayPal.
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
          <li><strong style={{ color: C.ink }}>Supabase</strong> — autenticación y almacenamiento de tu cuenta y datos de perfil.</li>
          <li><strong style={{ color: C.ink }}>Anthropic (Claude)</strong> — procesamiento de IA sobre tu CV y perfil.</li>
          <li><strong style={{ color: C.ink }}>MercadoPago y PayPal</strong> — procesamiento de pagos de tu suscripción.</li>
          <li><strong style={{ color: C.ink }}>Google AdSense</strong> — muestra anuncios en la sección de Recursos del sitio para financiar el servicio (ver sección de Cookies abajo).</li>
        </ul>
      </Section>

      <Section title="Cuánto tiempo conservamos tus datos">
        <p>
          Conservamos tu información mientras tu cuenta esté activa. Si eliminas tu cuenta,
          borramos tus datos personales y de perfil de nuestros sistemas dentro de un plazo
          razonable, salvo la información que estemos legalmente obligados a conservar por más
          tiempo — por ejemplo, registros de transacciones y pagos, exigidos por normativa
          tributaria y de protección al consumidor.
        </p>
      </Section>

      <Section title="Cookies y publicidad">
        <p style={{ marginBottom: 12 }}>
          La sección de Recursos de ergania.com (ergania.com/recursos) usa Google AdSense para mostrar anuncios.
          Google y sus socios publicitarios pueden usar cookies y tecnologías similares para
          mostrar anuncios en base a tus visitas a este y otros sitios, y para medir su
          rendimiento.
        </p>
        <p>
          Puedes revisar y ajustar la personalización de anuncios de Google en{' '}
          <a href="https://myadcenter.google.com/personalizationoff" target="_blank" rel="noopener noreferrer" style={blue2Link}>
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

      <Section title="Menores de edad">
        <p>
          Ergania está dirigido a personas en edad legal para trabajar. No recopilamos a
          sabiendas datos de menores de 18 años. Si tomamos conocimiento de que un menor nos ha
          entregado datos personales sin la autorización correspondiente, eliminaremos esa
          información.
        </p>
      </Section>

      <Section title="Tus derechos">
        <p style={{ marginBottom: 12 }}>
          Puedes pedirnos acceder, rectificar, cancelar u oponerte al uso de tus datos personales
          (derechos ARCO), o cerrar tu cuenta por completo, escribiéndonos a través del correo de
          contacto. Eliminaremos tu información de nuestros sistemas salvo la que estemos
          obligados a conservar por ley (por ejemplo, registros de pagos).
        </p>
        <p>
          A partir del 1 de diciembre de 2026 rige en Chile la Ley N° 21.719 de Protección de
          Datos Personales, que refuerza estos derechos y crea la Agencia de Protección de Datos
          Personales como organismo fiscalizador. Adoptamos estas prácticas de manera anticipada
          para cumplir con dicha normativa desde su entrada en vigencia.
        </p>
      </Section>

      <Section title="Seguridad">
        <p>
          Aplicamos medidas técnicas y organizativas razonables para proteger tu información
          (autenticación, cifrado en tránsito, control de acceso a través de Supabase). Ningún
          sistema es 100% infalible; si detectamos una brecha de seguridad que afecte tus datos
          personales, te lo notificaremos conforme a la normativa aplicable.
        </p>
      </Section>

      <Section title="Cambios a esta política">
        <p>
          Podemos actualizar esta Política de Privacidad para reflejar cambios en el servicio o
          en la normativa aplicable. Publicaremos la nueva versión en esta misma página indicando
          la fecha de última actualización. El uso continuado de Ergania después de un cambio
          implica tu aceptación de la política vigente.
        </p>
      </Section>

      <Section title="Contacto">
        <p>
          Si tienes preguntas sobre esta política o sobre tus datos, escríbenos a{' '}
          <a href="mailto:contacto@ergania.com" style={blue2Link}>
            contacto@ergania.com
          </a>.
        </p>
      </Section>
    </LegalLayout>
  )
}
