import { api } from '../../lib/api'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Briefcase, FileText, Send, Award, Clock, TrendingUp,
  Search, ChevronRight, Star, Download, Upload,
  HardDrive, CheckCircle2, AlertCircle, Bot, Eye, EyeOff, ExternalLink, Zap, Loader2, BookOpen,
} from 'lucide-react'
import GuideModal from '../../components/GuideModal'
import { loadLlmProvider, saveLlmProvider, type LlmProvider } from '../../lib/llmProvider'
import { loadApiKeys, saveApiKeys, type ApiKeyStore } from '../../lib/userApiKeys'
import { CareerStats, TrackerEntry, ESTADO_CONFIG, SCORE_COLOR } from '../../types/careers'
import { useTranslation } from '../../lib/i18n/LanguageContext'


function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType
  color: string; sub?: string
}) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[var(--text-tertiary)] text-sm">{label}</span>
        <Icon size={18} className={color} />
      </div>
      <p className="text-3xl font-bold text-[var(--text-primary)]">{value}</p>
      {sub && <p className="text-xs text-[var(--text-muted)] mt-1">{sub}</p>}
    </div>
  )
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[var(--text-faint)] text-sm">—</span>
  return (
    <span className={`text-sm font-bold ${SCORE_COLOR(score)}`}>
      {score.toFixed(1)}
    </span>
  )
}

const PROVIDERS: Array<{
  id: LlmProvider; label: string; badge: string; badgeColor: string
  placeholder: string; link: string; linkLabel: string; hint: string
}> = [
  { id: 'gemini', label: 'Gemini 1.5 Flash', badge: 'Gratis', badgeColor: 'bg-green-900 text-green-300', placeholder: 'AIzaSy...', link: 'https://aistudio.google.com/apikey', linkLabel: 'aistudio.google.com', hint: '1.500 req/día gratis' },
  { id: 'groq',   label: 'Groq / Llama 8B', badge: 'Gratis', badgeColor: 'bg-green-900 text-green-300', placeholder: 'gsk_...', link: 'https://console.groq.com', linkLabel: 'console.groq.com', hint: '14.400 req/día gratis' },
  { id: 'anthropic', label: 'Claude', badge: 'Pago', badgeColor: 'bg-yellow-900 text-yellow-300', placeholder: 'sk-ant-...', link: 'https://console.anthropic.com/settings/keys', linkLabel: 'console.anthropic.com', hint: 'Alta calidad, de pago' },
  { id: 'openai', label: 'OpenAI', badge: 'Pago', badgeColor: 'bg-yellow-900 text-yellow-300', placeholder: 'sk-proj-...', link: 'https://platform.openai.com/api-keys', linkLabel: 'platform.openai.com', hint: 'De pago' },
]

export default function CareersDashboard() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [restoreMsg, setRestoreMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [llmProvider, setLlmProvider] = useState<LlmProvider>(() => loadLlmProvider())
  const [apiKeys, setApiKeys] = useState<ApiKeyStore>(() => loadApiKeys())
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [keysSaved, setKeysSaved] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; ms?: number; model?: string; error?: string } | 'loading'>>({})
  const [showGuide, setShowGuide] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('guide') !== '1') return
    setShowGuide(true)
    setSearchParams(prev => { prev.delete('guide'); return prev }, { replace: true })
  }, [searchParams])

  const handleTestAi = async (providerId: string) => {
    setTestResults(r => ({ ...r, [providerId]: 'loading' }))
    try {
      const res = await api.post('/test-ai', {
        llmProvider: providerId,
        userApiKey: (apiKeys[providerId as keyof typeof apiKeys] || '').trim() || undefined,
      })
      setTestResults(r => ({ ...r, [providerId]: { ok: true, ms: res.data.ms, model: res.data.model } }))
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: string } }; message?: string })
      const msg = errData?.response?.data?.error || errData?.message || 'Error desconocido'
      setTestResults(r => ({ ...r, [providerId]: { ok: false, error: msg } }))
    }
  }

  const handleProviderChange = (provider: LlmProvider) => {
    saveLlmProvider(provider)
    setLlmProvider(provider)
  }

  const handleKeyChange = (provider: LlmProvider, value: string) => {
    setApiKeys(k => ({ ...k, [provider]: value }))
    setKeysSaved(false)
  }

  const handleSaveKeys = () => {
    const cleaned: ApiKeyStore = {}
    for (const p of PROVIDERS) {
      const v = (apiKeys[p.id] || '').trim()
      if (v) cleaned[p.id] = v
    }
    saveApiKeys(cleaned)
    setApiKeys(cleaned)
    setKeysSaved(true)
    setTimeout(() => setKeysSaved(false), 2500)
  }

  const { data: stats, isError: statsError, error: statsErrorObj } = useQuery<CareerStats>({
    queryKey: ['careers-stats'],
    queryFn: () => api.get('/stats').then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: tracker = [], isError: trackerError, error: trackerErrorObj } = useQuery<TrackerEntry[]>({
    queryKey: ['careers-tracker'],
    queryFn: () => api.get('/tracker').then(r => r.data),
  })

  const formatQueryError = (err: unknown) => {
    const response = (err as { response?: { status?: number; data?: unknown } })?.response
    const status = response?.status ? `(${response.status}) ` : ''
    const body = response?.data ? JSON.stringify(response.data) : null
    const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    return `${status}${message || body || (err as Error)?.message || 'Error desconocido'}`
  }

  const recent = [...tracker].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5)
  const activas = tracker.filter(e => !['Rechazada', 'Descartada', 'SKIP'].includes(e.estado))
  const pipeline = stats?.pipeline ?? 0

  const statCards = [
    {
      label: t('dashboard.stats.totalEvaluated'),
      value: stats?.total ?? 0,
      icon: Briefcase,
      color: 'text-blue-400',
      sub: t('dashboard.stats.activeSuffix', { count: activas.length }),
    },
    {
      label: t('dashboard.stats.inPipeline'),
      value: pipeline,
      icon: Clock,
      color: 'text-orange-400',
      sub: t('dashboard.stats.pendingEvaluation'),
    },
    {
      label: t('dashboard.stats.applied'),
      value: stats?.byStatus?.['Postulada'] ?? 0,
      icon: Send,
      color: 'text-yellow-400',
      sub: t('dashboard.stats.interviewSuffix', { count: stats?.byStatus?.['Entrevista'] ?? 0 }),
    },
    {
      label: t('dashboard.stats.avgScore'),
      value: stats?.avgScore ? `${stats.avgScore}/5` : '—',
      icon: Star,
      color: 'text-purple-400',
      sub: t('dashboard.stats.cvsGeneratedSuffix', { count: stats?.pdfs ?? 0 }),
    },
  ]

  // Pipeline visual (kanban-light)
  const statusFlow: Array<{ key: string; label: string }> = [
    { key: 'Evaluada', label: t('dashboard.funnelLabels.Evaluada') },
    { key: 'CV Generado', label: t('dashboard.funnelLabels.CV Generado') },
    { key: 'Postulada', label: t('dashboard.funnelLabels.Postulada') },
    { key: 'Entrevista', label: t('dashboard.funnelLabels.Entrevista') },
    { key: 'Oferta', label: t('dashboard.funnelLabels.Oferta') },
  ]

  return (
    <div className="space-y-6">
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Ergania</h2>
          <p className="text-[var(--text-tertiary)] mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-2 bg-[var(--bg-surface-alt)] hover:bg-[var(--border-alt)] text-[var(--text-primary)] px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-[var(--border-alt)]"
          >
            <BookOpen size={15} />
            {t('dashboard.learnToUse')}
          </button>
          <button
            onClick={() => navigate('/pipeline')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Zap size={16} />
            {t('dashboard.evaluateOffer')}
          </button>
        </div>
      </div>

      {/* Configuración de IA — temporalmente oculta, el servidor provee la key */}
      {false && <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <Bot size={18} className="text-blue-400" />
          <h3 className="text-[var(--text-primary)] font-semibold">Configuración de IA</h3>
          <span className="text-xs text-[var(--text-muted)] ml-1">— elige tu proveedor y agrega tu API key</span>
        </div>

        {/* Provider selector */}
        <div className="mb-5">
          <p className="text-xs text-[var(--text-tertiary)] mb-2 font-medium uppercase tracking-wider">Proveedor activo</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => handleProviderChange(p.id)}
                className={`flex flex-col items-start gap-1 p-3 rounded-lg border transition-all text-left ${
                  llmProvider === p.id
                    ? 'border-blue-500 bg-blue-950/40'
                    : 'border-[var(--border-alt)] bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{p.label}</span>
                  {llmProvider === p.id && <CheckCircle2 size={13} className="text-blue-400 ml-auto" />}
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${p.badgeColor}`}>{p.badge}</span>
                <span className="text-xs text-[var(--text-muted)]">{p.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* API Keys */}
        <div>
          <p className="text-xs text-[var(--text-tertiary)] mb-3 font-medium uppercase tracking-wider">API Keys (guardadas solo en tu navegador)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PROVIDERS.map(p => (
              <div key={p.id} className={`rounded-lg border p-3 transition-colors ${
                llmProvider === p.id ? 'border-blue-700 bg-blue-950/20' : 'border-[var(--border-default)] bg-gray-800/30'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">{p.label}</span>
                  <a href={p.link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                    <ExternalLink size={10} /> {p.linkLabel}
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showKey[p.id] ? 'text' : 'password'}
                    value={apiKeys[p.id] || ''}
                    onChange={e => handleKeyChange(p.id, e.target.value)}
                    placeholder={apiKeys[p.id] ? '••••••••••••••••' : p.placeholder}
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border-alt)] rounded-md px-2.5 py-1.5 pr-8 text-xs text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button type="button" onClick={() => setShowKey(s => ({ ...s, [p.id]: !s[p.id] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                    {showKey[p.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  {apiKeys[p.id] ? (
                    <p className="text-xs text-green-400 flex items-center gap-1">
                      <CheckCircle2 size={10} /> Key configurada
                    </p>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={() => handleTestAi(p.id)}
                    disabled={testResults[p.id] === 'loading'}
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-[var(--text-secondary)] disabled:opacity-50 transition-colors"
                  >
                    {testResults[p.id] === 'loading'
                      ? <><Loader2 size={10} className="animate-spin" /> Probando...</>
                      : <><Zap size={10} /> Probar</>
                    }
                  </button>
                </div>
                {testResults[p.id] && testResults[p.id] !== 'loading' && (() => {
                  const r = testResults[p.id] as { ok: boolean; ms?: number; model?: string; error?: string }
                  return r.ok
                    ? <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                        <CheckCircle2 size={10} /> OK · {r.model} · {r.ms}ms
                      </p>
                    : <p className="text-xs text-red-400 mt-1 flex items-start gap-1">
                        <AlertCircle size={10} className="mt-0.5 shrink-0" />
                        <span className="break-all">{r.error}</span>
                      </p>
                })()}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-[var(--text-muted)]">
              Deja vacío para usar la key del servidor. Tu propia key tiene prioridad.
            </p>
            <button
              onClick={handleSaveKeys}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                keysSaved ? 'bg-green-700 text-[var(--text-primary)]' : 'bg-blue-600 hover:bg-blue-500 text-[var(--text-primary)]'
              }`}
            >
              {keysSaved ? '✓ Guardado' : 'Guardar Keys'}
            </button>
          </div>
        </div>
      </div>}

      {(statsError || trackerError) && (
        <div className="rounded-2xl border border-red-700 bg-red-900/20 p-4 text-sm text-red-200">
          <strong>{t('dashboard.errorLoading')}</strong> {statsError ? formatQueryError(statsErrorObj) : formatQueryError(trackerErrorObj)}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Pipeline visual */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[var(--text-primary)] font-semibold">{t('dashboard.funnel')}</h3>
          <TrendingUp size={16} className="text-[var(--text-muted)]" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {statusFlow.map(({ key, label }) => {
            const count = stats?.byStatus?.[key] ?? 0
            const cfg = ESTADO_CONFIG[key]
            return (
              <div
                key={key}
                className={`flex-1 min-w-[100px] rounded-lg p-3 text-center cursor-pointer transition-all hover:scale-105 ${cfg?.bg ?? 'bg-[var(--bg-surface-alt)]'}`}
                onClick={() => navigate('/tracker')}
              >
                <p className={`text-2xl font-bold ${cfg?.color ?? 'text-[var(--text-primary)]'}`}>{count}</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">{label}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent evaluations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[var(--text-primary)] font-semibold flex items-center gap-2">
              <FileText size={16} className="text-blue-400" />
              {t('dashboard.recentEvaluations')}
            </h3>
            <button
              onClick={() => navigate('/tracker')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              {t('dashboard.seeAll')} <ChevronRight size={12} />
            </button>
          </div>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[var(--text-muted)] text-sm gap-2">
              <Briefcase size={24} className="text-[var(--text-faint)]" />
              {t('dashboard.noEvaluations')}
            </div>
          ) : (
            <div className="space-y-3">
              {recent.map(entry => {
                const cfg = ESTADO_CONFIG[entry.estado]
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)]/50 rounded-lg hover:bg-[var(--bg-surface-alt)] transition-colors cursor-pointer"
                    onClick={() => navigate('/tracker')}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[var(--text-primary)] text-sm font-medium truncate">{entry.empresa}</p>
                      <p className="text-[var(--text-tertiary)] text-xs truncate">{entry.rol}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-3 shrink-0">
                      <ScoreBadge score={entry.score} />
                      <span className={`text-xs px-2 py-0.5 rounded-full ${cfg?.bg} ${cfg?.color}`}>
                        {cfg?.label ?? entry.estado}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
          <h3 className="text-[var(--text-primary)] font-semibold mb-4 flex items-center gap-2">
            <Award size={16} className="text-purple-400" />
            {t('dashboard.quickActions.title')}
          </h3>
          <div className="space-y-2">
            {[
              {
                label: t('dashboard.quickActions.evaluateLabel'),
                desc: t('dashboard.quickActions.evaluateDesc'),
                icon: Search,
                color: 'text-blue-400',
                to: '/careers/pipeline',
              },
              {
                label: t('dashboard.quickActions.trackerLabel'),
                desc: t('dashboard.quickActions.trackerDesc'),
                icon: Briefcase,
                color: 'text-green-400',
                to: '/careers/tracker',
              },
              {
                label: t('dashboard.quickActions.portalsLabel'),
                desc: t('dashboard.quickActions.portalsDesc'),
                icon: TrendingUp,
                color: 'text-orange-400',
                to: '/careers/portals',
              },
              {
                label: t('dashboard.quickActions.profileLabel'),
                desc: t('dashboard.quickActions.profileDesc'),
                icon: FileText,
                color: 'text-purple-400',
                to: '/careers/profile',
              },
            ].map(({ label, desc, icon: Icon, color, to }) => (
              <button
                key={label}
                onClick={() => navigate(to)}
                className="w-full flex items-center gap-3 p-3 bg-[var(--bg-surface-alt)]/50 hover:bg-[var(--bg-surface-alt)] rounded-lg text-left transition-colors group"
              >
                <Icon size={18} className={color} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
                  <p className="text-xs text-[var(--text-muted)]">{desc}</p>
                </div>
                <ChevronRight size={14} className="text-[var(--text-faint)] group-hover:text-[var(--text-tertiary)] transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Backup / Persistencia */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <HardDrive size={18} className="text-[var(--text-tertiary)] mt-0.5 shrink-0" />
            <div>
              <h3 className="text-[var(--text-primary)] font-semibold text-sm">{t('dashboard.backup.title')}</h3>
              <p className="text-[var(--text-tertiary)] text-xs mt-1 max-w-lg">
                {t('dashboard.backup.desc')}
              </p>
              {restoreMsg && (
                <div className={`flex items-center gap-2 mt-2 text-xs ${restoreMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {restoreMsg.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {restoreMsg.text}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                try {
                  const response = await api.get('/backup', { responseType: 'blob' })
                  const contentDisposition = response.headers['content-disposition'] || ''
                  const match = contentDisposition.match(/filename="?([^";]+)"?/) 
                  const filename = match?.[1] || `career-ops-backup-${new Date().toISOString().split('T')[0]}.json`
                  const url = URL.createObjectURL(response.data)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = filename
                  document.body.appendChild(link)
                  link.click()
                  link.remove()
                  URL.revokeObjectURL(url)
                } catch (err: unknown) {
                  setRestoreMsg({ ok: false, text: `${t('dashboard.backup.downloadError')} ${(err as Error)?.message || ''}` })
                  setTimeout(() => setRestoreMsg(null), 5000)
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--border-alt)] hover:bg-[var(--text-faint)] text-[var(--text-primary)] rounded-lg text-xs font-medium transition-colors"
            >
              <Download size={13} /> {t('dashboard.backup.download')}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--border-alt)] hover:bg-[var(--text-faint)] text-[var(--text-primary)] rounded-lg text-xs font-medium transition-colors"
            >
              <Upload size={13} /> {t('dashboard.backup.restore')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  const text = await file.text()
                  const json = JSON.parse(text)
                  await api.post('/restore', json)
                  setRestoreMsg({ ok: true, text: t('dashboard.backup.restoreSuccess') })
                } catch {
                  setRestoreMsg({ ok: false, text: t('dashboard.backup.restoreError') })
                }
                e.target.value = ''
                setTimeout(() => setRestoreMsg(null), 5000)
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
