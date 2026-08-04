import LegalLayout, { Section, C, blue2Link } from '../components/legal/LegalLayout'

export default function Terms() {
  return (
    <LegalLayout
      title="Términos y Condiciones"
      updated="4 de agosto de 2026"
      otherPage={{ to: '/privacidad', label: 'Política de Privacidad' }}
    >
      <p style={{ fontFamily: "'Source Sans Pro', -apple-system, 'Segoe UI', Arial, sans-serif", fontSize: 15.5, lineHeight: 1.7, color: C.inkSub, marginBottom: 36 }}>
        Estos Términos y Condiciones ("Términos") regulan el uso de la plataforma Ergania
        (ergania.com y la aplicación asociada, el "Servicio"), operada desde Chile. Al crear una
        cuenta o usar el Servicio aceptas íntegramente estos Términos. Si no estás de acuerdo, no
        debes usar Ergania.
      </p>

      <Section title="1. Descripción del servicio">
        <p>
          Ergania es una herramienta de apoyo a la búsqueda de empleo: generación y edición de
          CVs y cartas de presentación, evaluación de ofertas laborales, escaneo de portales de
          empleo, seguimiento de postulaciones y funciones asistidas por inteligencia artificial
          relacionadas. Ergania no es un portal de empleo, no garantiza la obtención de trabajo ni
          actúa como intermediario laboral, y no tiene relación contractual con los empleadores u
          ofertas que se muestran en la plataforma.
        </p>
      </Section>

      <Section title="2. Cuentas de usuario">
        <p style={{ marginBottom: 12 }}>
          Debes registrarte con datos verídicos y tener capacidad legal para contratar. Eres
          responsable de mantener la confidencialidad de tus credenciales y de toda actividad
          realizada desde tu cuenta.
        </p>
        <p>
          Nos reservamos el derecho de suspender o cerrar cuentas que incumplan estos Términos,
          que se usen de forma fraudulenta, o que pongan en riesgo la seguridad o el
          funcionamiento del Servicio.
        </p>
      </Section>

      <Section title="3. Período de prueba y suscripción">
        <p style={{ marginBottom: 12 }}>
          Ergania ofrece un período de prueba gratuito de 3 días con acceso a las funciones del
          Servicio, sin necesidad de pago. Al finalizar el período de prueba, el acceso completo
          requiere una suscripción paga, mensual y renovable, cuyo precio y medios de pago
          vigentes (MercadoPago, PayPal u otros que se habiliten) se muestran en la sección
          "Suscripción" de la plataforma antes de confirmar el pago.
        </p>
        <p style={{ marginBottom: 12 }}>
          <strong style={{ color: C.ink }}>La suscripción es enteramente opcional.</strong> Puedes
          usar el período de prueba sin costo y decidir libremente si contratas o no la
          suscripción paga una vez finalizado. Nadie te cobra automáticamente sin que hayas
          completado voluntariamente el proceso de pago con el proveedor correspondiente.
        </p>
        <p>
          La suscripción se renueva automáticamente al final de cada período según el medio de
          pago elegido (cobro recurrente en PayPal; pago manual recordado por la plataforma en
          MercadoPago), salvo que la canceles antes de la fecha de renovación desde tu cuenta.
        </p>
      </Section>

      <Section title="4. Política de pagos, cancelación y derecho a retracto">
        <p style={{ marginBottom: 12 }}>
          Ergania no almacena datos de tarjetas ni medios de pago: el pago se procesa
          directamente por MercadoPago o PayPal, conforme a sus propios términos.
        </p>
        <p style={{ marginBottom: 12 }}>
          Puedes cancelar tu suscripción en cualquier momento desde la sección "Suscripción".
          La cancelación detiene la renovación futura, pero el acceso pagado se mantiene activo
          hasta el final del período ya pagado — no se realizan devoluciones proporcionales por
          el tiempo no utilizado dentro de un período ya iniciado.
        </p>
        <p style={{ marginBottom: 12 }}>
          De acuerdo con el artículo 3° bis de la Ley N° 19.496 sobre Protección de los Derechos
          de los Consumidores, el suministro de contenidos o servicios digitales que no se
          prestan en un soporte material está excluido del derecho a retracto cuando la
          ejecución del servicio se ha iniciado con el consentimiento previo y expreso del
          consumidor, y este reconoce que en tal caso pierde su derecho a retracto. Al confirmar
          el pago de tu suscripción, el Servicio te otorga acceso inmediato y completo a las
          funciones pagas de la plataforma; por lo tanto, y previo a la confirmación del pago, se
          te solicitará expresamente tu consentimiento para el inicio inmediato del servicio y tu
          reconocimiento de que renuncias a tu derecho a retracto respecto de esa suscripción.
        </p>
        <p>
          Fuera de esa exclusión legal, y salvo error de cobro, cobro duplicado, o falla
          comprobable del Servicio no resuelta, las sumas pagadas por períodos de suscripción ya
          iniciados no son reembolsables. Si consideras que hubo un error de cobro, escríbenos a{' '}
          <a href="mailto:contacto@ergania.com" style={blue2Link}>contacto@ergania.com</a> y
          evaluaremos tu caso.
        </p>
      </Section>

      <Section title="5. Uso aceptable">
        <p style={{ marginBottom: 12 }}>Al usar Ergania te comprometes a no:</p>
        <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <li>Usar el Servicio para fines ilegales o para generar contenido falso, difamatorio o que suplante la identidad de un tercero.</li>
          <li>Intentar acceder sin autorización a cuentas, sistemas o datos de otros usuarios.</li>
          <li>Realizar scraping, ingeniería inversa o extracción masiva automatizada del Servicio o de su contenido.</li>
          <li>Sobrecargar deliberadamente la infraestructura del Servicio o interferir con su funcionamiento normal.</li>
          <li>Revender, sublicenciar o redistribuir el acceso al Servicio sin autorización previa por escrito.</li>
        </ul>
      </Section>

      <Section title="6. Propiedad intelectual">
        <p style={{ marginBottom: 12 }}>
          Ergania y sus elementos (marca, diseño, código, textos de la plataforma) son propiedad
          de Ergania o de sus licenciantes y están protegidos por la legislación de propiedad
          intelectual aplicable. Estos Términos no te otorgan ningún derecho sobre ellos más allá
          del uso del Servicio conforme a lo aquí descrito.
        </p>
        <p>
          El contenido que subes o generas con tu cuenta (tu CV, cartas, datos de perfil) sigue
          siendo tuyo. Nos otorgas una licencia limitada para procesarlo y almacenarlo con el
          único fin de prestarte el Servicio.
        </p>
      </Section>

      <Section title="7. Contenido generado con inteligencia artificial">
        <p>
          Las funciones de Ergania que usan inteligencia artificial (generación y edición de CVs,
          cartas, evaluación de ofertas, estimaciones de renta, sugerencias de cargos, entre
          otras) producen resultados automatizados que pueden contener errores, imprecisiones u
          omisiones. Eres responsable de revisar y validar cualquier contenido generado antes de
          usarlo — por ejemplo, antes de enviarlo a un empleador o de tomar una decisión basada en
          él. Ergania no garantiza la exactitud, vigencia ni idoneidad de dicho contenido para un
          fin específico.
        </p>
      </Section>

      <Section title="8. Contenido e información de terceros">
        <p>
          Ergania muestra y procesa información pública proveniente de portales de empleo
          operados por terceros (LinkedIn, Indeed, GetOnBoard, Computrabajo, Bumeran, Laborum,
          Trabajando.cl, entre otros) y de ofertas que el propio usuario incorpora o solicita
          evaluar. Esa información es de propiedad de sus respectivas fuentes; Ergania no la
          verifica ni garantiza, y no es responsable de su exactitud, vigencia o legalidad. El
          detalle de esta limitación de responsabilidad está también en nuestra{' '}
          <a href="/privacidad" style={blue2Link}>Política de Privacidad</a>.
        </p>
      </Section>

      <Section title="9. Disponibilidad y modificaciones del servicio">
        <p>
          Trabajamos para mantener Ergania disponible de forma continua, pero no garantizamos
          operación ininterrumpida o libre de errores — puede haber mantenimientos, caídas de
          proveedores externos (Supabase, Anthropic, MercadoPago, PayPal) u otras interrupciones
          fuera de nuestro control. Podemos modificar, agregar o discontinuar funciones del
          Servicio en cualquier momento; si una función paga se discontinúa de forma permanente,
          lo comunicaremos con antelación razonable.
        </p>
      </Section>

      <Section title="10. Limitación de responsabilidad">
        <p style={{ marginBottom: 12 }}>
          En la máxima medida permitida por la ley, Ergania se presta "tal cual" y "según
          disponibilidad", sin garantías de ningún tipo, expresas o implícitas. Ergania no
          garantiza que el uso del Servicio resulte en la obtención de una oferta o empleo.
        </p>
        <p>
          En la máxima medida permitida por la ley, Ergania no será responsable por daños
          indirectos, incidentales, especiales o consecuenciales derivados del uso o
          imposibilidad de uso del Servicio. Cuando la ley permita limitar la responsabilidad
          contractual, la responsabilidad total de Ergania frente a un usuario se limita al monto
          efectivamente pagado por ese usuario en los últimos 12 meses. Nada en esta cláusula
          limita derechos irrenunciables que la Ley N° 19.496 reconoce a los consumidores en
          Chile.
        </p>
      </Section>

      <Section title="11. Terminación">
        <p>
          Puedes dejar de usar Ergania y solicitar el cierre de tu cuenta en cualquier momento.
          Podemos suspender o terminar tu acceso si incumples estos Términos, sin perjuicio de
          las obligaciones de pago ya devengadas hasta la fecha de terminación.
        </p>
      </Section>

      <Section title="12. Cambios a estos Términos">
        <p>
          Podemos actualizar estos Términos para reflejar cambios en el Servicio o en la
          normativa aplicable. Publicaremos la nueva versión en esta página indicando la fecha de
          última actualización. Si los cambios son sustanciales, procuraremos avisarte por correo
          o dentro de la plataforma. El uso continuado de Ergania después de un cambio implica tu
          aceptación de los Términos vigentes.
        </p>
      </Section>

      <Section title="13. Ley aplicable y jurisdicción">
        <p>
          Estos Términos se rigen por las leyes de la República de Chile. Para cualquier
          controversia que no se resuelva directamente entre las partes, las partes se someten a
          la jurisdicción de los tribunales ordinarios de Chile, sin perjuicio de los derechos que
          asisten a los consumidores para recurrir al Servicio Nacional del Consumidor (SERNAC)
          conforme a la Ley N° 19.496.
        </p>
      </Section>

      <Section title="14. Contacto">
        <p>
          Si tienes preguntas sobre estos Términos, escríbenos a{' '}
          <a href="mailto:contacto@ergania.com" style={blue2Link}>contacto@ergania.com</a>.
        </p>
      </Section>
    </LegalLayout>
  )
}
