// Tipos de entrevista y cómo cada uno cambia la guía.
//
// El campo `interviewMeta.tipo` existía desde la migración 029 pero era texto libre y solo
// llegaba al prompt junto a la fecha y el link, bajo la instrucción de "úsalo para el checklist
// logístico". El resultado: la guía salía con la misma forma (6 típicas, 4 técnicas, 5
// escenarios) fuera a un screening de RRHH de 20 minutos o a una entrevista técnica. Un
// candidato que iba a la primera recibía 4 preguntas técnicas que nadie le iba a hacer, y no
// recibía la respuesta a "¿cuál es tu expectativa de renta?", que es la que decide si avanza.
//
// Ahora el tipo redefine las cuotas y el foco del contenido. No hay columna ni endpoint nuevo:
// sigue siendo `meta.tipo`, solo que guarda una de estas claves. Los valores viejos de texto
// libre siguen funcionando (caen en `null` y la guía se genera con el reparto mixto de antes).

export type InterviewTypeKey = 'rrhh' | 'tecnica' | 'gerente' | 'psicolaboral' | 'panel'

export interface InterviewTypeConfig {
  key: InterviewTypeKey
  label: string
  labelEn: string
  /** Reemplaza el párrafo de "Cantidades:" del prompt. */
  cuotas: string
  /** Qué se juega en esta entrevista: orienta el contenido, no solo el número de items. */
  foco: string
}

const TYPES: InterviewTypeConfig[] = [
  {
    key: 'rrhh',
    label: 'RRHH / Screening',
    labelEn: 'HR / Screening',
    cuotas: '6 fit, 10 preguntas típicas, 0 técnicas, 5 para ellos, 3 escenarios, 5 fortalezas, 5 debilidades, 6 items de checklist mental, 5 de logística, 5 de "no hacer"',
    foco: `Es la primera etapa de filtro, con alguien de RRHH o un reclutador externo — típicamente 20 a 40
minutos. NO se evalúa capacidad técnica: se evalúa si la historia laboral cierra, si la motivación es
creíble, si la expectativa de renta cabe en el presupuesto y si la disponibilidad calza. Por eso
"tecnicas" va vacío: no inventes preguntas técnicas que no le van a hacer.

Entre las preguntas típicas TIENEN que estar, sí o sí, estas cuatro:
- La expectativa de renta.
- Por qué salió (o quiere salir) de su trabajo actual o del último.
- Su disponibilidad para entrar y, si aplica, para el formato de trabajo que pide el aviso.
- Qué sabe de la empresa y por qué le interesa esta en particular.

Los 3 escenarios son de manejo de la conversación, no de trabajo: cómo responder si le apuntan a un
vacío en el CV, a un cambio de rubro, o a un sueldo anterior más alto o más bajo que el del cargo.`,
  },
  {
    key: 'tecnica',
    label: 'Técnica',
    labelEn: 'Technical',
    cuotas: '6 fit, 3 preguntas típicas, 8 técnicas, 5 para ellos, 5 escenarios, 5 fortalezas, 5 debilidades, 6 items de checklist mental, 5 de logística, 5 de "no hacer"',
    foco: `Acá se evalúa capacidad demostrable, normalmente con alguien que hace el mismo trabajo. Las 8
preguntas técnicas tienen que ser de las herramientas, procesos o conocimientos que el aviso nombra
explícitamente — nada de teoría genérica del rubro. Ancla cada respuesta en algo que el candidato ya
hizo, con el nombre de la herramienta y del proyecto.

Los 5 escenarios son ejercicios o casos prácticos del día a día del cargo, del tipo que le podrían
pedir resolver en voz alta o en un ejercicio en vivo.

En el checklist mental incluye qué hacer cuando no sabe la respuesta: pensar en voz alta, decir qué
sabe y hasta dónde llega, y cómo lo averiguaría — es mejor evaluado que inventar o quedarse callado.`,
  },
  {
    key: 'gerente',
    label: 'Con el jefe directo o gerente',
    labelEn: 'Hiring manager',
    cuotas: '6 fit, 6 preguntas típicas, 2 técnicas, 6 para ellos, 6 escenarios, 5 fortalezas, 5 debilidades, 6 items de checklist mental, 5 de logística, 5 de "no hacer"',
    foco: `Es con quien va a ser su jefe o con el gerente del área: acá se juega el criterio y el encaje con el
equipo, no el conocimiento de manual. Las preguntas y los 6 escenarios apuntan a cómo decide: qué
haría en sus primeros 90 días en el cargo, cómo prioriza cuando todo es urgente, cómo maneja un
desacuerdo con un par o con su jefatura, qué hace cuando le falta información para decidir, y cómo
prefiere que le hagan seguimiento.

Las 6 preguntas "paraEllos" son las de mayor peso de toda la guía: qué define que a alguien le fue
bien en este cargo a los 6 meses, cómo está compuesto el equipo hoy, qué es lo primero que
necesita resuelto. Preguntas de alguien que ya se está imaginando adentro.`,
  },
  {
    key: 'psicolaboral',
    label: 'Psicolaboral',
    labelEn: 'Psychological assessment',
    cuotas: '6 fit, 8 preguntas típicas, 0 técnicas, 4 para ellos, 5 escenarios, 5 fortalezas, 5 debilidades, 6 items de checklist mental, 5 de logística, 5 de "no hacer"',
    foco: `Es una evaluación con un psicólogo o psicóloga laboral, y puede incluir una batería de tests.

REGLA INNEGOCIABLE: no expliques cómo "pasar" ni cómo puntuar alto en ningún test psicométrico o
proyectivo. No sugieras qué dibujar, qué color elegir, ni qué alternativa marcar en ningún
instrumento. Esos tests están diseñados para no prepararse, y darle una receta al candidato lo
perjudica: una respuesta ensayada se detecta y contradice lo que ya dijo en las otras etapas. Si te
sientes tentado a dar ese tipo de consejo, no lo des.

Lo que SÍ entregas: en el checklist mental, qué esperar de la sesión — que suele haber una entrevista
biográfica en profundidad y, según la consultora, algún instrumento escrito o de dibujo — para que
llegue sin sorpresas y descansado, no para prepararle una respuesta. Menciona los instrumentos que se
usan habitualmente en el país solo por su nombre, para que los reconozca; nunca cómo se puntúan.

Las 8 preguntas típicas son biográficas y conductuales profundas: un fracaso o error propio y qué
hizo después, un conflicto con alguien del equipo, cómo reacciona bajo presión, cómo se lleva con la
autoridad y con las críticas, qué lo frustra. Cada respuesta anclada en algo que de verdad vivió y
que ya aparece en su CV — la consistencia con lo que contó antes es lo que más se mira acá.

En "noHacer" incluye lo específico de esta etapa: contradecir lo que dijo en las entrevistas
anteriores, dar la respuesta que cree que quieren oír, y negar tener cualquier debilidad.`,
  },
  {
    key: 'panel',
    label: 'Panel (varias personas)',
    labelEn: 'Panel (several people)',
    cuotas: '6 fit, 6 preguntas típicas, 4 técnicas, 5 para ellos, 5 escenarios, 5 fortalezas, 5 debilidades, 6 items de checklist mental, 5 de logística, 5 de "no hacer"',
    foco: `Son varias personas a la vez y puede tocar cualquier registro — filtro, técnico o de criterio — así
que la guía cubre un poco de todo en vez de apostar a uno.

En el checklist mental incluye cómo darse cuenta en los primeros minutos de qué registro manda
(quién abre la conversación y qué cargo tiene), y que conviene responder mirando a quien preguntó
pero incluyendo al resto con la mirada.`,
  },
]

export function getInterviewType(tipo?: string | null): InterviewTypeConfig | null {
  if (!tipo) return null
  return TYPES.find(t => t.key === tipo.trim().toLowerCase()) || null
}

/** Etiqueta legible para la tabla de "Datos de la entrevista". El texto libre de las guías
 *  anteriores a este cambio no matchea ninguna clave y se muestra tal cual lo escribió. */
export function interviewTypeLabel(tipo: string, idioma: 'es' | 'en'): string {
  const t = getInterviewType(tipo)
  if (!t) return tipo
  return idioma === 'en' ? t.labelEn : t.label
}
