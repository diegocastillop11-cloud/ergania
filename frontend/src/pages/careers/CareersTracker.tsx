import { api } from '../../lib/api'
import { saveBlob } from '../../lib/downloadFile'
import { loadLlmProvider, type LlmProvider } from '../../lib/llmProvider'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, Filter, ExternalLink, FileText, Send,
  ChevronDown, ChevronUp, Eye, CheckCircle2, X, Loader2, Star,
  Copy, Download, Trash2, ArrowUpRight,
} from 'lucide-react'
import { TrackerEntry, EstadoJob, ESTADO_CONFIG, SCORE_COLOR, Application } from '../../types/careers'
import { useTranslation } from '../../lib/i18n/LanguageContext'

async function downloadPdf(appId: string, filename: string) {
  const { data } = await api.get(`/applications/${appId}/pdf`, { responseType: 'blob' })
  await saveBlob(data, filename)
}

const ESTADOS: EstadoJob[] = [
  'Evaluada', 'CV Generado', 'Postulada', 'Respondida',
  'Entrevista', 'Oferta', 'Rechazada', 'Descartada',
]

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[var(--text-faint)]">—</span>
  return (
    <div className="flex items-center gap-1">
      <Star size={11} className={SCORE_COLOR(score)} fill="currentColor" />
      <span className={`text-sm font-bold ${SCORE_COLOR(score)}`}>{score.toFixed(1)}</span>
    </div>
  )
}

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG['Evaluada']
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function ReportModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const { t } = useTranslation()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['report', slug],
    queryFn: () => api.get(`/reports/${encodeURIComponent(slug)}`).then(r => r.data.content as string),
    enabled: !!slug,
    retry: false,
  })

  const errMsg = isError
    ? ((error as { response?: { data?: { error?: string } } })?.response?.data?.error || (error as Error)?.message || t('careersTracker.reportModal.genericError'))
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-surface)] border border-[var(--border-alt)] rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
          <h3 className="text-[var(--text-primary)] font-semibold flex items-center gap-2">
            <FileText size={16} className="text-blue-400" />
            {t('careersTracker.reportModal.title')}
            <span className="text-xs text-[var(--text-faint)] font-normal ml-1">{slug}</span>
          </h3>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={24} className="animate-spin text-blue-400" />
            </div>
          ) : errMsg ? (
            <div className="flex flex-col items-center justify-center h-32 gap-3 text-center">
              <p className="text-red-400 text-sm font-medium">{t('careersTracker.reportModal.loadError')}</p>
              <p className="text-[var(--text-muted)] text-xs max-w-md">{errMsg}</p>
              <p className="text-[var(--text-faint)] text-xs">{t('careersTracker.reportModal.slugLabel')} {slug}</p>
            </div>
          ) : !data ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
              <p className="text-[var(--text-muted)] text-sm">{t('careersTracker.reportModal.noContent')}</p>
              <p className="text-[var(--text-faint)] text-xs">{t('careersTracker.reportModal.noContentNote')}</p>
              <p className="text-[var(--text-faint)] text-xs">{t('careersTracker.reportModal.slugLabel')} {slug}</p>
            </div>
          ) : (
            <pre className="text-[var(--text-secondary)] text-xs whitespace-pre-wrap font-mono leading-relaxed">{data}</pre>
          )}
        </div>
      </div>
    </div>
  )
}

// ── CV Preview Modal ──────────────────────────────────────────────────────────

function CvModal({ app, onClose }: { app: Application; onClose: () => void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-surface)] border border-[var(--border-alt)] rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)] shrink-0">
          <div>
            <h3 className="text-[var(--text-primary)] font-bold flex items-center gap-2">
              <FileText size={16} className="text-blue-400" />
              {t('careersTracker.cvModal.titlePrefix')} {app.rol} {t('careersTracker.cvModal.in')} {app.empresa}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{t('careersTracker.cvModal.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {app.id && (
              <button
                onClick={() => downloadPdf(app.id, app.cvPdfFilename ?? `cv-${app.empresa}-${app.rol}.pdf`.replace(/\s+/g, '-').toLowerCase())}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-[var(--text-primary)] rounded-lg text-xs font-medium"
              >
                <Download size={13} /> {t('careersTracker.cvModal.downloadPdf')}
              </button>
            )}
            {app.cvHtml && (
              <button
                onClick={() => { navigator.clipboard.writeText(app.cvHtml!); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-[var(--text-secondary)] rounded-lg text-xs"
              >
                {copied ? <CheckCircle2 size={13} className="text-green-400" /> : <Copy size={13} />}
                {copied ? t('careersTracker.cvModal.copied') : t('careersTracker.cvModal.copyHtml')}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden rounded-b-2xl">
          {app.cvHtml
            ? <iframe srcDoc={app.cvHtml} className="w-full h-full bg-white" title="CV Preview" />
            : <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">{t('careersTracker.cvModal.noHtml')}</div>
          }
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface ApplyState {
  loading: boolean
  done: boolean
  step: string
  error: string | null
  app: Application | null
}

export default function CareersTracker() {
  const { t } = useTranslation()
  const POSTULAR_STEPS = [
    t('careersTracker.steps.reading'),
    t('careersTracker.steps.generating'),
    t('careersTracker.steps.converting'),
    t('careersTracker.steps.saving'),
  ]
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterEstado, setFilterEstado] = useState<string>('all')
  const [sortField, setSortField] = useState<keyof TrackerEntry>('fecha')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [llmProvider] = useState<LlmProvider>(() => loadLlmProvider())
  const [reportModal, setReportModal] = useState<string | null>(null)
  const [justClickedApply, setJustClickedApply] = useState<Record<string, boolean>>({})
  const [applyStates, setApplyStates] = useState<Record<string, ApplyState>>({})
  const [postularStepIdx, setPostularStepIdx] = useState<Record<string, number>>({})
  const [cvModal, setCvModal] = useState<Application | null>(null)
  const [cvLoadStates, setCvLoadStates] = useState<Record<string, boolean>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editEstado, setEditEstado] = useState<EstadoJob>('Evaluada')

  const { data: tracker = [], isLoading, isError: trackerError, error: trackerErrorObj } = useQuery<TrackerEntry[]>({
    queryKey: ['careers-tracker'],
    queryFn: () => api.get('/tracker').then(r => r.data),
    refetchInterval: 60000,
  })

  const formatQueryError = (err: unknown) => {
    const response = (err as { response?: { status?: number; data?: unknown } })?.response
    const status = response?.status ? `(${response.status}) ` : ''
    const body = response?.data ? JSON.stringify(response.data) : null
    const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    return `${status}${message || body || (err as Error)?.message || 'Error desconocido'}`
  }

  const updateMut = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) =>
      api.patch(`/tracker/${id}`, { estado }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['careers-tracker'] })
      qc.invalidateQueries({ queryKey: ['careers-stats'] })
      setEditingId(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/tracker/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['careers-tracker'] })
      qc.invalidateQueries({ queryKey: ['careers-stats'] })
    },
  })

  const handleDelete = (entry: TrackerEntry) => {
    if (!window.confirm(t('careersTracker.deleteConfirm', { empresa: entry.empresa || '—', rol: entry.rol || '—' }))) return
    deleteMut.mutate(entry.id)
  }

  const handleSort = (field: keyof TrackerEntry) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const SortIcon = ({ field }: { field: keyof TrackerEntry }) => {
    if (sortField !== field) return <ChevronDown size={12} className="text-[var(--text-faint)]" />
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-blue-400" />
      : <ChevronDown size={12} className="text-blue-400" />
  }

  // Número de orden estable basado en fecha (más reciente = número mayor)
  // Ignora UUIDs al calcular — usa solo IDs numéricos para la posición base

  const filtered = tracker
    .filter(e => {
      const matchSearch = search === '' ||
        e.empresa.toLowerCase().includes(search.toLowerCase()) ||
        e.rol.toLowerCase().includes(search.toLowerCase())
      const matchEstado = filterEstado === 'all' || e.estado === filterEstado
      return matchSearch && matchEstado
    })
    .sort((a, b) => {
      const va = a[sortField] ?? ''
      const vb = b[sortField] ?? ''
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
      if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp
      // Desempate: id mayor (más nuevo) primero
      return String(b.id).localeCompare(String(a.id), undefined, { numeric: true })
    })

  const handlePostular = async (entry: TrackerEntry) => {
    setApplyStates(p => ({ ...p, [entry.id]: { loading: true, done: false, step: POSTULAR_STEPS[0], error: null, app: null } }))
    let idx = 0
    const interval = setInterval(() => {
      idx = Math.min(idx + 1, POSTULAR_STEPS.length - 1)
      setApplyStates(p => ({ ...p, [entry.id]: { ...p[entry.id], step: POSTULAR_STEPS[idx] } }))
      setPostularStepIdx(p => ({ ...p, [entry.id]: idx }))
    }, 3500)
    try {
      const { data } = await api.post<{ ok: boolean; application: Application }>('/applications', {
        empresa: entry.empresa,
        rol: entry.rol,
        url: entry.url || '',
        reportSlug: entry.reportSlug,
        score: entry.score,
        ...(entry.idioma ? { idioma: entry.idioma } : {}),
        llmProvider,
      })
      clearInterval(interval)
      // Fetch full app (with cvHtml) for preview
      const { data: fullApp } = await api.get<Application>(`/applications/${data.application.id}`)
      setApplyStates(p => ({ ...p, [entry.id]: { loading: false, done: true, step: '', error: null, app: fullApp } }))
      qc.invalidateQueries({ queryKey: ['careers-tracker'] })
      qc.invalidateQueries({ queryKey: ['applications'] })
    } catch (err: unknown) {
      clearInterval(interval)
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('careersTracker.genericError')
      setApplyStates(p => ({ ...p, [entry.id]: { loading: false, done: false, step: '', error: msg, app: null } }))
    }
  }

  const handleVerCvExistente = async (entry: TrackerEntry) => {
    setCvLoadStates(p => ({ ...p, [entry.id]: true }))
    try {
      const { data: apps } = await api.get<Application[]>('/applications')
      const match = apps.find(a => a.empresa === entry.empresa && a.rol === entry.rol)
      if (match) {
        const { data: full } = await api.get<Application>(`/applications/${match.id}`)
        setCvModal(full)
      } else {
        // CV fue generado antes del módulo Postulaciones — ofrecer generar ahora
        const ok = window.confirm(t('careersTracker.noCvConfirm', { empresa: entry.empresa }))
        if (ok) handlePostular(entry)
      }
    } finally {
      setCvLoadStates(p => ({ ...p, [entry.id]: false }))
    }
  }

  const ThCell = ({ field, label }: { field: keyof TrackerEntry; label: string }) => (
    <th
      onClick={() => handleSort(field)}
      className="text-left px-4 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider cursor-pointer hover:text-[var(--text-primary)] transition-colors select-none"
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon field={field} />
      </span>
    </th>
  )

  return (
    <div className="space-y-5">
      {reportModal && (
        <ReportModal slug={reportModal} onClose={() => setReportModal(null)} />
      )}
      {cvModal && (
        <CvModal app={cvModal} onClose={() => setCvModal(null)} />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">{t('careersTracker.title')}</h2>
          <p className="text-[var(--text-tertiary)] mt-1">
            {t('careersTracker.subtitle', { filtered: filtered.length, total: tracker.length })}
          </p>
        </div>
      </div>

      {trackerError && (
        <div className="rounded-2xl border border-red-700 bg-red-900/20 p-4 text-sm text-red-200">
          <strong>{t('careersTracker.errorLoading')}</strong> {formatQueryError(trackerErrorObj)}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('careersTracker.searchPlaceholder')}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg pl-9 pr-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <select
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
            className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg pl-9 pr-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
          >
            <option value="all">{t('careersTracker.allStatuses')}</option>
            {ESTADOS.map(e => (
              <option key={e} value={e}>{ESTADO_CONFIG[e]?.label ?? e}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={24} className="animate-spin text-blue-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[var(--text-muted)] text-sm gap-2">
            {t('careersTracker.noResults')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50 border-b border-[var(--border-default)]">
                <tr>
                  <ThCell field="id" label={t('careersTracker.columns.id')} />
                  <ThCell field="fecha" label={t('careersTracker.columns.date')} />
                  <ThCell field="empresa" label={t('careersTracker.columns.company')} />
                  <ThCell field="rol" label={t('careersTracker.columns.role')} />
                  <ThCell field="score" label={t('careersTracker.columns.score')} />
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">{t('careersTracker.columns.salary')}</th>
                  <ThCell field="estado" label={t('careersTracker.columns.status')} />
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">{t('careersTracker.columns.actions')}</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map(entry => {
                  const applyState = applyStates[entry.id]
                  const isEditing = editingId === entry.id

                  return (
                    <tr key={entry.id} className="hover:bg-gray-800/30 transition-colors group">
                      <td className="px-4 py-3.5 text-[var(--text-muted)] text-sm font-mono">
                        <span title={entry.id}>
                          #{entry.id.length > 12 ? entry.id.slice(0, 8) + '…' : entry.id}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[var(--text-tertiary)] text-sm whitespace-nowrap">{entry.fecha}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[var(--text-primary)] text-sm font-medium">{entry.empresa}</span>
                          {entry.url && (
                            <a href={entry.url} target="_blank" rel="noopener noreferrer"
                              className="text-[var(--text-faint)] hover:text-blue-400 transition-colors">
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                        {entry.perfil_nombre && (
                          <span className="inline-block mt-1 text-[10px] text-[var(--text-muted)] bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] px-1.5 py-0.5 rounded" title="Perfil con el que se evaluó/postuló">
                            {entry.perfil_nombre}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-[var(--text-secondary)] text-sm max-w-[200px]">
                        <span className="truncate block">{entry.rol}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <ScoreBadge score={entry.score} />
                      </td>
                      <td className="px-4 py-3.5 text-sm">
                        {entry.salario_clp
                          ? <span className="text-emerald-400 font-medium">{entry.salario_clp}</span>
                          : <span className="text-[var(--text-faint)]">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={editEstado}
                              onChange={e => setEditEstado(e.target.value as EstadoJob)}
                              className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded text-xs text-[var(--text-primary)] px-2 py-1 focus:outline-none"
                            >
                              {ESTADOS.map(e => (
                                <option key={e} value={e}>{ESTADO_CONFIG[e]?.label ?? e}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => updateMut.mutate({ id: entry.id, estado: editEstado })}
                              className="text-green-400 hover:text-green-300"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => { setEditingId(entry.id); setEditEstado(entry.estado as EstadoJob) }}
                            className="cursor-pointer inline-flex"
                            title={t('careersTracker.changeStatusTitle')}
                          >
                            <EstadoBadge estado={entry.estado} />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 min-w-[190px]">
                        {applyState?.loading ? (
                          <div className="space-y-1.5 min-w-[170px]">
                            <div className="flex items-center gap-1.5 text-blue-400 text-xs">
                              <Loader2 size={11} className="animate-spin shrink-0" />
                              <span className="truncate max-w-[150px]">{applyState.step}</span>
                            </div>
                            <div className="h-1 bg-[var(--bg-surface-alt)] rounded-full overflow-hidden w-36">
                              <div
                                className="h-full bg-gradient-to-r from-blue-600 to-violet-600 rounded-full transition-all duration-700"
                                style={{ width: `${((postularStepIdx[entry.id] ?? 0) + 1) * 25}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Reporte */}
                            {entry.reportSlug && (
                              <button
                                onClick={() => setReportModal(entry.reportSlug!)}
                                className="p-1.5 text-[var(--text-faint)] hover:text-blue-400 transition-colors rounded"
                                title={t('careersTracker.viewReportTitle')}
                              >
                                <FileText size={13} />
                              </button>
                            )}

                            {/* CV ya generado (persistido o recién hecho) */}
                            {(entry.pdf || applyState?.done) ? (
                              <>
                                <button
                                  onClick={() => {
                                    if (applyState?.app) { setCvModal(applyState.app); return }
                                    handleVerCvExistente(entry)
                                  }}
                                  disabled={cvLoadStates[entry.id]}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-400 hover:text-[var(--text-primary)] rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                                >
                                  {cvLoadStates[entry.id] ? <Loader2 size={11} className="animate-spin" /> : <Eye size={11} />}
                                  {t('careersTracker.viewCv')}
                                </button>

                                {entry.url && (
                                  <a
                                    href={entry.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setJustClickedApply(p => ({ ...p, [entry.id]: true }))}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-600 hover:bg-green-500 text-[var(--text-primary)] rounded-lg text-xs font-bold transition-all"
                                  >
                                    <ArrowUpRight size={11} />
                                    {t('careersTracker.goApply')}
                                  </a>
                                )}

                                {/* La app no puede confirmar que la postulación se envió en el sitio
                                    externo — esto cierra el loop pidiéndole al usuario que lo marque
                                    él mismo apenas vuelve, en vez de que tenga que acordarse después. */}
                                {justClickedApply[entry.id] && entry.estado !== 'Postulada' && (
                                  <button
                                    onClick={() => { updateMut.mutate({ id: entry.id, estado: 'Postulada' }); setJustClickedApply(p => ({ ...p, [entry.id]: false })) }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-[var(--text-primary)] rounded-lg text-xs font-medium transition-all animate-pulse"
                                    title={t('careersTracker.alreadyAppliedTitle')}
                                  >
                                    <CheckCircle2 size={11} />
                                    {t('careersTracker.alreadyApplied')}
                                  </button>
                                )}

                                <button
                                  onClick={() => navigate('/postulaciones')}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-600/20 hover:bg-violet-600 text-violet-400 hover:text-[var(--text-primary)] rounded-lg text-xs font-medium transition-all"
                                >
                                  <Send size={11} />
                                  {t('careersTracker.applications')}
                                </button>

                                <button
                                  onClick={() => handlePostular(entry)}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg text-xs font-medium transition-all"
                                  title={t('careersTracker.regenerateTitle')}
                                >
                                  <Send size={11} />
                                  {t('careersTracker.regenerate')}
                                </button>
                              </>
                            ) : (
                              /* Sin CV aún — generar */
                              <button
                                onClick={() => handlePostular(entry)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-[var(--text-primary)] rounded-lg text-xs font-medium transition-all"
                                title={t('careersTracker.preparePostulationTitle')}
                              >
                                <Send size={11} />
                                {t('careersTracker.preparePostulation')}
                              </button>
                            )}
                          </div>
                        )}
                        {applyState?.error && (
                          <p className="text-red-400 text-xs mt-1 max-w-[260px] leading-snug" title={applyState.error}>
                            {applyState.error}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-3.5">
                        <button
                          onClick={() => handleDelete(entry)}
                          disabled={deleteMut.isPending}
                          className="p-1.5 text-[var(--text-faint)] hover:text-red-400 transition-colors"
                          title={t('careersTracker.deleteTitle')}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
