import { api } from '../../lib/api'
import { loadLlmProvider, type LlmProvider } from '../../lib/llmProvider'
import { getKeyForProvider } from '../../lib/userApiKeys'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Trash2, Zap, ExternalLink, Clock, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, AlertTriangle, XCircle, Loader2, Copy, FileText
} from 'lucide-react'
import { PipelineJob, EvaluationResult, RECOMENDACION_CONFIG, SCORE_COLOR } from '../../types/careers'


interface OfferClickData {
  clicks: number
  lastClicked: number
}

function incrementOfferClick(url: string) {
  try {
    const raw = window.localStorage.getItem('offerClickData')
    const parsed = raw ? JSON.parse(raw) as Record<string, OfferClickData> : {}
    const current = parsed[url] || { clicks: 0, lastClicked: 0 }
    parsed[url] = { clicks: current.clicks + 1, lastClicked: Date.now() }
    window.localStorage.setItem('offerClickData', JSON.stringify(parsed))
  } catch {
    // ignore localStorage failures
  }
}

function titleFromUrl(url: string): string {
  try {
    const { hostname, pathname } = new URL(url)
    if (hostname.includes('linkedin.com')) {
      const m = pathname.match(/\/jobs\/view\/(.+?)(?:-(\d{7,}))?$/)
      if (m) {
        const slug = decodeURIComponent(m[1])
          .replace(/-at-[a-z][\w-]*/i, '')
          .replace(/-\d+$/, '')
          .replace(/-/g, ' ')
          .trim()
        return slug.replace(/\b\w/g, c => c.toUpperCase())
      }
    }
    if (hostname.includes('computrabajo.com')) {
      const m = pathname.match(/oferta-de-trabajo-de-(.+?)-en-/)
      if (m) return m[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    }
    if (hostname.includes('getonbrd.com')) {
      const m = pathname.match(/\/jobs\/(.+)/)
      if (m) return decodeURIComponent(m[1]).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    }
    if (hostname.includes('indeed.com')) return 'Indeed — ver oferta'
    return hostname.replace(/^(www\.|cl\.)/, '') + ' — job'
  } catch {
    return url.length > 55 ? url.slice(0, 52) + '...' : url
  }
}

function RecomendacionBadge({ rec }: { rec: string }) {
  const cfg = RECOMENDACION_CONFIG[rec as keyof typeof RECOMENDACION_CONFIG]
  if (!cfg) return null
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function LegitimidadBadge({ leg }: { leg: string }) {
  if (!leg) return null
  if (leg.includes('High')) return (
    <span className="flex items-center gap-1 text-xs text-green-400">
      <CheckCircle2 size={12} /> Alta confianza
    </span>
  )
  if (leg.includes('Caution')) return (
    <span className="flex items-center gap-1 text-xs text-yellow-400">
      <AlertCircle size={12} /> Precaución
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs text-red-400">
      <XCircle size={12} /> Sospechosa
    </span>
  )
}

function EvalResult({ result }: { result: EvaluationResult }) {
  const [expanded, setExpanded] = useState(false)
  const { meta, report } = result

  return (
    <div className="mt-4 border border-gray-700 rounded-xl overflow-hidden">
      {/* Header de resultado */}
      <div className="bg-gray-800 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-white font-semibold">{meta.empresa} — {meta.rol}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className={`text-2xl font-bold ${SCORE_COLOR(meta.score)}`}>
                {meta.score?.toFixed(1)}/5
              </span>
              <RecomendacionBadge rec={meta.recomendacion} />
              <LegitimidadBadge leg={meta.legitimidad} />
            </div>
          </div>
          <div className="text-right text-sm text-gray-400 space-y-0.5">
            <p>{meta.arquetipo}</p>
            <p>{meta.remoto} · {meta.seniority}</p>
            {meta.salario_estimado && <p className="text-green-400">{meta.salario_estimado}</p>}
          </div>
        </div>

        {meta.keywords?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {meta.keywords.slice(0, 10).map(kw => (
              <span key={kw} className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full border border-blue-800/50">
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Reporte completo toggle */}
      <div className="bg-gray-900/50">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            <FileText size={14} />
            Ver análisis completo (bloques A-G)
          </span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {expanded && (
          <div className="px-4 pb-4">
            <div className="bg-gray-950 rounded-lg p-4 max-h-[500px] overflow-y-auto">
              <pre className="text-gray-300 text-xs whitespace-pre-wrap font-mono leading-relaxed">
                {report}
              </pre>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(report)}
              className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <Copy size={12} /> Copiar reporte
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface EvalState {
  loading: boolean
  result: EvaluationResult | null
  error: string | null
}

export default function CareersPipeline() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [newUrl, setNewUrl] = useState('')
  const [jdText, setJdText] = useState('')
  const [llmProvider] = useState<LlmProvider>(() => loadLlmProvider())
  const [jdMode, setJdMode] = useState<'url' | 'text'>('url')
  const [evalStates, setEvalStates] = useState<Record<string, EvalState>>({})
  const [directEval, setDirectEval] = useState<EvalState>({ loading: false, result: null, error: null })
  const [confirmation, setConfirmation] = useState<{ titulo: string; score: number; recomendacion: string; url: string } | null>(null)

  const { data: pipeline = [] } = useQuery<PipelineJob[]>({
    queryKey: ['careers-pipeline'],
    queryFn: () => api.get('/pipeline').then(r => r.data),
  })

  const sortedPipeline = [...pipeline].sort((a, b) =>
    b.added.localeCompare(a.added)
  )

  const isBlockedDomain = (url: string) =>
    url.includes('computrabajo.com') || url.includes('indeed.com') || url.includes('linkedin.com')

  const addMut = useMutation({
    mutationFn: (url: string) => api.post('/pipeline', { url, source: 'manual' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['careers-pipeline'] }); setNewUrl('') },
  })

  const removeMut = useMutation({
    mutationFn: (url: string) => api.delete('/pipeline', { data: { url } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['careers-pipeline'] }),
  })

  const evaluate = async (url?: string, jd?: string, key?: string) => {
    const stateKey = key || 'direct'
    const setState = (s: Partial<EvalState>) => {
      if (stateKey === 'direct') {
        setDirectEval(prev => ({ ...prev, ...s }))
      } else {
        setEvalStates(prev => ({ ...prev, [stateKey]: { ...prev[stateKey], ...s } }))
      }
    }

    setState({ loading: true, result: null, error: null })
    try {
      const userApiKey = getKeyForProvider(llmProvider)
      const payload: Record<string, string> = { llmProvider, ...(userApiKey ? { userApiKey } : {}) }
      if (url) payload.url = url
      if (jd) payload.jd = jd

      const { data } = await api.post<EvaluationResult>('/evaluate', payload)
      setState({ loading: false, result: data })
      if (url) {
        setConfirmation({
          titulo: data.meta?.rol || titleFromUrl(url),
          score: data.meta?.score || 0,
          recomendacion: data.meta?.recomendacion || '—',
          url,
        })
      }
      qc.invalidateQueries({ queryKey: ['careers-tracker'] })
      qc.invalidateQueries({ queryKey: ['careers-stats'] })
      if (url) removeMut.mutate(url)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: unknown }; status?: number }; message?: string }
      const rawErr = e?.response?.data?.error
      const status = e?.response?.status
      let msg: string
      if (status === 504 || status === 524) {
        msg = 'La evaluación tardó demasiado (timeout). Intenta nuevamente o usa el modo "Pegar texto del JD".'
      } else if (typeof rawErr === 'string' && rawErr) {
        msg = rawErr
      } else {
        msg = e?.message || 'Error al evaluar la oferta'
      }
      setState({ loading: false, error: msg })
    }
  }

  const handleDirectEval = () => {
    if (jdMode === 'url' && newUrl.startsWith('http')) {
      evaluate(newUrl.trim(), undefined, 'direct')
      setNewUrl('')
    } else if (jdMode === 'text' && jdText.trim()) {
      evaluate(undefined, jdText.trim(), 'direct')
      setJdText('')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Pipeline de Ofertas</h2>
        <p className="text-gray-400 mt-1">Evalúa ofertas con IA — pega URL o texto completo del anuncio</p>
      </div>

      {/* Evaluación directa */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Zap size={16} className="text-yellow-400" />
          Evaluar Oferta Ahora
        </h3>

        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 p-1 bg-gray-800 rounded-lg w-fit">
          {(['url', 'text'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setJdMode(mode)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                jdMode === mode ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {mode === 'url' ? 'URL del anuncio' : 'Pegar texto del JD'}
            </button>
          ))}
        </div>
        <div className="mb-4" />
      </div>

        {jdMode === 'url' ? (
          <>
            <div className="flex flex-col gap-2">
              <input
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDirectEval()}
                placeholder="https://getOnBoard.com/jobs/... o LinkedIn, GetOnBoard, Bumeran, etc."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDirectEval}
                  disabled={!newUrl.startsWith('http') || directEval.loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {directEval.loading ? (
                    <><Loader2 size={15} className="animate-spin" /> Evaluando...</>
                  ) : (
                    <><Zap size={15} /> Evaluar con IA</>
                  )}
                </button>
                <button
                  onClick={() => { if (newUrl.startsWith('http')) addMut.mutate(newUrl.trim()) }}
                  disabled={!newUrl.startsWith('http')}
                  className="px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors disabled:opacity-40"
                  title="Agregar al pipeline sin evaluar"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
            {newUrl && (newUrl.includes('indeed.com') || newUrl.includes('linkedin.com') || newUrl.includes('computrabajo.com')) && (
              <div className="mt-3 p-3 bg-amber-900/30 border border-amber-800/50 rounded-lg text-amber-300 text-xs flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">💡 Tip: Para mejores resultados con Indeed / LinkedIn / Computrabajo</p>
                  <p className="text-amber-200/70 mt-1">Estos portales bloquean el acceso automático (403). Copia el texto completo de la oferta y úsalo en el modo "Pegar texto del JD" para que la IA evalúe correctamente.</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <textarea
              value={jdText}
              onChange={e => setJdText(e.target.value)}
              placeholder="Pega aquí el texto completo de la oferta de trabajo (incluye requisitos, descripción del puesto, empresa, etc.)"
              rows={8}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-y font-mono"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">{jdText.length} caracteres</p>
              <button
                onClick={handleDirectEval}
                disabled={jdText.trim().length < 100 || directEval.loading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {directEval.loading ? (
                  <><Loader2 size={15} className="animate-spin" /> Evaluando con IA...</>
                ) : (
                  <><Zap size={15} /> Evaluar con IA</>
                )}
              </button>
            </div>
          </div>
        )}

        {directEval.error && (
          <div className="mt-3 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
            {directEval.error}
          </div>
        )}
        {directEval.loading && (
          <div className="mt-4 p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg">
            <div className="flex items-center gap-3 text-blue-400 text-sm">
              <Loader2 size={18} className="animate-spin shrink-0" />
              <div>
                <p className="font-medium">IA analizando oferta...</p>
                <p className="text-blue-500 text-xs mt-0.5">Evaluando bloques A-G: match de CV, estrategia salarial, plan de entrevistas...</p>
              </div>
            </div>
          </div>
        )}
        {directEval.result && <EvalResult result={directEval.result} />}
      </div>

      {/* Lista del pipeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Clock size={16} className="text-orange-400" />
            Cola de Evaluación
            {pipeline.length > 0 && (
              <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded-full">
                {pipeline.length}
              </span>
            )}
          </h3>
        </div>

        {pipeline.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-gray-500 text-sm gap-2">
            <Clock size={24} className="text-gray-700" />
            No hay ofertas en cola. Agrega URLs arriba.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedPipeline.map(job => {
              const state = evalStates[job.url] || { loading: false, result: null, error: null }
              return (
                <div key={job.url} className="border border-gray-800 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 p-4 bg-gray-800/30">
                    <div className="flex-1 min-w-0">
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => incrementOfferClick(job.url)}
                        className="text-white hover:text-blue-300 text-sm flex items-center gap-1.5 group"
                      >
                        <ExternalLink size={12} className="shrink-0 text-blue-400" />
                        <span className="font-medium truncate">{titleFromUrl(job.url)}</span>
                      </a>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {job.added}{job.source ? ` · ${job.source}` : ''} · <span className="text-gray-600">{job.url.length > 60 ? job.url.slice(0,57)+'…' : job.url}</span>
                      </p>
                      {isBlockedDomain(job.url) && (
                        <p className="text-xs text-amber-500 mt-0.5 flex items-center gap-1">
                          <AlertTriangle size={11} className="shrink-0" />
                          Portal bloqueado — pega el texto del JD para mejor resultado
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => evaluate(job.url, undefined, job.url)}
                        disabled={state.loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {state.loading ? (
                          <><Loader2 size={12} className="animate-spin" /> Analizando...</>
                        ) : (
                          <><Zap size={12} /> Evaluar</>
                        )}
                      </button>
                      <button
                        onClick={() => removeMut.mutate(job.url)}
                        className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {state.loading && (
                    <div className="px-4 py-3 bg-blue-900/10 border-t border-blue-900/30">
                      <div className="flex items-center gap-2 text-blue-400 text-xs">
                        <Loader2 size={13} className="animate-spin" />
                        Analizando con IA: match de CV, estrategia salarial, plan de entrevistas...
                      </div>
                    </div>
                  )}
                  {state.error && (
                    <div className="px-4 py-3 bg-red-900/20 border-t border-red-800/50">
                      <p className="text-red-400 text-xs">{state.error}</p>
                    </div>
                  )}
                  {state.result && <EvalResult result={state.result} />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {confirmation && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4 py-8">
          <div className="max-w-md w-full bg-gray-950 border border-blue-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-blue-900/20 p-3 text-blue-300">
                <Zap size={24} />
              </div>
              <div className="flex-1">
                <p className="text-white text-lg font-semibold">Evaluación completa</p>
                <p className="text-gray-400 text-sm mt-1">{confirmation.titulo}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4">
                <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">Score</p>
                <p className="text-3xl font-bold text-white mt-1">{confirmation.score}/5</p>
              </div>
              <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4">
                <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">Recomendación</p>
                <p className="text-white mt-1 font-semibold">{confirmation.recomendacion}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={() => {
                  setConfirmation(null);
                  navigate('/tracker');
                }}
                className="w-full sm:w-auto px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Ir al tracker
              </button>
              <button
                onClick={() => setConfirmation(null)}
                className="w-full sm:w-auto px-4 py-3 border border-gray-700 text-gray-300 hover:text-white rounded-xl text-sm transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
