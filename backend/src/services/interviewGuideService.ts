// Guía de entrevista interactiva.
//
// Un solo artefacto: el JSON (InterviewGuide) es la fuente de verdad y de él sale UN HTML
// standalone que sirve para las tres salidas — preview en la app (iframe), descarga .html y
// PDF. Se hizo así a propósito después de lo que costó el CV: cuando el PDF se construía por
// un camino distinto al preview, terminaban mostrando cosas distintas.
//
// El HTML es autocontenido: CSS inline, cero peticiones de red (nada de @import de Google
// Fonts). En serverless, @sparticuz/chromium-min no trae fuentes del sistema y solo bundlea
// Open Sans como fallback — por eso la familia es un stack de sistema y no una fuente
// concreta: en el equipo del usuario usa la suya, en el PDF cae a Open Sans y se ve bien.

import { interviewTypeLabel } from '../config/interviewTypes'

export interface InterviewMeta {
  entrevistadores?: string
  fecha?: string
  hora?: string
  modalidad?: string
  tipo?: string
}

export interface InterviewNotes {
  entrevistadorPrincipal?: string
  tono?: string
  horaInicio?: string
  quimica?: string
  preguntas?: string
  equipo?: string
  sensacion?: string
  pasos?: string
  libre?: string
}

export interface EmpresaStat { valor: string; etiqueta: string }
export interface EmpresaValor { nombre: string; descripcion: string; comoUsarlo: string }
export interface Fuente { titulo: string; url: string }

export interface FitItem { titulo: string; detalle: string; destacado?: boolean }
export interface PitchBloque { etiqueta: string; texto: string }
export interface QA { pregunta: string; respuesta: string; tip?: string }
export interface Escenario { titulo: string; situacion: string; respuesta: string; destacado?: boolean }
export interface FoDe { titulo: string; texto: string }

export interface EmpresaInfo {
  resumen: string
  stats: EmpresaStat[]
  valores: EmpresaValor[]
  fuentes: Fuente[]
  investigada: boolean   // false = web_search no encontró datos confiables de esta empresa
}

export interface InterviewGuide {
  version: 1
  generatedAt: string
  empresa: string
  rol: string
  idioma: 'es' | 'en'
  meta: InterviewMeta
  empresaInfo: EmpresaInfo
  cargo: {
    objetivo: string
    funciones: string[]
    requisitos: string[]
    fit: FitItem[]
    fraseFit: string
  }
  pitch: {
    bloques: PitchBloque[]
    numerosClave: string[]
  }
  preguntas: {
    tipicas: QA[]
    tecnicas: QA[]
    paraEllos: string[]
  }
  escenarios: Escenario[]
  fortalezas: FoDe[]
  debilidades: FoDe[]
  checklist: {
    mental: string[]
    logistica: string[]
    noHacer: string[]
    ventaja: string
  }
}

// ── i18n mínimo del artefacto ────────────────────────────────────────────────
// El HTML se descarga y se abre fuera de la app, así que no puede usar el i18n del
// frontend: los textos fijos viajan dentro del propio archivo.

type Dict = Record<string, string>

const ES: Dict = {
  guia: 'Guía de Entrevista',
  buscar: 'Buscar… ej: pitch, sueldo, debilidad, escenario…',
  cerrar: 'Cerrar',
  sinResultados: 'Sin resultados para',
  tabEmpresa: 'La empresa',
  tabCargo: 'El cargo',
  tabPitch: 'Tu pitch',
  tabPreguntas: 'Preguntas clave',
  tabEscenarios: 'Escenarios',
  tabFoDe: 'Fortalezas y debilidades',
  tabChecklist: 'Checklist',
  tabNotas: 'Notas',
  queEs: 'Qué es',
  datosClave: 'Datos clave',
  valoresCultura: 'Valores y cultura',
  comoUsarlo: 'Cómo usarlo',
  fuentes: 'Fuentes',
  sinInvestigacion: 'No se encontraron datos públicos confiables de esta empresa. Lo que sigue sale del aviso del cargo. Antes de la entrevista, revisa su sitio y su LinkedIn — llegar con un dato propio marca diferencia.',
  objetivo: 'Objetivo del cargo',
  funciones: 'Funciones',
  requisitos: 'Requisitos',
  comoEncajas: 'Cómo encajas',
  fraseFit: 'La frase que resume tu fit',
  pitch90: 'Pitch de 90 segundos',
  loQueDices: 'Lo que dices',
  numerosClave: 'Tus números clave — memorízalos',
  tipicas: 'Preguntas típicas',
  tecnicas: 'Preguntas técnicas del rol',
  paraEllos: 'Preguntas que TÚ debes hacer al final',
  tuRespuesta: 'Tu respuesta',
  tip: 'Tip de delivery',
  situacion: 'La situación',
  comoResponder: 'Cómo responder',
  fortalezas: 'Fortalezas — elige 2 o 3',
  debilidades: 'Debilidades — elige 1 o 2',
  fodeTip: 'Estructura siempre: (1) cuál es → (2) cómo se manifiesta en tu trabajo → (3) qué haces para manejarlo. Las debilidades terminan en la acción, nunca en el problema.',
  prepMental: 'Preparación mental',
  logistica: 'Logística',
  noHacer: 'Lo que NO debes hacer',
  tuVentaja: 'Tu ventaja real',
  datosEntrevista: 'Datos de la entrevista',
  entrevistadores: 'Entrevistador(es)',
  fecha: 'Fecha',
  hora: 'Hora',
  modalidad: 'Modalidad / link',
  tipo: 'Tipo de entrevista',
  notasTitulo: 'Mis notas de la entrevista',
  notasSub: 'Se guardan solas en tu cuenta',
  notasTip: 'Anota quién habló más, preguntas inesperadas, datos del equipo y los próximos pasos. Todo eso sirve para la siguiente etapa.',
  nEntrevistador: 'Entrevistador principal',
  nTono: 'Tono de la entrevista',
  nHora: 'Hora de inicio',
  nQuimica: '¿Hubo buena química?',
  nPreguntas: 'Preguntas que me hicieron',
  nEquipo: 'Lo que me contaron del equipo / proyecto',
  nSensacion: 'Cómo me fue / sensación',
  nPasos: 'Próximos pasos que mencionaron',
  nLibre: 'Notas libres',
  guardado: 'Guardado',
  guardando: 'Guardando…',
  notasSoloApp: 'Estas notas se editan desde Ergania. Esta copia es solo lectura.',
  sinNotas: 'Todavía no escribiste notas.',
  generada: 'Guía generada el',
}

const EN: Dict = {
  guia: 'Interview Guide',
  buscar: 'Search… e.g. pitch, salary, weakness, scenario…',
  cerrar: 'Close',
  sinResultados: 'No results for',
  tabEmpresa: 'The company',
  tabCargo: 'The role',
  tabPitch: 'Your pitch',
  tabPreguntas: 'Key questions',
  tabEscenarios: 'Scenarios',
  tabFoDe: 'Strengths & weaknesses',
  tabChecklist: 'Checklist',
  tabNotas: 'Notes',
  queEs: 'What it is',
  datosClave: 'Key facts',
  valoresCultura: 'Values & culture',
  comoUsarlo: 'How to use it',
  fuentes: 'Sources',
  sinInvestigacion: 'No reliable public data was found about this company. What follows comes from the job posting. Before the interview, check their site and LinkedIn — showing up with your own fact makes a difference.',
  objetivo: 'Role objective',
  funciones: 'Responsibilities',
  requisitos: 'Requirements',
  comoEncajas: 'How you fit',
  fraseFit: 'The line that sums up your fit',
  pitch90: '90-second pitch',
  loQueDices: 'What you say',
  numerosClave: 'Your key numbers — memorize them',
  tipicas: 'Common questions',
  tecnicas: 'Technical questions for this role',
  paraEllos: 'Questions YOU should ask at the end',
  tuRespuesta: 'Your answer',
  tip: 'Delivery tip',
  situacion: 'The situation',
  comoResponder: 'How to answer',
  fortalezas: 'Strengths — pick 2 or 3',
  debilidades: 'Weaknesses — pick 1 or 2',
  fodeTip: 'Always structure it: (1) what it is → (2) how it shows up in your work → (3) what you do about it. Weaknesses end on the action, never on the problem.',
  prepMental: 'Mental prep',
  logistica: 'Logistics',
  noHacer: 'What NOT to do',
  tuVentaja: 'Your real edge',
  datosEntrevista: 'Interview details',
  entrevistadores: 'Interviewer(s)',
  fecha: 'Date',
  hora: 'Time',
  modalidad: 'Format / link',
  tipo: 'Interview type',
  notasTitulo: 'My interview notes',
  notasSub: 'Saved automatically to your account',
  notasTip: 'Write down who talked most, unexpected questions, team details and next steps. All of it helps for the next round.',
  nEntrevistador: 'Main interviewer',
  nTono: 'Interview tone',
  nHora: 'Start time',
  nQuimica: 'Was there good chemistry?',
  nPreguntas: 'Questions they asked me',
  nEquipo: 'What they told me about the team / project',
  nSensacion: 'How it went / gut feeling',
  nPasos: 'Next steps they mentioned',
  nLibre: 'Free notes',
  guardado: 'Saved',
  guardando: 'Saving…',
  notasSoloApp: 'These notes are edited from Ergania. This copy is read-only.',
  sinNotas: "You haven't written any notes yet.",
  generada: 'Guide generated on',
}

// ── helpers ──────────────────────────────────────────────────────────────────

// La tool web_search envuelve el texto citado en <cite index="6-1,6-2">…</cite>. Como acá se
// escapa todo el HTML, esas etiquetas se leían literales dentro del párrafo.
export function stripCitations(s: string): string {
  return s
    .replace(/<\/?cite\b[^>]*>/gi, '')
    .replace(/\[\d+(?:[,-]\s*\d+)*\]/g, '')   // variante "[1]" / "[2, 3]" que a veces usa
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,;:)])/g, '$1')
}

function deepStrip<T>(v: T): T {
  if (typeof v === 'string') return stripCitations(v) as unknown as T
  if (Array.isArray(v)) return v.map(deepStrip) as unknown as T
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) out[k] = deepStrip(val)
    return out as unknown as T
  }
  return v
}

/** Se limpia al RENDERIZAR, no solo al generar: las guías creadas antes del fix quedaron
 *  guardadas con el marcado adentro y obligar a regenerarlas costaría tokens por un bug de
 *  presentación. `meta` queda fuera: eso lo escribió el usuario y no se le toca. */
function sanitizeGuide(g: InterviewGuide): InterviewGuide {
  return { ...deepStrip(g), meta: g.meta }
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Las respuestas del LLM traen **negrita** de markdown; el resto va escapado.
function rich(s: unknown): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

function safeUrl(u: unknown): string {
  const s = String(u ?? '').trim()
  return /^https?:\/\//i.test(s) ? esc(s) : ''
}

// Paleta "cósmica" de Ergania — la misma de Landing.tsx (índigo profundo + gradiente
// azul→violeta). Las fuentes de marca (Space Grotesk / Source Sans Pro) se cargan por red
// desde Google Fonts y este artefacto no puede pedir nada a la red, así que la identidad
// viaja en el color y la forma, no en la tipografía: stack de sistema.
//
// En pantalla es oscuro (vive dentro de la app, que es oscura). En impresión se invierte
// redefiniendo las variables: un PDF con fondo índigo sería ilegible y un derroche de tinta.
const CSS = `
:root{
  --bg:#0B1330; --surface:#10142B; --surface-2:#161B3A; --hero:#1E1B4B; --footer:#070A16;
  --ink:#F1F2FB; --ink-sub:#B7BAE0; --ink-muted:#7C82AE;
  --line:rgba(255,255,255,.08); --line-2:rgba(255,255,255,.16);
  --blue:#3B82F6; --blue2:#60A5FA;
  --accent:#8B5CF6; --accent-2:#A78BFA; --accent-ink:#C4B5FD;
  --accent-soft:rgba(139,92,246,.16);
  --cyan:#22D3EE;
  --ok:#34D399; --ok-soft:rgba(52,211,153,.13);
  --warn:#FBBF24; --warn-soft:rgba(251,191,36,.13); --warn-ink:#FCD34D;
  --bad:#FB7185; --bad-soft:rgba(251,113,133,.13);
  --grad:linear-gradient(90deg,var(--blue2),var(--accent-2));
}
*{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
  background:var(--bg); color:var(--ink); font-size:16px; line-height:1.7;
  -webkit-text-size-adjust:100%;
}
.topbar{position:sticky;top:0;z-index:200;background:var(--bg);box-shadow:0 8px 18px rgba(0,0,0,.35)}
.header{
  background:linear-gradient(135deg,var(--hero),var(--bg)); padding:12px 20px;
  display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;
  border-bottom:1px solid var(--line-2); position:relative;
}
.header::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:3px;background:var(--grad)}
.header h1{font-size:16px;font-weight:700;color:var(--ink);letter-spacing:-.2px}
.header .sub{font-size:12px;color:var(--ink-muted);margin-top:2px}
.badge{
  background:var(--grad); color:#0B1330; font-size:10px; font-weight:800;
  padding:4px 11px; border-radius:20px; text-transform:uppercase; letter-spacing:1px;
  white-space:nowrap;
}
.search-bar{background:var(--surface);border-bottom:1px solid var(--line);padding:10px 20px}
.search-inner{max-width:1000px;margin:0 auto;display:flex;gap:8px;align-items:center}
.search-wrap{position:relative;flex:1}
.search-wrap input{
  width:100%;padding:11px 12px 11px 36px;border:1.5px solid var(--line-2);border-radius:9px;
  font-family:inherit;font-size:16px;outline:none;transition:border .2s;background:var(--bg);color:var(--ink);
}
.search-wrap input::placeholder{color:var(--ink-muted)}
.search-wrap input:focus{border-color:var(--accent-2)}
.search-ico{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;pointer-events:none;opacity:.7}
#btn-cerrar{display:none;background:var(--surface-2);color:var(--ink);border:1px solid var(--line-2);padding:8px 13px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
#search-results{max-width:1000px;margin:8px auto 0;display:none}
.result-item{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;margin-bottom:4px;background:var(--surface-2);border-radius:8px;border-left:3px solid var(--accent-2);cursor:pointer}
.result-item:hover{background:var(--accent-soft)}
.result-title{font-size:13px;font-weight:600;color:var(--ink)}
.result-sec{font-size:11px;color:var(--ink-muted);margin-top:2px}
.result-ir{font-size:11px;font-weight:700;color:var(--accent-ink);white-space:nowrap;margin-left:12px}
.nav-tabs{background:var(--surface);border-bottom:1px solid var(--line);padding:0 12px;display:flex;gap:2px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
.tab-btn{padding:14px 16px;background:none;border:none;border-bottom:3px solid transparent;font-family:inherit;font-size:14px;font-weight:500;color:var(--ink-muted);cursor:pointer;white-space:nowrap;transition:all .2s;min-height:48px}
.tab-btn:hover{color:var(--ink)}
.tab-btn.active{color:var(--accent-ink);border-bottom-color:var(--accent-2);font-weight:700}
.content{max-width:1000px;margin:0 auto;padding:26px 22px 80px}
.section{display:none}
.section.active{display:block}
.section-title{font-size:26px;font-weight:800;margin-bottom:5px;letter-spacing:-.6px;color:var(--ink)}
.section-sub{font-size:15px;color:var(--ink-muted);margin-bottom:20px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:22px 24px;margin-bottom:16px}
.card-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--accent-ink);margin-bottom:13px;display:flex;align-items:center;gap:8px}
.card-title::before{content:'';display:inline-block;width:3px;height:15px;background:var(--grad);border-radius:2px;flex-shrink:0}
.card.destacado{border:1px solid var(--ok)}
.card.peligro{border-left:3px solid var(--bad)}
.q-block{background:var(--surface-2);border-radius:9px;padding:18px 20px;margin-bottom:13px;border-left:3px solid var(--accent-2)}
.q-block.verde{border-left-color:var(--ok);background:var(--ok-soft)}
.q-block.rojo{border-left-color:var(--bad);background:var(--bad-soft)}
.q-text{font-size:16px;font-weight:600;margin-bottom:10px;color:var(--ink);line-height:1.5}
.r-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--accent-ink);margin-bottom:5px}
.r-text{font-size:16px;color:var(--ink-sub);line-height:1.8}
.r-text strong{color:var(--ink);font-weight:600}
.tip{margin-top:10px;padding-top:9px;border-top:1px dashed var(--line-2);font-size:13px;color:var(--ink-muted)}
.tip b{color:var(--cyan);text-transform:uppercase;font-size:10px;letter-spacing:.7px}
.alerta{background:var(--warn-soft);border:1px solid var(--warn);border-radius:8px;padding:12px 15px;font-size:13px;color:var(--warn-ink);margin-bottom:14px;display:flex;gap:10px;align-items:flex-start}
.chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
.chip{background:var(--accent-soft);color:var(--accent-ink);border:1px solid var(--line-2);border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600}
.stat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:14px 0}
.stat-box{background:var(--surface-2);border:1px solid var(--line-2);border-radius:10px;padding:14px;text-align:center}
.stat-num{font-size:23px;font-weight:800;color:var(--accent-ink);line-height:1.15;margin-bottom:4px;word-break:break-word}
.stat-label{font-size:10px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:.5px}
.tl-item{display:flex;gap:12px;margin-bottom:13px;align-items:flex-start}
.tl-dot{width:28px;height:28px;background:var(--grad);border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#0B1330;margin-top:2px}
.tl-dot.verde{background:var(--ok)}
.tl-content strong{display:block;font-size:14px;font-weight:600;margin-bottom:3px;color:var(--ink)}
.tl-content span{font-size:13px;color:var(--ink-sub);line-height:1.55}
.highlight{background:var(--accent-soft);border:1px solid var(--accent);border-radius:10px;padding:14px 17px;margin:14px 0;font-size:14px;color:var(--ink);font-weight:500;line-height:1.6}
.checklist{list-style:none}
.checklist li{display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);font-size:16px;color:var(--ink-sub)}
.checklist li:last-child{border-bottom:none}
.checklist li::before{content:'☐';flex-shrink:0;color:var(--accent-2);font-size:15px;line-height:1.5}
.checklist.no li::before{content:'✕';color:var(--bad);font-weight:700;font-size:13px}
.valor-card{background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin-bottom:10px}
.valor-nombre{font-size:15px;font-weight:700;margin-bottom:4px;color:var(--ink)}
.valor-desc{font-size:13px;color:var(--ink-sub);line-height:1.55;margin-bottom:8px}
.valor-link{background:var(--accent-soft);border-radius:6px;padding:8px 12px;font-size:13px;color:var(--accent-ink);font-weight:500;line-height:1.5}
.fuentes{font-size:12px;color:var(--ink-muted);margin-top:10px;line-height:1.7}
.fuentes a{color:var(--blue2);word-break:break-all}
.meta-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.meta-item .k{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--ink-muted);display:block;margin-bottom:2px}
.meta-item .v{font-size:14px;font-weight:600;word-break:break-word;color:var(--ink)}
.nota-label{font-size:12px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px}
.nota-input{width:100%;padding:12px 14px;border:1.5px solid var(--line-2);border-radius:9px;font-family:inherit;font-size:16px;line-height:1.6;outline:none;transition:border .2s;background:var(--bg);color:var(--ink)}
.nota-input::placeholder{color:var(--ink-muted)}
.nota-input:focus{border-color:var(--accent-2)}
textarea.nota-input{min-height:170px;resize:vertical}
.nota-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
.nota-ro{font-size:14px;color:var(--ink-sub);white-space:pre-wrap;line-height:1.7}
#save-state{position:fixed;bottom:16px;right:16px;background:var(--ok);color:#06281C;font-size:12px;font-weight:700;padding:7px 14px;border-radius:20px;opacity:0;transition:opacity .25s;pointer-events:none;z-index:300}
#save-state.on{opacity:1}
.pie{text-align:center;font-size:11px;color:var(--ink-muted);margin-top:26px}
@media(max-width:640px){
  /* En celular manda el ancho de lectura: márgenes chicos, tipografía intacta. */
  .content{padding:18px 14px 70px}
  .card{padding:16px 15px}
  .header{padding:10px 14px}
  .header h1{font-size:15px}
  .search-bar{padding:9px 14px}
  .section-title{font-size:22px}
  .stat-grid{grid-template-columns:1fr 1fr;gap:8px}
  .meta-grid{grid-template-columns:1fr 1fr}
  .nota-grid{grid-template-columns:1fr}
  textarea.nota-input{min-height:150px}
  .q-block{padding:15px 16px}
  .badge{font-size:9px;padding:3px 9px}
}
@media print{
  /* El PDF invierte la paleta redefiniendo las variables: casi todas las reglas de arriba
     siguen sirviendo tal cual. Y expande las tabs, que en pantalla son display:none. */
  :root{
    --bg:#FFFFFF; --surface:#FFFFFF; --surface-2:#F7F7FB; --hero:#FFFFFF;
    --ink:#0B1330; --ink-sub:#3A3F5C; --ink-muted:#6B7190;
    --line:#E5E7EB; --line-2:#D6D8E4;
    --accent:#6D28D9; --accent-2:#7C3AED; --accent-ink:#5B21B6;
    --accent-soft:#F3EEFE; --blue2:#2563EB; --cyan:#0E7490;
    --ok:#047857; --ok-soft:#ECFDF5;
    --warn:#B45309; --warn-soft:#FFFBEB; --warn-ink:#92400E;
    --bad:#BE123C; --bad-soft:#FFF1F2;
    --grad:linear-gradient(90deg,#2563EB,#7C3AED);
  }
  body{background:#fff;color:var(--ink);font-size:12px}
  .topbar{position:static;box-shadow:none}
  .header{position:static;background:#fff;border-bottom:none;padding:0 0 8px}
  .header::after{position:static;display:block;height:3px;margin-top:8px}
  .badge{color:#fff}
  .search-bar,.nav-tabs,#save-state{display:none !important}
  .section{display:block !important;page-break-before:always;padding-top:4px}
  .section:first-of-type{page-break-before:avoid}
  .content{max-width:100%;padding:12px 0}
  .card,.q-block,.valor-card,.stat-box,.highlight,.alerta{page-break-inside:avoid}
  .tl-dot{color:#fff}
  .nota-input{border:1px solid var(--line-2);min-height:auto}
  a{text-decoration:none}
}
`

// ── bloques de render ────────────────────────────────────────────────────────

function card(title: string, body: string, cls = ''): string {
  if (!body.trim()) return ''
  return `<div class="card ${cls}"><div class="card-title">${esc(title)}</div>${body}</div>`
}

function qaBlock(q: QA, T: Dict, cls = ''): string {
  return `<div class="q-block ${cls}">
  <div class="q-text">${esc(q.pregunta)}</div>
  <div class="r-label">${T.tuRespuesta}</div>
  <div class="r-text">${rich(q.respuesta)}</div>
  ${q.tip ? `<div class="tip"><b>${T.tip}</b><br>${rich(q.tip)}</div>` : ''}
</div>`
}

function list(items: string[] | undefined, cls = ''): string {
  if (!items?.length) return ''
  return `<ul class="checklist ${cls}">${items.map(i => `<li><span>${rich(i)}</span></li>`).join('')}</ul>`
}

function bullets(items: string[] | undefined): string {
  if (!items?.length) return ''
  return `<ul style="margin-left:18px;color:var(--ink-sub);font-size:14px;line-height:1.7">${items.map(i => `<li>${rich(i)}</li>`).join('')}</ul>`
}

function sectionEmpresa(g: InterviewGuide, T: Dict): string {
  const e = g.empresaInfo
  const stats = e.stats?.length
    ? `<div class="stat-grid">${e.stats.slice(0, 4).map(s =>
        `<div class="stat-box"><div class="stat-num">${esc(s.valor)}</div><div class="stat-label">${esc(s.etiqueta)}</div></div>`).join('')}</div>`
    : ''
  const fuentes = e.fuentes?.length
    ? `<div class="fuentes"><strong>${T.fuentes}:</strong> ${e.fuentes.map(f => {
        const u = safeUrl(f.url)
        return u ? `<a href="${u}" target="_blank" rel="noopener noreferrer">${esc(f.titulo)}</a>` : esc(f.titulo)
      }).join(' · ')}</div>`
    : ''
  const valores = e.valores?.length
    ? e.valores.map(v => `<div class="valor-card">
        <div class="valor-nombre">${esc(v.nombre)}</div>
        <div class="valor-desc">${rich(v.descripcion)}</div>
        ${v.comoUsarlo ? `<div class="valor-link"><strong>${T.comoUsarlo}:</strong> ${rich(v.comoUsarlo)}</div>` : ''}
      </div>`).join('')
    : ''

  const meta = g.meta || {}
  const metaItems = [
    meta.entrevistadores ? { k: T.entrevistadores, v: meta.entrevistadores } : null,
    meta.fecha ? { k: T.fecha, v: meta.fecha } : null,
    meta.hora ? { k: T.hora, v: meta.hora } : null,
    meta.tipo ? { k: T.tipo, v: interviewTypeLabel(meta.tipo, g.idioma) } : null,
    meta.modalidad ? { k: T.modalidad, v: meta.modalidad } : null,
  ].filter(Boolean) as { k: string; v: string }[]

  const metaCard = metaItems.length
    ? card(T.datosEntrevista, `<div class="meta-grid">${metaItems.map(m =>
        `<div class="meta-item"><span class="k">${esc(m.k)}</span><span class="v">${esc(m.v)}</span></div>`).join('')}</div>`)
    : ''

  const aviso = e.investigada ? '' : `<div class="alerta"><span>⚠️</span><span>${T.sinInvestigacion}</span></div>`

  return `<div id="empresa" class="section active">
  <div class="section-title">${esc(g.empresa)}</div>
  <div class="section-sub">${T.tabEmpresa}</div>
  ${aviso}
  ${metaCard}
  ${card(T.queEs, `<p class="r-text">${rich(e.resumen)}</p>${stats}${fuentes}`)}
  ${valores ? card(T.valoresCultura, valores) : ''}
</div>`
}

function sectionCargo(g: InterviewGuide, T: Dict): string {
  const c = g.cargo
  const desc = [
    c.objetivo ? `<div class="r-text" style="margin-bottom:12px"><strong>${T.objetivo}:</strong> ${rich(c.objetivo)}</div>` : '',
    c.funciones?.length ? `<div class="r-label">${T.funciones}</div>${bullets(c.funciones)}` : '',
    c.requisitos?.length ? `<div class="chips">${c.requisitos.map(r => `<span class="chip">${esc(r)}</span>`).join('')}</div>` : '',
  ].join('')

  const fit = c.fit?.length
    ? c.fit.map(f => `<div class="tl-item">
        <div class="tl-dot ${f.destacado ? 'verde' : ''}">${f.destacado ? '★' : '✓'}</div>
        <div class="tl-content"><strong>${esc(f.titulo)}</strong><span>${rich(f.detalle)}</span></div>
      </div>`).join('')
    : ''

  return `<div id="cargo" class="section">
  <div class="section-title">${esc(g.rol)}</div>
  <div class="section-sub">${T.tabCargo}</div>
  ${card(T.objetivo, desc, 'destacado')}
  ${fit ? card(T.comoEncajas, fit) : ''}
  ${c.fraseFit ? `<div class="highlight"><strong>${T.fraseFit}:</strong> ${rich(c.fraseFit)}</div>` : ''}
</div>`
}

function sectionPitch(g: InterviewGuide, T: Dict): string {
  const p = g.pitch
  const bloques = p.bloques?.length
    ? `<div class="q-block"><div class="r-label">${T.loQueDices}</div><div class="r-text">${
        p.bloques.map(b => `<strong>${esc(b.etiqueta)}:</strong> ${rich(b.texto)}`).join('<br><br>')
      }</div></div>`
    : ''
  const nums = p.numerosClave?.length
    ? `<div class="chips">${p.numerosClave.map(n => `<span class="chip">${esc(n)}</span>`).join('')}</div>`
    : ''

  return `<div id="pitch" class="section">
  <div class="section-title">${T.tabPitch}</div>
  <div class="section-sub">${T.pitch90}</div>
  ${bloques ? card(T.pitch90, bloques) : ''}
  ${nums ? card(T.numerosClave, nums) : ''}
</div>`
}

function sectionPreguntas(g: InterviewGuide, T: Dict): string {
  const q = g.preguntas
  const tipicas = q.tipicas?.map(x => qaBlock(x, T)).join('') || ''
  const tecnicas = q.tecnicas?.map(x => qaBlock(x, T)).join('') || ''
  const paraEllos = q.paraEllos?.length
    ? `<div class="q-block verde"><div class="r-text">${q.paraEllos.map(p => `✅ ${rich(p)}`).join('<br><br>')}</div></div>`
    : ''

  return `<div id="preguntas" class="section">
  <div class="section-title">${T.tabPreguntas}</div>
  <div class="section-sub">${T.tipicas}</div>
  ${tipicas ? card(T.tipicas, tipicas) : ''}
  ${tecnicas ? card(T.tecnicas, tecnicas) : ''}
  ${paraEllos ? card(T.paraEllos, paraEllos) : ''}
</div>`
}

function sectionEscenarios(g: InterviewGuide, T: Dict): string {
  const items = g.escenarios?.map(e => card(e.titulo, `<div class="q-block ${e.destacado ? 'verde' : ''}">
    <div class="q-text">${esc(e.situacion)}</div>
    <div class="r-label">${T.comoResponder}</div>
    <div class="r-text">${rich(e.respuesta)}</div>
  </div>`, e.destacado ? 'destacado' : '')).join('') || ''

  return `<div id="escenarios" class="section">
  <div class="section-title">${T.tabEscenarios}</div>
  <div class="section-sub">${T.situacion}</div>
  ${items}
</div>`
}

function sectionFoDe(g: InterviewGuide, T: Dict): string {
  const f = g.fortalezas?.map(x =>
    `<div class="q-block" style="border-left-color:var(--ok)"><div class="q-text">${esc(x.titulo)}</div><div class="r-text">${rich(x.texto)}</div></div>`).join('') || ''
  const d = g.debilidades?.map(x =>
    `<div class="q-block rojo"><div class="q-text">${esc(x.titulo)}</div><div class="r-text">${rich(x.texto)}</div></div>`).join('') || ''

  return `<div id="fode" class="section">
  <div class="section-title">${T.tabFoDe}</div>
  <div class="section-sub">${T.fodeTip}</div>
  ${f ? card(T.fortalezas, f) : ''}
  ${d ? card(T.debilidades, d) : ''}
</div>`
}

function sectionChecklist(g: InterviewGuide, T: Dict): string {
  const c = g.checklist
  return `<div id="checklist" class="section">
  <div class="section-title">${T.tabChecklist}</div>
  <div class="section-sub">${T.prepMental}</div>
  ${c.mental?.length ? card(T.prepMental, list(c.mental)) : ''}
  ${c.logistica?.length ? card(T.logistica, list(c.logistica)) : ''}
  ${c.noHacer?.length ? card(T.noHacer, list(c.noHacer, 'no'), 'peligro') : ''}
  ${c.ventaja ? `<div class="highlight"><strong>${T.tuVentaja}:</strong> ${rich(c.ventaja)}</div>` : ''}
</div>`
}

const NOTE_FIELDS: { id: keyof InterviewNotes; label: string; area: boolean }[] = [
  { id: 'entrevistadorPrincipal', label: 'nEntrevistador', area: false },
  { id: 'tono',                   label: 'nTono',          area: false },
  { id: 'horaInicio',             label: 'nHora',          area: false },
  { id: 'quimica',                label: 'nQuimica',       area: false },
  { id: 'preguntas',              label: 'nPreguntas',     area: true  },
  { id: 'equipo',                 label: 'nEquipo',        area: true  },
  { id: 'sensacion',              label: 'nSensacion',     area: true  },
  { id: 'pasos',                  label: 'nPasos',         area: true  },
  { id: 'libre',                  label: 'nLibre',         area: true  },
]

function sectionNotas(notes: InterviewNotes, T: Dict, editable: boolean): string {
  const cortos = NOTE_FIELDS.filter(f => !f.area)
  const largos = NOTE_FIELDS.filter(f => f.area)

  if (!editable) {
    // La copia descargada es de solo lectura a propósito: si fuera editable, las notas del
    // archivo y las de la app divergirían y el usuario perdería las que escribió en la otra.
    const filled = NOTE_FIELDS.filter(f => (notes[f.id] || '').trim())
    const body = filled.length
      ? filled.map(f => `<div style="margin-bottom:14px"><span class="nota-label">${esc(T[f.label])}</span><div class="nota-ro">${rich(notes[f.id])}</div></div>`).join('')
      : `<p class="r-text" style="color:var(--ink-muted)">${T.sinNotas}</p>`
    return `<div id="notas" class="section">
  <div class="section-title">${T.notasTitulo}</div>
  <div class="section-sub">${T.notasSoloApp}</div>
  ${card(T.notasTitulo, body)}
</div>`
  }

  const cortosHtml = `<div class="nota-grid">${cortos.map(f =>
    `<div><label class="nota-label" for="${f.id}">${esc(T[f.label])}</label><input id="${f.id}" class="nota-input" type="text" value="${esc(notes[f.id])}"></div>`).join('')}</div>`

  const largosHtml = largos.map(f =>
    card(T[f.label], `<textarea id="${f.id}" class="nota-input">${esc(notes[f.id])}</textarea>`)).join('')

  return `<div id="notas" class="section">
  <div class="section-title">${T.notasTitulo}</div>
  <div class="section-sub">${T.notasSub}</div>
  <div class="alerta"><span>💡</span><span>${T.notasTip}</span></div>
  ${card(T.datosEntrevista, cortosHtml)}
  ${largosHtml}
</div>`
}

// ── índice del buscador ──────────────────────────────────────────────────────
// Se construye en el servidor desde el JSON para que el buscador del artefacto no tenga
// que recorrer el DOM: busca sobre texto plano ya normalizado.

interface IndexEntry { t: string; x: string; tab: string }

function buildSearchIndex(g: InterviewGuide, T: Dict): IndexEntry[] {
  const idx: IndexEntry[] = []
  const push = (t: string, tab: string, ...extra: (string | undefined)[]) => {
    if (!t) return
    idx.push({ t, x: [t, ...extra].filter(Boolean).join(' ').toLowerCase(), tab })
  }

  push(`${g.empresa} — ${T.queEs}`, 'empresa', g.empresaInfo.resumen)
  g.empresaInfo.stats?.forEach(s => push(`${s.valor} ${s.etiqueta}`, 'empresa'))
  g.empresaInfo.valores?.forEach(v => push(v.nombre, 'empresa', v.descripcion, v.comoUsarlo))
  push(`${g.rol} — ${T.objetivo}`, 'cargo', g.cargo.objetivo, g.cargo.funciones?.join(' '), g.cargo.requisitos?.join(' '))
  g.cargo.fit?.forEach(f => push(f.titulo, 'cargo', f.detalle))
  push(T.fraseFit, 'cargo', g.cargo.fraseFit)
  push(T.pitch90, 'pitch', g.pitch.bloques?.map(b => b.texto).join(' '))
  push(T.numerosClave, 'pitch', g.pitch.numerosClave?.join(' '))
  g.preguntas.tipicas?.forEach(q => push(q.pregunta, 'preguntas', q.respuesta, q.tip))
  g.preguntas.tecnicas?.forEach(q => push(q.pregunta, 'preguntas', q.respuesta, q.tip))
  push(T.paraEllos, 'preguntas', g.preguntas.paraEllos?.join(' '))
  g.escenarios?.forEach(e => push(e.titulo, 'escenarios', e.situacion, e.respuesta))
  g.fortalezas?.forEach(x => push(x.titulo, 'fode', x.texto))
  g.debilidades?.forEach(x => push(x.titulo, 'fode', x.texto))
  push(T.prepMental, 'checklist', g.checklist.mental?.join(' '))
  push(T.logistica, 'checklist', g.checklist.logistica?.join(' '))
  push(T.noHacer, 'checklist', g.checklist.noHacer?.join(' '))

  return idx
}

// ── builder principal ────────────────────────────────────────────────────────

export interface BuildOptions {
  /** 'app' = notas editables + postMessage al padre. 'standalone' = descarga/PDF, solo lectura. */
  mode: 'app' | 'standalone'
  notes?: InterviewNotes
}

export function buildInterviewGuideHtml(rawGuide: InterviewGuide, opts: BuildOptions): string {
  const g = sanitizeGuide(rawGuide)
  const T = g.idioma === 'en' ? EN : ES
  const notes = opts.notes || {}
  const editable = opts.mode === 'app'

  const tabs: { id: string; label: string }[] = [
    { id: 'empresa',    label: T.tabEmpresa },
    { id: 'cargo',      label: T.tabCargo },
    { id: 'pitch',      label: T.tabPitch },
    { id: 'preguntas',  label: T.tabPreguntas },
    { id: 'escenarios', label: T.tabEscenarios },
    { id: 'fode',       label: T.tabFoDe },
    { id: 'checklist',  label: T.tabChecklist },
    { id: 'notas',      label: T.tabNotas },
  ]

  const cuando = [g.meta?.fecha, g.meta?.hora].filter(Boolean).join(' · ')
  const fechaGen = (() => {
    try { return new Date(g.generatedAt).toLocaleDateString(g.idioma === 'en' ? 'en-US' : 'es-CL') }
    catch { return '' }
  })()

  const idx = buildSearchIndex(g, T)
  const noteIds = NOTE_FIELDS.map(f => f.id)

  return `<!doctype html>
<html lang="${g.idioma}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${T.guia} · ${esc(g.empresa)}</title>
<style>${CSS}</style>
</head>
<body>
<!-- Cabecera, buscador y tabs van juntos en UN solo contenedor sticky: antes cada uno era
     sticky con un "top" en píxeles calculado a mano, y bastaba que el título saltara a dos
     líneas en un celular angosto para que se solaparan. -->
<div class="header">
    <div>
      <h1>${T.guia} · ${esc(g.empresa)}</h1>
      <div class="sub">${esc(g.rol)}</div>
    </div>
    ${cuando ? `<div class="badge">${esc(cuando)}</div>` : ''}
</div>

<div class="topbar">
  <div class="search-bar">
    <div class="search-inner">
      <div class="search-wrap">
        <span class="search-ico">🔍</span>
        <input id="search-input" type="text" placeholder="${esc(T.buscar)}" autocomplete="off">
      </div>
      <button id="btn-cerrar" type="button">✕ ${T.cerrar}</button>
    </div>
    <div id="search-results"></div>
  </div>

  <div class="nav-tabs">
    ${tabs.map((t, i) => `<button class="tab-btn ${i === 0 ? 'active' : ''}" type="button" data-tab="${t.id}">${esc(t.label)}</button>`).join('')}
  </div>
</div>

<div class="content">
${sectionEmpresa(g, T)}
${sectionCargo(g, T)}
${sectionPitch(g, T)}
${sectionPreguntas(g, T)}
${sectionEscenarios(g, T)}
${sectionFoDe(g, T)}
${sectionChecklist(g, T)}
${sectionNotas(notes, T, editable)}
<div class="pie">Ergania · ${T.generada} ${esc(fechaGen)}</div>
</div>

<div id="save-state"></div>

<script>
(function(){
  var INDICE = ${JSON.stringify(idx)};
  var EDITABLE = ${editable ? 'true' : 'false'};
  var NOTE_IDS = ${JSON.stringify(noteIds)};
  var T = ${JSON.stringify({ sinResultados: T.sinResultados, guardado: T.guardado, guardando: T.guardando })};

  function show(tab){
    var secs = document.querySelectorAll('.section');
    for (var i=0;i<secs.length;i++) secs[i].classList.remove('active');
    var btns = document.querySelectorAll('.tab-btn');
    for (var j=0;j<btns.length;j++) btns[j].classList.toggle('active', btns[j].getAttribute('data-tab') === tab);
    var el = document.getElementById(tab);
    if (el) el.classList.add('active');
    cerrar();
    window.scrollTo({top:0, behavior:'smooth'});
  }

  var btns = document.querySelectorAll('.tab-btn');
  for (var k=0;k<btns.length;k++) {
    btns[k].addEventListener('click', function(){ show(this.getAttribute('data-tab')); });
  }

  var input = document.getElementById('search-input');
  var resEl = document.getElementById('search-results');
  var btnC  = document.getElementById('btn-cerrar');

  function cerrar(){
    if (input) input.value = '';
    if (resEl) { resEl.innerHTML=''; resEl.style.display='none'; }
    if (btnC) btnC.style.display='none';
  }

  function escapeHtml(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function buscar(q){
    q = (q||'').trim().toLowerCase();
    if (!q) { cerrar(); return; }
    btnC.style.display = 'block';
    var palabras = q.split(/\\s+/);
    var out = [];
    for (var i=0;i<INDICE.length;i++){
      var score = 0;
      for (var p=0;p<palabras.length;p++) if (INDICE[i].x.indexOf(palabras[p]) !== -1) score++;
      if (score > 0) out.push({ item: INDICE[i], score: score });
    }
    out.sort(function(a,b){ return b.score - a.score; });
    out = out.slice(0,6);
    if (!out.length){
      resEl.innerHTML = '<div style="padding:8px 4px;font-size:13px;color:var(--ink-muted)">' + T.sinResultados + ' "<strong>' + escapeHtml(q) + '</strong>"</div>';
      resEl.style.display = 'block';
      return;
    }
    resEl.innerHTML = out.map(function(m){
      return '<div class="result-item" data-go="' + m.item.tab + '">' +
        '<div><div class="result-title">' + escapeHtml(m.item.t) + '</div>' +
        '<div class="result-sec">' + escapeHtml(m.item.tab) + '</div></div>' +
        '<div class="result-ir">IR →</div></div>';
    }).join('');
    resEl.style.display = 'block';
    var items = resEl.querySelectorAll('.result-item');
    for (var n=0;n<items.length;n++){
      items[n].addEventListener('click', function(){ show(this.getAttribute('data-go')); });
    }
  }

  if (input) input.addEventListener('input', function(){ buscar(this.value); });
  if (btnC) btnC.addEventListener('click', cerrar);
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') cerrar(); });

  // ── Notas ──
  // El iframe corre con srcDoc, así que comparte origen con la app: postMessage al padre
  // alcanza y evita meterle un token de auth al HTML (que después se descarga y se comparte).
  if (EDITABLE) {
    var estado = document.getElementById('save-state');
    var timer = null;

    function marcar(txt, on){ estado.textContent = txt; estado.classList.toggle('on', on); }

    function recolectar(){
      var n = {};
      for (var i=0;i<NOTE_IDS.length;i++){
        var el = document.getElementById(NOTE_IDS[i]);
        if (el) n[NOTE_IDS[i]] = el.value;
      }
      return n;
    }

    function agendar(){
      marcar(T.guardando, true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(function(){
        window.parent.postMessage({ type: 'ergania:guide-notes', notes: recolectar() }, '*');
      }, 800);
    }

    for (var i=0;i<NOTE_IDS.length;i++){
      var el = document.getElementById(NOTE_IDS[i]);
      if (el) el.addEventListener('input', agendar);
    }

    window.addEventListener('message', function(e){
      if (e.data && e.data.type === 'ergania:notes-saved') {
        marcar(T.guardado, true);
        setTimeout(function(){ marcar('', false); }, 1600);
      }
    });
  }
})();
</script>
</body>
</html>`
}
