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
import { COUNTRIES } from '../../lib/countries'
import { useTranslation } from '../../lib/i18n/LanguageContext'


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
  const { t } = useTranslation()
  if (!leg) return null
  if (leg.includes('High')) return (
    <span className="flex items-center gap-1 text-xs text-green-400">
      <CheckCircle2 size={12} /> {t('careersPipeline.evalResult.highConfidence')}
    </span>
  )
  if (leg.includes('Caution')) return (
    <span className="flex items-center gap-1 text-xs text-yellow-400">
      <AlertCircle size={12} /> {t('careersPipeline.evalResult.caution')}
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs text-red-400">
      <XCircle size={12} /> {t('careersPipeline.evalResult.suspicious')}
    </span>
  )
}

function EvalResult({ result, onRecalcular, recalculating }: { result: EvaluationResult; onRecalcular?: () => void; recalculating?: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const { meta, report } = result

  return (
    <div className="mt-4 border border-[var(--border-alt)] rounded-xl overflow-hidden">
      {result.reused && (
        <div className="flex items-center justify-between gap-3 bg-amber-900/20 border-b border-amber-800/40 px-4 py-2.5 text-xs text-amber-300">
          <span>{t('careersPipeline.evalResult.reusedNote', { date: result.reusedFecha ?? '' })}</span>
          {onRecalcular && (
            <button
              onClick={onRecalcular}
              disabled={recalculating}
              className="flex items-center gap-1 text-amber-200 hover:text-[var(--text-primary)] underline disabled:opacity-50 shrink-0"
            >
              {recalculating ? t('careersPipeline.evalResult.recalculating') : t('careersPipeline.evalResult.recalculateNow')}
            </button>
          )}
        </div>
      )}
      {/* Header de resultado */}
      <div className="bg-[var(--bg-surface-alt)] p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[var(--text-primary)] font-semibold">{meta.empresa} — {meta.rol}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className={`text-2xl font-bold ${SCORE_COLOR(meta.score)}`}>
                {meta.score?.toFixed(1)}/5
              </span>
              <RecomendacionBadge rec={meta.recomendacion} />
              <LegitimidadBadge leg={meta.legitimidad} />
            </div>
          </div>
          <div className="text-right text-sm text-[var(--text-tertiary)] space-y-0.5">
            <p>{meta.arquetipo}</p>
            <p>{meta.remoto} · {meta.seniority}</p>
            {meta.salario_estimado && <p className="text-green-400">{meta.salario_estimado}</p>}
          </div>
        </div>
        {/* Persiste después de cerrar el modal de confirmación — sin esto, si el
            usuario cerraba el modal, no tenía forma de volver a llegar al tracker
            desde esta tarjeta. */}
        <button
          onClick={() => navigate('/tracker')}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-[var(--text-primary)] rounded-lg text-xs font-medium transition-all"
        >
          {t('careersPipeline.confirmationModal.goToTracker')}
        </button>

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
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <span className="flex items-center gap-2">
            <FileText size={14} />
            {t('careersPipeline.evalResult.viewFullAnalysis')}
          </span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {expanded && (
          <div className="px-4 pb-4">
            <div className="bg-[var(--bg-app)] rounded-lg p-4 max-h-[500px] overflow-y-auto">
              <pre className="text-[var(--text-secondary)] text-xs whitespace-pre-wrap font-mono leading-relaxed">
                {report}
              </pre>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(report)}
              className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              <Copy size={12} /> {t('careersPipeline.evalResult.copyReport')}
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
  url?: string
  jd?: string
}

export default function CareersPipeline() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [newUrl, setNewUrl] = useState('')
  const [jdText, setJdText] = useState('')
  const [llmProvider] = useState<LlmProvider>(() => loadLlmProvider())
  const [jdMode, setJdMode] = useState<'url' | 'text'>('url')
  const [paisEval, setPaisEval] = useState('')
  const [evalStates, setEvalStates] = useState<Record<string, EvalState>>({})
  const [directEval, setDirectEval] = useState<EvalState>({ loading: false, result: null, error: null })
  const [confirmation, setConfirmation] = useState<{ titulo: string; score: number; recomendacion: string; url: string } | null>(null)
  const [dateFilter, setDateFilter] = useState('todas')
  const [portalFilter, setPortalFilter] = useState('todos')
  const [blockedFilter, setBlockedFilter] = useState<'todos' | 'bloqueados' | 'no-bloqueados'>('todos')

  const { data: pipeline = [] } = useQuery<PipelineJob[]>({
    queryKey: ['careers-pipeline'],
    queryFn: () => api.get('/pipeline').then(r => r.data),
  })

  const sortedPipeline = [...pipeline].sort((a, b) =>
    b.added.localeCompare(a.added)
  )

  const isBlockedDomain = (url: string) =>
    url.includes('computrabajo.com') || url.includes('indeed.com') || url.includes('linkedin.com')

  const availableDates = [...new Set(sortedPipeline.map(j => j.added))]
  const availablePortals = [...new Set(sortedPipeline.map(j => j.source || 'manual'))].sort()

  const filteredPipeline = sortedPipeline.filter(job => {
    if (dateFilter !== 'todas' && job.added !== dateFilter) return false
    if (portalFilter !== 'todos' && (job.source || 'manual') !== portalFilter) return false
    const blocked = isBlockedDomain(job.url)
    if (blockedFilter === 'bloqueados' && !blocked) return false
    if (blockedFilter === 'no-bloqueados' && blocked) return false
    return true
  })

  const addMut = useMutation({
    mutationFn: (url: string) => api.post('/pipeline', { url, source: 'manual' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['careers-pipeline'] }); setNewUrl('') },
  })

  const removeMut = useMutation({
    mutationFn: (url: string) => api.delete('/pipeline', { data: { url } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['careers-pipeline'] }),
  })

  const evaluate = async (url?: string, jd?: string, key?: string, force?: boolean) => {
    const stateKey = key || 'direct'
    const setState = (s: Partial<EvalState>) => {
      if (stateKey === 'direct') {
        setDirectEval(prev => ({ ...prev, ...s }))
      } else {
        setEvalStates(prev => ({ ...prev, [stateKey]: { ...prev[stateKey], ...s } }))
      }
    }

    setState({ loading: true, result: null, error: null, url, jd })
    try {
      const userApiKey = getKeyForProvider(llmProvider)
      const payload: Record<string, string> = { llmProvider, ...(userApiKey ? { userApiKey } : {}) }
      if (url) payload.url = url
      if (jd) payload.jd = jd
      if (paisEval) payload.pais = paisEval
      if (force) payload.force = 'true'

      const { data } = await api.post<EvaluationResult>('/evaluate', payload)
      setState({ loading: false, result: data })
      // Mostrar el modal de confirmación con acceso directo al tracker también cuando
      // se evalúa pegando el texto del JD (antes solo aparecía evaluando por URL) — el
      // usuario no tenía forma rápida de ir a postular después de evaluar por texto.
      setConfirmation({
        titulo: data.meta?.rol || (url ? titleFromUrl(url) : t('careersPipeline.confirmationModal.untitled')),
        score: data.meta?.score || 0,
        recomendacion: data.meta?.recomendacion || '—',
        url: url || '',
      })
      qc.invalidateQueries({ queryKey: ['careers-tracker'] })
      qc.invalidateQueries({ queryKey: ['careers-stats'] })
      if (url) removeMut.mutate(url)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: unknown }; status?: number }; message?: string }
      const rawErr = e?.response?.data?.error
      const status = e?.response?.status
      let msg: string
      if (status === 504 || status === 524) {
        msg = t('careersPipeline.timeoutError')
      } else if (typeof rawErr === 'string' && rawErr) {
        msg = rawErr
      } else {
        msg = e?.message || t('careersPipeline.genericError')
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
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">{t('careersPipeline.title')}</h2>
        <p className="text-[var(--text-tertiary)] mt-1">{t('careersPipeline.subtitle')}</p>
      </div>

      {/* Evaluación directa */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
        <h3 className="text-[var(--text-primary)] font-semibold mb-4 flex items-center gap-2">
          <Zap size={16} className="text-yellow-400" />
          {t('careersPipeline.evaluateNow')}
        </h3>

        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 p-1 bg-[var(--bg-surface-alt)] rounded-lg w-fit">
          {(['url', 'text'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setJdMode(mode)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                jdMode === mode ? 'bg-blue-600 text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {mode === 'url' ? t('careersPipeline.modeUrl') : t('careersPipeline.modeText')}
            </button>
          ))}
        </div>
          <select
            value={paisEval}
            onChange={e => setPaisEval(e.target.value)}
            className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
            title={t('careersPipeline.countryTitle')}
          >
            <option value="">{t('careersPipeline.countryDefault')}</option>
            {COUNTRIES.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
          </select>
        <div className="mb-4" />
      </div>

        {jdMode === 'url' ? (
          <>
            <div className="flex flex-col gap-2">
              <input
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDirectEval()}
                placeholder={t('careersPipeline.urlPlaceholder')}
                className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDirectEval}
                  disabled={!newUrl.startsWith('http') || directEval.loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {directEval.loading ? (
                    <><Loader2 size={15} className="animate-spin" /> {t('careersPipeline.evaluating')}</>
                  ) : (
                    <><Zap size={15} /> {t('careersPipeline.evaluateWithAi')}</>
                  )}
                </button>
                <button
                  onClick={() => { if (newUrl.startsWith('http')) addMut.mutate(newUrl.trim()) }}
                  disabled={!newUrl.startsWith('http')}
                  className="px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-[var(--text-secondary)] rounded-lg text-sm transition-colors disabled:opacity-40"
                  title={t('careersPipeline.addToPipelineTitle')}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
            {newUrl && (newUrl.includes('indeed.com') || newUrl.includes('linkedin.com') || newUrl.includes('computrabajo.com')) && (
              <div className="mt-3 p-3 bg-amber-900/30 border border-amber-800/50 rounded-lg text-amber-300 text-xs flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">{t('careersPipeline.blockedTip')}</p>
                  <p className="text-amber-200/70 mt-1">{t('careersPipeline.blockedTipDesc')}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <textarea
              value={jdText}
              onChange={e => setJdText(e.target.value)}
              placeholder={t('careersPipeline.jdPlaceholder')}
              rows={8}
              className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-4 py-3 text-[var(--text-primary)] placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-y font-mono"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[var(--text-muted)]">{t('careersPipeline.charCount', { count: jdText.length })}</p>
              <button
                onClick={handleDirectEval}
                disabled={jdText.trim().length < 100 || directEval.loading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {directEval.loading ? (
                  <><Loader2 size={15} className="animate-spin" /> {t('careersPipeline.evaluatingWithAi')}</>
                ) : (
                  <><Zap size={15} /> {t('careersPipeline.evaluateWithAi')}</>
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
                <p className="font-medium">{t('careersPipeline.analyzingOffer')}</p>
                <p className="text-blue-500 text-xs mt-0.5">{t('careersPipeline.analyzingBlocks')}</p>
              </div>
            </div>
          </div>
        )}
        {directEval.result && (
          <EvalResult
            result={directEval.result}
            onRecalcular={() => evaluate(directEval.url, directEval.jd, 'direct', true)}
            recalculating={directEval.loading}
          />
        )}
      </div>

      {/* Lista del pipeline */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-[var(--text-primary)] font-semibold flex items-center gap-2">
            <Clock size={16} className="text-orange-400" />
            {t('careersPipeline.queueTitle')}
            {pipeline.length > 0 && (
              <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded-full">
                {filteredPipeline.length === pipeline.length ? pipeline.length : `${filteredPipeline.length}/${pipeline.length}`}
              </span>
            )}
          </h3>

          {pipeline.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-blue-500"
              >
                <option value="todas">{t('careersPipeline.filters.allDates')}</option>
                {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select
                value={portalFilter}
                onChange={e => setPortalFilter(e.target.value)}
                className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-blue-500"
              >
                <option value="todos">{t('careersPipeline.filters.allPortals')}</option>
                {availablePortals.map(p => <option key={p} value={p}>{p === 'manual' ? t('careersPipeline.filters.manualSource') : p}</option>)}
              </select>
              <select
                value={blockedFilter}
                onChange={e => setBlockedFilter(e.target.value as typeof blockedFilter)}
                className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-blue-500"
              >
                <option value="todos">{t('careersPipeline.filters.allBlocked')}</option>
                <option value="bloqueados">{t('careersPipeline.filters.onlyBlocked')}</option>
                <option value="no-bloqueados">{t('careersPipeline.filters.onlyUnblocked')}</option>
              </select>
            </div>
          )}
        </div>

        {pipeline.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-[var(--text-muted)] text-sm gap-2">
            <Clock size={24} className="text-gray-700" />
            {t('careersPipeline.emptyQueue')}
          </div>
        ) : filteredPipeline.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-[var(--text-muted)] text-sm gap-2">
            <Clock size={24} className="text-gray-700" />
            {t('careersPipeline.filters.noMatches')}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPipeline.map(job => {
              const state = evalStates[job.url] || { loading: false, result: null, error: null }
              return (
                <div key={job.url} className="border border-[var(--border-default)] rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 p-4 bg-gray-800/30">
                    <div className="flex-1 min-w-0">
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => incrementOfferClick(job.url)}
                        className="text-[var(--text-primary)] hover:text-blue-300 text-sm flex items-center gap-1.5 group"
                      >
                        <ExternalLink size={12} className="shrink-0 text-blue-400" />
                        <span className="font-medium truncate">{titleFromUrl(job.url)}</span>
                      </a>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                        {job.added}{job.source ? ` · ${job.source}` : ''} · <span className="text-[var(--text-faint)]">{job.url.length > 60 ? job.url.slice(0,57)+'…' : job.url}</span>
                      </p>
                      {isBlockedDomain(job.url) && (
                        <p className="text-xs text-amber-500 mt-0.5 flex items-center gap-1">
                          <AlertTriangle size={11} className="shrink-0" />
                          {t('careersPipeline.blockedPortalNote')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => evaluate(job.url, undefined, job.url)}
                        disabled={state.loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {state.loading ? (
                          <><Loader2 size={12} className="animate-spin" /> {t('careersPipeline.analyzingShort')}</>
                        ) : (
                          <><Zap size={12} /> {t('careersPipeline.evaluate')}</>
                        )}
                      </button>
                      <button
                        onClick={() => removeMut.mutate(job.url)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {state.loading && (
                    <div className="px-4 py-3 bg-blue-900/10 border-t border-blue-900/30">
                      <div className="flex items-center gap-2 text-blue-400 text-xs">
                        <Loader2 size={13} className="animate-spin" />
                        {t('careersPipeline.analyzingWithAi')}
                      </div>
                    </div>
                  )}
                  {state.error && (
                    <div className="px-4 py-3 bg-red-900/20 border-t border-red-800/50">
                      <p className="text-red-400 text-xs">{state.error}</p>
                    </div>
                  )}
                  {state.result && (
                    <EvalResult
                      result={state.result}
                      onRecalcular={() => evaluate(job.url, undefined, job.url, true)}
                      recalculating={state.loading}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {confirmation && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4 py-8">
          <div className="max-w-md w-full bg-[var(--bg-app)] border border-blue-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-blue-900/20 p-3 text-blue-300">
                <Zap size={24} />
              </div>
              <div className="flex-1">
                <p className="text-[var(--text-primary)] text-lg font-semibold">{t('careersPipeline.confirmationModal.title')}</p>
                <p className="text-[var(--text-tertiary)] text-sm mt-1">{confirmation.titulo}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] p-4">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-[0.2em]">{t('careersPipeline.confirmationModal.score')}</p>
                <p className="text-3xl font-bold text-[var(--text-primary)] mt-1">{confirmation.score}/5</p>
              </div>
              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] p-4">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-[0.2em]">{t('careersPipeline.confirmationModal.recommendation')}</p>
                <p className="text-[var(--text-primary)] mt-1 font-semibold">{confirmation.recomendacion}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={() => {
                  setConfirmation(null);
                  navigate('/tracker');
                }}
                className="w-full sm:w-auto px-4 py-3 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] rounded-xl text-sm font-semibold transition-colors"
              >
                {t('careersPipeline.confirmationModal.goToTracker')}
              </button>
              <button
                onClick={() => setConfirmation(null)}
                className="w-full sm:w-auto px-4 py-3 border border-[var(--border-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl text-sm transition-colors"
              >
                {t('careersPipeline.confirmationModal.close')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
