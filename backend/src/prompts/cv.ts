// Prompts de generación de CV. Viven fuera de careersController.ts para no seguir
// engordando el controller; ambos devuelven JSON con la forma de svc.CvData.

const LANGUAGE_RULE: Record<'es' | 'en', string> = {
  es: '',
  en: `\nIDIOMA (obligatorio): la oferta está en INGLÉS. Escribe TODO el contenido del CV en inglés profesional nativo: headline, summary, bullets, roles, nombres de skills y títulos de educación. Mantén nombres propios (empresas, instituciones) tal cual. Las claves del JSON no cambian.\n`,
}

// Compartido por el CV por oferta y el CV base, para que no diverjan.
const HEADLINE_RULE = `- HEADLINE (título profesional bajo el nombre): formato "CARGO | KEYWORD · KEYWORD · KEYWORD" (3-4 keywords). El CARGO debe ser un cargo que el candidato realmente ejerció según su CV (el más cercano al objetivo), copiado tal cual o con una variante mínima de redacción — NUNCA un cargo que no aparezca en su historial (ej. no pongas "Jefe de..." si fue "Recepcionista"), ni el título de la oferta si no lo ha tenido. Las keywords solo pueden ser tecnologías/competencias demostradas en el CV.`

const SUMMARY_RULE = `- Prohibido en el resumen dejar frases rotas o sin sujeto al evitar "años de experiencia": cada oración debe ser gramaticalmente completa y natural (ej. "Profesional con experiencia en..." es válido; NO escribas "Profesional con gestionando..."). Relee el resumen antes de responder.`

const PROJECTS_RULE = `- Proyectos: incluye SOLO proyectos que estén explícitamente en el CV o perfil del candidato. Si no hay ninguno, devuelve "projects":[] (cada proyecto real usa {"name","year","bullets"}) — nunca inventes ni conviertas tareas de experiencia laboral en proyectos.`

const LOSS_RULE = `- PRINCIPIO DE PÉRDIDA: cuando la experiencia lo respalde, estructura el bullet como problema → pérdida evitada → resultado → cómo se resolvió (tiempo, dinero, errores, trabajo manual, disponibilidad). Ej: "Eliminé 12 h semanales de reportería manual automatizando..." La sensación debe salir de la evidencia, nunca de frases manipuladoras ni de cifras inventadas.`

export function buildCvJsonPrompt(
  rol: string,
  empresa: string,
  jd: string,
  cv: string,
  cand: Record<string, string>,
  contactInfo: Record<string, string>,
  cvInstructions?: string,
  idioma: 'es' | 'en' = 'es',
): string {
  return `Actúa como un panel de élite evaluando y reescribiendo este CV para ${rol} en ${empresa}: recruiter senior con 20 años en Fortune 500, hiring manager del área, especialista ATS, y career coach. El estándar es el nivel de Google, Stripe, Mercado Libre o Nubank — no una corrección cosmética, una reconstrucción completa. Adapta el criterio al área del cargo (no asumas que es un rol tech).

REGLA ABSOLUTA DE VERACIDAD (por sobre cualquier otra instrucción):
- Nunca inventes empresas, cargos, fechas, certificaciones, proyectos, tecnologías, herramientas, metodologías, industrias, niveles de dominio o logros que no estén en el CV o perfil del candidato.
- Nunca exageres una métrica que no exista. Si no hay una cifra real disponible, describe el impacto con precisión cualitativa (alcance, criticidad, complejidad) en vez de inventar un número.
- Si una keyword importante del JD no tiene evidencia en el CV, NO la agregues como experiencia: va a "diagnostico.keywords_faltantes". Si hay evidencia indirecta, puedes usar una formulación equivalente sin afirmar más de lo que el CV respalda.
- Maximiza el IMPACTO de la experiencia real; no la experiencia misma. Credibilidad > exageración: un reclutador senior detecta una métrica inflada al instante y descarta el CV completo.

ANÁLISIS PREVIO (aplica mentalmente, no lo muestres fuera del JSON):
- Extrae del JD las keywords exactamente como aparecen (con siglas): tecnologías, herramientas, metodologías, certificaciones, idiomas y competencias. Clasifícalas en críticas / importantes / secundarias y prioriza las críticas.
- Compara "lo que la empresa está comprando" con "lo que el CV actual está vendiendo". Si hay desajuste (ej. buscan BI con Power BI y el CV se vende como DBA), corrige el framing con la experiencia real.
- Escáner de 6 segundos: qué ve un reclutador cansado en los segundos 0-2 (headline, cargo actual), 2-4 (primer resultado) y 4-6 (la duda que lo haría dejar de leer). Corrige lo que lo haría descartar el CV.
- Detecta riesgos de percepción: ¿podría leerse como junior por falta de métricas, sobrecalificado, o especializado en otra área? Ajusta el framing para neutralizarlos sin ocultar información.

JD DEL CARGO (extrae keywords ATS, úsalas literalmente):
${jd.slice(0, 4000)}

CV DEL CANDIDATO (incluye TODA la experiencia real; no omitas ninguna empresa ni la inventes):
${cv}

REGLAS DE REDACCIÓN:
${HEADLINE_RULE}
- FÓRMULA XYZ (Google): cada bullet empieza con el RESULTADO = "Logré [resultado], medido por [métrica], haciendo [acción/tecnología]". Nunca bullets vagos ni descripciones de funciones ("responsable de...").
${LOSS_RULE}
${SUMMARY_RULE}
- Resumen (máx. 4 frases): quién es el candidato, su especialidad, las 2-3 habilidades clave del JD que domina, y el valor/impacto que entrega a ESTE cargo. CERO frases genéricas.
- ATS: usa las keywords exactas del JD en headline, resumen, bullets y skills, donde tengan sentido y en contexto de resultados reales. No parafrasees si la keyword es técnica (ej. no cambies "SQL Server" por "bases de datos relacionales"). No rellenes artificialmente.
- Prohibido: "años de experiencia", "X+ años", "senior/junior" por tiempo, "proactivo", "apasionado", "dinámico", "orientado a resultados", "trabajo en equipo", "gran capacidad analítica" sin respaldo concreto.
- Skills: agrupa por categoría y ordena por relevancia para el JD, no alfabéticamente. Incluye ≥3 keywords técnicas del JD (solo las demostradas).
- Experiencia: ≥3 bullets por empresa reciente, 1 para la más antigua; los más relevantes para la oferta primero. Mínimo 1 bullet con métrica concreta por empresa; si no existe una métrica real, describe el impacto cualitativo con precisión (nunca inventada).
${PROJECTS_RULE}
- Si el JD pide una habilidad puntual que el candidato sí tiene, menciónala en el resumen Y en al menos un bullet de experiencia real donde se haya usado.
${cvInstructions ? `\nINSTRUCCIONES DEL CANDIDATO (máxima prioridad):\n${cvInstructions}\n` : ''}${LANGUAGE_RULE[idioma]}
DIAGNÓSTICO (para el candidato, NO va en el CV — escríbelo en español, breve y directo):
- "keywords_cubiertas": keywords críticas o importantes del JD que SÍ quedaron incorporadas en el CV, escritas exactamente como aparecen en la oferta Y como aparecen en el CV. Máximo 12.
- "keywords_faltantes": keywords críticas o importantes del JD, escritas exactamente como aparecen en la oferta, que NO incorporaste porque el CV no las respalda. Máximo 8. Si no falta ninguna, [].
- "a_confirmar": afirmaciones del CV generado que son reformulación o inferencia razonable pero que el candidato debe confirmar que puede defender en entrevista (cita la frase corta y por qué). Máximo 5. Si todo está respaldado explícitamente, [].

Antes de responder, verifica en silencio: ortografía y gramática impecables, cero afirmaciones no respaldadas por el CV original, cada bullet legible en menos de 3 segundos.

Devuelve SOLO JSON válido, sin markdown ni explicaciones. La siguiente estructura es solo un EJEMPLO DE FORMATO — usa las empresas, cargos y fechas REALES del candidato, nunca estos placeholders:
{"name":"${cand.full_name || ''}","headline":"CARGO | KW1 · KW2 · KW3","contact":${JSON.stringify(contactInfo)},"summary":"...","experience":[{"company":"Empresa A","location":"Ciudad, País","role":"Cargo","dates":"Mes Año – Mes Año","bullets":["..."]},{"company":"Empresa B","location":"Ciudad, País","role":"Cargo","dates":"Mes Año – Mes Año","bullets":["..."]}],"projects":[],"skills":{"Categoría 1":"Skill A, Skill B, Skill C","Categoría 2":"Skill D, Skill E"},"education":[{"title":"...","institution":"...","year":"..."}],"diagnostico":{"keywords_cubiertas":["..."],"keywords_faltantes":["..."],"a_confirmar":["..."]}}`
}

// CV base del perfil (sin oferta/JD específica) — aplica cv_instructions al CV
// tal cual está guardado, para descargar/usar fuera del flujo de Postulaciones.
export function buildCvBaseOptimizePrompt(
  cv: string,
  cand: Record<string, string>,
  contactInfo: Record<string, string>,
  cvInstructions: string,
  idioma: 'es' | 'en' = 'es',
): string {
  return `Actúa como un panel de élite reescribiendo este CV: recruiter senior con 20 años en Fortune 500, hiring manager, especialista ATS, y career coach. El estándar es el nivel de Google, Stripe, Mercado Libre o Nubank — no una corrección cosmética, una reconstrucción completa. Este CV NO está atado a una oferta específica — es el CV general del candidato.

REGLA ABSOLUTA DE VERACIDAD (por sobre cualquier otra instrucción):
- Nunca inventes empresas, cargos, fechas, certificaciones, proyectos, tecnologías o logros que no estén en el CV del candidato.
- Nunca exageres una métrica que no exista. Si no hay una cifra real disponible, describe el impacto con precisión cualitativa en vez de inventar un número.
- Maximiza el IMPACTO de la experiencia real; no la experiencia misma.

CV DEL CANDIDATO (incluye TODA la experiencia real; no omitas ninguna empresa ni la inventes):
${cv}

REGLAS DE REDACCIÓN:
${HEADLINE_RULE}
- FÓRMULA XYZ (Google): cada bullet empieza con el RESULTADO = "Logré [resultado], medido por [métrica], haciendo [acción/tecnología]". Nunca bullets vagos ni descripciones de funciones ("responsable de...").
${LOSS_RULE}
${SUMMARY_RULE}
- Resumen (máx. 4 frases): quién es el candidato, su especialidad, sus habilidades clave, y el valor/impacto que entrega.
- Prohibido: "años de experiencia", "X+ años", "senior/junior" por tiempo, "proactivo", "apasionado", "dinámico", "orientado a resultados", "trabajo en equipo" sin respaldo concreto.
- Skills: agrupa por categoría y ordena por relevancia.
${PROJECTS_RULE}
- Experiencia: ≥3 bullets por empresa reciente, 1 para la más antigua. Mínimo 1 bullet con métrica concreta por empresa; si no existe una métrica real, describe el impacto cualitativo con precisión (nunca inventada).

INSTRUCCIONES DEL CANDIDATO (máxima prioridad — es la razón principal por la que se está regenerando este CV):
${cvInstructions}

${LANGUAGE_RULE[idioma]}
Antes de responder, verifica en silencio: ortografía y gramática impecables, cero afirmaciones no respaldadas por el CV original, cada bullet legible en menos de 3 segundos.

Devuelve SOLO JSON válido, sin markdown ni explicaciones. La siguiente estructura es solo un EJEMPLO DE FORMATO — usa las empresas, cargos y fechas REALES del candidato, nunca estos placeholders:
{"name":"${cand.full_name || ''}","headline":"CARGO | KW1 · KW2 · KW3","contact":${JSON.stringify(contactInfo)},"summary":"...","experience":[{"company":"Empresa A","location":"Ciudad, País","role":"Cargo","dates":"Mes Año – Mes Año","bullets":["..."]}],"projects":[],"skills":{"Categoría 1":"Skill A, Skill B, Skill C"},"education":[{"title":"...","institution":"...","year":"..."}]}`
}
