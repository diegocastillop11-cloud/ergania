export type ArticleBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] }

export interface Article {
  slug: string
  title: string
  description: string
  publishedAt: string
  readingTimeMin: number
  body: ArticleBlock[]
  relatedFeature?: { label: string; href: string }
}

const CTA = { label: 'Prueba Ergania gratis por 3 días', href: '/login?tab=registro' }

export const ARTICLES: Article[] = [
  {
    slug: 'adaptar-cv-a-cada-oferta',
    title: 'Cómo adaptar tu CV a cada oferta sin reescribirlo desde cero',
    description: 'Adaptar el CV a cada postulación mejora tus chances, pero rehacerlo cada vez es agotador. Esta guía muestra qué cambiar realmente y qué dejar fijo.',
    publishedAt: '2026-07-14',
    readingTimeMin: 5,
    relatedFeature: CTA,
    body: [
      { type: 'p', text: 'La mayoría de las personas que buscan trabajo tienen un solo CV que envían a todas las ofertas por igual. El problema es que los reclutadores y los sistemas de filtrado automático (ATS) buscan coincidencias específicas con la oferta puntual, no una lista genérica de habilidades. Un CV "para todo" termina no destacando en nada.' },
      { type: 'h2', text: 'Qué sí conviene cambiar por oferta' },
      { type: 'p', text: 'No hace falta reescribir el documento entero. Lo que realmente mueve la aguja es ajustar tres cosas: el resumen profesional del encabezado (para que mencione el rol y la industria específica de la oferta), el orden de las habilidades técnicas (las que pide la oferta van primero, no al final), y la redacción de los logros de tus últimos cargos para que usen las mismas palabras clave que el aviso.' },
      { type: 'p', text: 'Por ejemplo, si postulas a un cargo de "Analista de Datos" y tu experiencia dice "generé reportes para el equipo comercial", conviene reescribirlo como "analicé datos comerciales y generé reportes para la toma de decisiones" — mismo hecho, pero ahora coincide con el lenguaje que probablemente usa el filtro automático de la empresa.' },
      { type: 'h2', text: 'Qué NO conviene cambiar' },
      { type: 'p', text: 'Tu historial laboral, fechas, estudios y datos de contacto deben mantenerse idénticos entre versiones. Cambiar esa información entre postulaciones genera inconsistencias que un reclutador puede notar si compara tu perfil de LinkedIn con el CV, o si te contacta después de varias semanas y el CV que tiene guardado ya no coincide con el que le enviaste.' },
      { type: 'h2', text: 'El costo real de hacerlo a mano' },
      { type: 'p', text: 'El problema no es saber qué cambiar — es el tiempo. Adaptar bien un CV a una oferta específica toma entre 20 y 40 minutos si lo haces con cuidado: leer la oferta completa, identificar las palabras clave, reescribir el resumen y los logros, y revisar que no queden errores. Si postulas a 10 ofertas por semana, eso son varias horas solo en edición de CV, antes de escribir una sola carta de presentación.' },
      { type: 'p', text: 'En Ergania, subes tu CV base una vez y por cada oferta que evalúas se genera una versión adaptada automáticamente, que después puedes seguir editando directo sobre el documento (no un formulario por campos) hasta que quede exactamente como quieres antes de descargarlo en PDF.' },
    ],
  },
  {
    slug: 'estimar-pretension-de-renta',
    title: 'Cómo estimar tu pretensión de renta antes de una entrevista',
    description: 'Llegar a la pregunta de renta sin un número claro juega en tu contra. Cómo investigar un rango realista antes de la entrevista, no durante.',
    publishedAt: '2026-07-16',
    readingTimeMin: 4,
    relatedFeature: CTA,
    body: [
      { type: 'p', text: 'Casi todas las entrevistas de trabajo en algún momento llegan a la pregunta: "¿cuál es tu pretensión de renta?". Responder con un número que no tiene respaldo — muy bajo o muy alto — puede costarte la oferta o dejar plata sobre la mesa. El error más común es no investigar nada antes y decidir el número en el momento, bajo presión.' },
      { type: 'h2', text: 'Por qué "lo que gano ahora más un poco" no funciona' },
      { type: 'p', text: 'Anclar tu pretensión solo a tu sueldo actual ignora factores importantes: si el nuevo cargo tiene más responsabilidad, si la empresa paga sobre o bajo el promedio de mercado para ese rol específico, y si el rubro o la región cambian el rango esperado. Un mismo cargo puede pagar montos muy distintos entre una startup y una empresa grande, o entre Santiago y una postulación remota para el extranjero.' },
      { type: 'h2', text: 'Cómo armar un rango con respaldo real' },
      { type: 'ul', items: [
        'Busca el rango de sueldo para ese cargo específico, en esa industria y ubicación — no un promedio genérico de "analista" o "desarrollador".',
        'Considera el tamaño de la empresa: las grandes suelen tener bandas salariales más rígidas; las más chicas negocian más pero a veces pagan menos.',
        'Si es un rol remoto para otro país, investiga el costo de vida y el estándar salarial de ese mercado, no el de Chile.',
        'Define un piso (el mínimo que aceptarías) y un techo (lo que pedirías si todo calza perfecto) — nunca des un solo número fijo si te lo permiten.',
      ] },
      { type: 'h2', text: 'El riesgo de improvisar' },
      { type: 'p', text: 'Sin este trabajo previo, es fácil caer en dos errores opuestos: pedir muy poco por miedo a perder la oportunidad (lo que además te deja mal posicionado para futuras negociaciones en la misma empresa), o pedir muy por sobre el mercado sin saberlo y quedar descartado antes de que evalúen el resto de tu perfil.' },
      { type: 'p', text: 'En Ergania, cuando evalúas una oferta específica, el sistema investiga en vivo el sueldo real de mercado para ese rol y esa empresa, y te entrega una estimación de renta líquida — no un promedio genérico, sino algo anclado a la oferta puntual que estás mirando. Ese mismo número queda disponible después en tu ficha de postulación, así no tienes que volver a investigarlo cuando llegue la entrevista.' },
    ],
  },
  {
    slug: 'guia-para-prepararte-para-una-entrevista',
    title: 'Guía paso a paso para prepararte para una entrevista de trabajo',
    description: 'Una estructura simple para llegar preparado a una entrevista: qué investigar antes, qué preguntas ensayar, y cómo cerrar bien.',
    publishedAt: '2026-07-18',
    readingTimeMin: 6,
    relatedFeature: CTA,
    body: [
      { type: 'p', text: 'Una entrevista mal preparada se nota casi de inmediato: respuestas genéricas, dudas al hablar de la empresa, y un cierre débil sin preguntas propias. La buena noticia es que la preparación efectiva no requiere memorizar guiones — requiere una estructura clara de qué revisar antes.' },
      { type: 'h2', text: '1. Investiga la empresa más allá de la web principal' },
      { type: 'p', text: 'No basta con leer la sección "Nosotros" del sitio. Busca noticias recientes de la empresa, su presencia en redes, y si es posible, comentarios de empleados actuales o anteriores. Esto te da contexto real para responder "¿por qué quieres trabajar aquí?" con algo específico en vez de una respuesta genérica que sirve para cualquier empresa.' },
      { type: 'h2', text: '2. Relee la oferta y anota coincidencias con tu experiencia' },
      { type: 'p', text: 'Antes de la entrevista, vuelve a leer el aviso de la oferta y anota, requisito por requisito, un ejemplo concreto de tu experiencia que lo respalde. Esto evita el momento incómodo de quedarte en blanco cuando te preguntan directamente por algo que la oferta pedía.' },
      { type: 'h2', text: '3. Prepara 3 a 5 historias, no respuestas sueltas' },
      { type: 'p', text: 'La mayoría de las preguntas de comportamiento ("cuéntame de un momento en que...") se pueden responder reciclando un número pequeño de historias bien estructuradas: la situación, qué hiciste específicamente, y el resultado medible. Prepara entre 3 y 5 historias de tu experiencia que cubran distintos temas — trabajo en equipo, manejo de conflicto, un logro cuantificable — y podrás adaptarlas a casi cualquier pregunta.' },
      { type: 'h2', text: '4. Ten preguntas propias listas, no improvisadas' },
      { type: 'ul', items: [
        '¿Cómo se ve el éxito en este rol a los 6 meses?',
        '¿Por qué está abierta esta posición — es un rol nuevo o hay rotación?',
        '¿Cómo es el proceso de evaluación de desempeño en el equipo?',
      ] },
      { type: 'p', text: 'No preguntar nada al final se lee como falta de interés real en el puesto. Dos o tres preguntas bien pensadas cierran mejor la entrevista que ninguna.' },
      { type: 'h2', text: '5. Revisa los detalles logísticos el día anterior' },
      { type: 'p', text: 'Confirma la hora considerando zona horaria si es remota, prueba la plataforma de videollamada con anticipación, y ten tu CV y la oferta a mano por si necesitas referenciarlos durante la conversación. Los imprevistos técnicos de último minuto restan mucho más de lo que parece.' },
      { type: 'p', text: 'Ergania te ayuda con varias de estas etapas: evalúa si conviene postular a una oferta antes de invertir tiempo en ella, y te entrega una estimación de renta para llegar con un número claro si llega la pregunta.' },
    ],
  },
  {
    slug: 'cv-en-ingles-vs-espanol',
    title: 'CV en inglés vs. CV en español: qué cambia realmente',
    description: 'No es solo traducir. El formato, el nivel de detalle y hasta la extensión esperada cambian según el idioma y el mercado al que postulas.',
    publishedAt: '2026-07-20',
    readingTimeMin: 5,
    relatedFeature: CTA,
    body: [
      { type: 'p', text: 'Un error común al postular a empleos en el extranjero es tomar el CV en español y traducirlo palabra por palabra al inglés. El resultado suele leerse forzado, y peor: ignora que las convenciones de formato y contenido esperadas cambian según el mercado, no solo el idioma.' },
      { type: 'h2', text: 'Extensión y nivel de detalle' },
      { type: 'p', text: 'En Chile es común ver CV de dos páginas con bastante detalle de cada cargo. En mercados como Estados Unidos, en cambio, se espera un CV de una página (salvo perfiles muy senior), con logros cuantificados en bullets cortos, no párrafos descriptivos. Un CV de dos páginas denso puede leerse como poco editado para ese mercado específico.' },
      { type: 'h2', text: 'Qué datos personales incluir o quitar' },
      { type: 'p', text: 'En Chile es habitual incluir fecha de nacimiento, estado civil o incluso una foto. En mercados como Estados Unidos o el Reino Unido, incluir esos datos puede generar rechazo automático por políticas internas de no discriminación en la selección — muchas empresas ni siquiera abren CVs con foto. Conviene adaptar esta sección según el país de la oferta, no mantenerla fija.' },
      { type: 'h2', text: 'El lenguaje de los logros cambia, no solo el idioma' },
      { type: 'p', text: 'Traducir "fui responsable de la gestión del equipo" a "I was responsible for team management" es gramaticalmente correcto pero suena pasivo en inglés. La convención en mercados angloparlantes es empezar cada logro con un verbo de acción fuerte y un resultado medible: "Led a team of 6 and reduced delivery time by 30%". No es un tema de vocabulario — es una convención de formato distinta.' },
      { type: 'h2', text: 'Mantén el idioma original cuando corresponda' },
      { type: 'p', text: 'Si tu CV original está en otro idioma y lo estás adaptando para una oferta en español, lo mismo aplica al revés: no todo lo que funciona en un mercado angloparlante se traduce bien a uno hispanohablante. El objetivo siempre es que el documento se lea como si hubiera sido escrito originalmente para ese mercado, no traducido.' },
      { type: 'p', text: 'Ergania detecta el idioma y el país real de cada oferta y adapta el CV, la carta de presentación y el resto de los documentos al formato esperado en ese mercado específico, en vez de aplicar una traducción literal del CV base.' },
    ],
  },
  {
    slug: 'optimizar-perfil-linkedin',
    title: 'Cómo optimizar tu perfil de LinkedIn para que te encuentren reclutadores',
    description: 'Los reclutadores buscan por palabras clave antes de leer un perfil completo. Qué secciones de LinkedIn conviene revisar primero.',
    publishedAt: '2026-07-21',
    readingTimeMin: 5,
    relatedFeature: CTA,
    body: [
      { type: 'p', text: 'Muchas personas activan la búsqueda de empleo solo postulando directamente a ofertas, sin considerar que buena parte del reclutamiento moderno funciona al revés: los reclutadores buscan candidatos activamente en LinkedIn usando palabras clave específicas antes de que exista una postulación formal. Si tu perfil no aparece en esas búsquedas, pierdes oportunidades que ni siquiera llegaste a ver.' },
      { type: 'h2', text: 'El titular importa más de lo que parece' },
      { type: 'p', text: 'El titular (headline) que aparece bajo tu nombre es uno de los campos más pesados para la búsqueda interna de LinkedIn. Un titular genérico como "Buscando nuevas oportunidades" no ayuda en nada — es mejor usar ese espacio para nombrar tu rol específico y 2-3 habilidades clave, por ejemplo "Analista de Datos | SQL, Python, Power BI".' },
      { type: 'h2', text: 'El extracto debe repetir las palabras clave de tu rol objetivo' },
      { type: 'p', text: 'La sección "Acerca de" no es solo una presentación personal — es contenido indexado por el buscador de LinkedIn. Si tu rol objetivo es "Product Manager", esa frase (y variantes cercanas) debería aparecer explícitamente en el extracto, no solo implícita en la descripción de tus funciones.' },
      { type: 'h2', text: 'Experiencia: logros medibles, no solo funciones' },
      { type: 'ul', items: [
        'Evita listar solo responsabilidades genéricas ("encargado de", "responsable de").',
        'Prioriza resultados cuantificables cuando existan: porcentajes, montos, tiempos reducidos.',
        'Usa el mismo vocabulario que aparece en las ofertas a las que quieres postular — si buscas roles de "Growth", usa esa palabra explícitamente.',
      ] },
      { type: 'h2', text: 'Habilidades: prioriza las que realmente buscan en tu rubro' },
      { type: 'p', text: 'LinkedIn permite listar muchas habilidades, pero las primeras 3 son las que más peso tienen en las búsquedas y las que se muestran de forma destacada. Revisa 3 a 5 ofertas reales del cargo que buscas y prioriza en tu perfil las habilidades que se repiten entre ellas, no las que crees que son más impresionantes.' },
      { type: 'p', text: 'Ergania analiza tu perfil de LinkedIn junto con tu CV y sugiere ajustes concretos de titular, extracto y habilidades para que calcen mejor con los roles a los que apuntas — el resultado queda guardado en tu perfil, no se pierde entre sesiones.' },
    ],
  },
  {
    slug: 'errores-postular-trabajo-remoto-internacional',
    title: 'Errores comunes al postular a trabajos remotos internacionales',
    description: 'Postular a ofertas remotas fuera de tu país tiene reglas distintas a postular localmente. Los errores más frecuentes y cómo evitarlos.',
    publishedAt: '2026-07-22',
    readingTimeMin: 5,
    relatedFeature: CTA,
    body: [
      { type: 'p', text: 'El trabajo remoto internacional abrió muchas oportunidades para profesionales chilenos y latinoamericanos, pero postular a esas ofertas no funciona igual que postular a un empleo local. Estos son los errores que más se repiten.' },
      { type: 'h2', text: 'No ajustar la zona horaria en la comunicación' },
      { type: 'p', text: 'Si postulas a una empresa con sede en Estados Unidos o Europa, mencionar tu disponibilidad horaria en tu propia zona horaria sin aclarar el equivalente en la de ellos genera fricción innecesaria. Es mejor indicar explícitamente el rango de superposición horaria real, por ejemplo "disponible de 9 a 13 hora de Nueva York".' },
      { type: 'h2', text: 'No mencionar tu situación de residencia y permiso de trabajo' },
      { type: 'p', text: 'Muchas empresas que contratan remoto internacional tienen restricciones legales sobre en qué países pueden contratar, por temas de impuestos y legislación laboral. No aclarar desde el inicio que buscas un contrato como contratista independiente (o la modalidad que corresponda) puede hacer que te descarten más adelante en el proceso, después de haber invertido tiempo en varias entrevistas.' },
      { type: 'h2', text: 'Ignorar las diferencias de formato de CV según el país de la empresa' },
      { type: 'p', text: 'Como se explica en detalle en nuestra guía de CV en inglés vs. español, cada mercado tiene convenciones distintas de extensión, formato y qué datos personales incluir. Enviar el mismo CV que usarías para una oferta local a una empresa extranjera suele notarse como poco adaptado.' },
      { type: 'h2', text: 'No investigar el estándar salarial real de ese mercado' },
      { type: 'ul', items: [
        'El costo de vida y el estándar de sueldos varía mucho entre países — no ancles tu pretensión a lo que ganarías en Chile.',
        'Revisa si la oferta paga en tu moneda local o en la de la empresa, y qué implica eso para tu planificación.',
        'Considera si el pago es vía plataformas internacionales y qué comisiones o impuestos aplican en tu caso.',
      ] },
      { type: 'h2', text: 'Subestimar el filtro de comunicación escrita' },
      { type: 'p', text: 'En procesos remotos, gran parte de la evaluación pasa por cómo te comunicas por escrito — correos, mensajes, la propia postulación. Errores de redacción o respuestas muy informales pesan más en remoto que en un proceso presencial, porque es la principal señal que tiene el reclutador de cómo trabajarás a distancia.' },
      { type: 'p', text: 'Ergania incluye portales de trabajo remoto internacional organizados por región (Estados Unidos, España, LATAM, remoto global) y adapta automáticamente el idioma y el formato de tus documentos al país real de cada oferta específica.' },
    ],
  },
  {
    slug: 'ordenar-tus-postulaciones-sin-perder-el-hilo',
    title: 'Cómo ordenar tus postulaciones sin perder el hilo',
    description: 'Postular a varias empresas a la vez sin un sistema de seguimiento termina en confusión. Una forma simple de mantener el orden.',
    publishedAt: '2026-07-23',
    readingTimeMin: 4,
    relatedFeature: CTA,
    body: [
      { type: 'p', text: 'Buscar trabajo activamente casi siempre implica tener varias postulaciones abiertas al mismo tiempo, en distintas etapas: algunas recién enviadas, otras esperando respuesta, otras ya en entrevistas. Sin un sistema para llevar el registro, es fácil perder el hilo — olvidar hacer seguimiento a tiempo, confundir qué versión de CV enviaste a cada empresa, o llegar a una segunda entrevista sin recordar bien qué se habló en la primera.' },
      { type: 'h2', text: 'Por qué una lista de correos no alcanza' },
      { type: 'p', text: 'Revisar tu bandeja de entrada para reconstruir el estado de cada postulación funciona al principio, pero se vuelve inmanejable rápido cuando tienes más de 5 o 6 procesos activos. Además, la bandeja de entrada no te dice en qué etapa está cada proceso ni cuándo fue el último contacto — solo muestra correos sueltos en orden cronológico.' },
      { type: 'h2', text: 'Qué información conviene registrar por postulación' },
      { type: 'ul', items: [
        'Empresa, cargo y fecha de la postulación',
        'Etapa actual: enviado, en revisión, entrevista, oferta, descartado',
        'Qué versión de CV y carta enviaste (importante si adaptas el CV por oferta)',
        'Notas de cada entrevista, mientras están frescas',
        'La pretensión de renta que evaluaste para esa oferta específica',
      ] },
      { type: 'h2', text: 'El seguimiento a tiempo importa tanto como la postulación misma' },
      { type: 'p', text: 'Muchos procesos se pierden no porque el candidato no calificara, sino porque nadie hizo seguimiento cuando el proceso quedó en silencio. Tener a la vista en qué fecha corresponde volver a escribir a cada empresa evita que una oportunidad real se enfríe solo por falta de registro.' },
      { type: 'p', text: 'Ergania centraliza esto en un tablero de seguimiento (Tracker y Pipeline) donde cada postulación queda con su etapa, la evaluación de la oferta, la pretensión de renta calculada y el historial completo — sin depender de tu memoria ni de revisar correos antiguos.' },
    ],
  },
  {
    slug: 'portales-trabajo-remoto-chile',
    title: 'Portales de trabajo remoto en Chile: cuáles usar y cómo filtrar ofertas reales',
    description: 'No todos los portales de empleo tienen la misma calidad de ofertas remotas. Guía de dónde buscar y cómo evitar publicaciones vencidas o falsas.',
    publishedAt: '2026-07-24',
    readingTimeMin: 5,
    relatedFeature: CTA,
    body: [
      { type: 'p', text: 'Buscar trabajo remoto en Chile implica revisar varios portales a la vez, porque ninguno concentra todas las ofertas reales del mercado. El problema no es solo encontrar ofertas — es distinguir cuáles siguen vigentes y cuáles son publicaciones antiguas que el portal nunca dio de baja.' },
      { type: 'h2', text: 'Los portales más usados en Chile' },
      { type: 'p', text: 'GetOnBoard se especializa en roles de tecnología y suele tener ofertas remotas de buena calidad para el ecosistema startup. LinkedIn cubre prácticamente todos los rubros pero requiere filtrar bien porque mezcla ofertas directas con publicaciones de terceros. Indeed, Computrabajo, Bumeran, Laborum y Trabajando.cl tienen alto volumen pero varían mucho en qué tan actualizadas mantienen sus publicaciones.' },
      { type: 'h2', text: 'Cómo detectar una oferta vencida antes de perder tiempo' },
      { type: 'ul', items: [
        'Revisa la fecha de publicación — si tiene más de 30 días y no dice "urgente" o similar, es señal de alerta.',
        'Busca el nombre de la empresa y el cargo en LinkedIn para ver si ya cerraron el proceso o siguen publicando el mismo aviso hace meses.',
        'Desconfía de ofertas sin nombre de empresa visible ("empresa confidencial") combinadas con rangos de renta poco realistas.',
        'Si el portal no muestra cuántas personas ya postularon, prioriza portales que sí lo hacen — te da una señal de qué tan activa está la oferta.',
      ] },
      { type: 'h2', text: 'Filtrar por remoto real, no solo por la etiqueta' },
      { type: 'p', text: 'Algunas ofertas se etiquetan como "remoto" pero en la descripción piden presencialidad parcial u ocasional en oficina, lo que en la práctica es un modelo híbrido. Vale la pena leer la descripción completa antes de asumir que el filtro del portal es exacto — no todos los portales validan bien esa etiqueta.' },
      { type: 'h2', text: 'Revisar varios portales a mano toma tiempo real' },
      { type: 'p', text: 'Cruzar manualmente 7 portales distintos, filtrando por remoto y descartando publicaciones vencidas, es un trabajo que fácilmente consume más de una hora diaria si se hace bien. La mayoría de las personas termina revisando solo uno o dos portales por cansancio, y se pierde ofertas reales que estaban en los que no alcanzaron a mirar.' },
      { type: 'p', text: 'El Escáner de Ergania revisa estos portales por ti y aplica el filtro de Chile/remoto sobre los resultados ya encontrados, para que no tengas que repetir esa búsqueda manual todos los días.' },
    ],
  },
]

export function getArticleBySlug(slug: string): Article | undefined {
  return ARTICLES.find(a => a.slug === slug)
}
