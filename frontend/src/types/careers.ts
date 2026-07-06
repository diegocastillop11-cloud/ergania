export interface TrackerEntry {
  id: string
  fecha: string
  empresa: string
  rol: string
  score: number | null
  estado: EstadoJob
  pdf: boolean
  reportSlug: string | null
  url?: string
  notas?: string
}

export type EstadoJob =
  | 'Evaluada'
  | 'CV Generado'
  | 'Postulada'
  | 'Respondida'
  | 'Entrevista'
  | 'Oferta'
  | 'Rechazada'
  | 'Descartada'
  | 'SKIP'

export interface PipelineJob {
  url: string
  added: string
  source?: string
}

export interface Portal {
  name: string
  careers_url: string
  enabled: boolean
  api?: string
  country?: string
}

export interface PortalsConfig {
  title_filter: {
    positive: string[]
    negative: string[]
    seniority_boost: string[]
  }
  tracked_companies: Portal[]
  search_queries: Array<{ name: string; query: string; enabled: boolean }>
}

export interface CareerStats {
  total: number
  byStatus: Record<string, number>
  avgScore: string | null
  pipeline: number
  reports: number
  pdfs: number
}

export interface EvaluationResult {
  ok: boolean
  entry: TrackerEntry
  reportSlug: string
  meta: {
    empresa: string
    rol: string
    score: number
    arquetipo: string
    remoto: string
    seniority: string
    legitimidad: 'High Confidence' | 'Proceed with Caution' | 'Suspicious'
    recomendacion: 'APLICAR' | 'CONSIDERAR' | 'DESCARTAR'
    salario_estimado: string
    keywords: string[]
  }
  report: string
}

export const ESTADO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  Evaluada:     { label: 'Evaluada',    color: 'text-blue-400',   bg: 'bg-blue-900/30' },
  'CV Generado':{ label: 'CV Listo',    color: 'text-cyan-400',   bg: 'bg-cyan-900/30' },
  Postulada:    { label: 'Postulada',   color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  Respondida:   { label: 'Respondida',  color: 'text-orange-400', bg: 'bg-orange-900/30' },
  Entrevista:   { label: 'Entrevista',  color: 'text-purple-400', bg: 'bg-purple-900/30' },
  Oferta:       { label: '🎉 Oferta',   color: 'text-green-400',  bg: 'bg-green-900/30' },
  Rechazada:    { label: 'Rechazada',   color: 'text-red-400',    bg: 'bg-red-900/30' },
  Descartada:   { label: 'Descartada',  color: 'text-gray-500',   bg: 'bg-gray-800/50' },
  SKIP:         { label: 'Skip',        color: 'text-gray-600',   bg: 'bg-gray-800/30' },
}

export const SCORE_COLOR = (score: number | null): string => {
  if (score === null) return 'text-gray-500'
  if (score >= 4.5) return 'text-green-400'
  if (score >= 4.0) return 'text-lime-400'
  if (score >= 3.5) return 'text-yellow-400'
  return 'text-red-400'
}

export interface Application {
  id: string
  fecha: string
  empresa: string
  rol: string
  url?: string
  jd?: string
  cvHtml?: string
  cvTex?: string
  cvPdfFilename?: string
  estado: string
  interviewPrep?: string
  coverLetter?: string
  idioma?: 'es' | 'en'
  score?: number | null
  notas?: string
}

export const APLICACION_ESTADOS = [
  'CV Generado', 'Postulado', 'Preparado', 'Entrevista', 'Oferta', 'Rechazado', 'Descartado',
] as const

export const RECOMENDACION_CONFIG = {
  APLICAR:    { color: 'text-green-400', bg: 'bg-green-900/30', label: 'Aplicar Ya' },
  CONSIDERAR: { color: 'text-yellow-400', bg: 'bg-yellow-900/30', label: 'Considerar' },
  DESCARTAR:  { color: 'text-red-400', bg: 'bg-red-900/30', label: 'Descartar' },
}
