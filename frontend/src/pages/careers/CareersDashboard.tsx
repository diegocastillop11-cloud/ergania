import { api } from '../../lib/api'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Briefcase, FileText, Send, Award, Clock, TrendingUp,
  Search, ChevronRight, Star,
  CheckCircle2, AlertCircle, Bot, Eye, EyeOff, ExternalLink, Zap, Loader2, BookOpen,
} from 'lucide-react'
import GuideModal from '../../components/GuideModal'
import AndroidAppBanner from '../../components/AndroidAppBanner'
import DemoVideoBanner from '../../components/DemoVideoBanner'
import EvaluationLimitBanner from '../../components/careers/EvaluationLimitBanner'
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

  // Pipeline visual (barra única en vez de 5 tarjetas clickeables — Variante B)
  const statusFlow: Array<{ key: string; label: string; barColor: string }> = [
    { key: 'Evaluada', label: t('dashboard.funnelLabels.Evaluada'), barColor: 'bg-blue-500' },
    { key: 'CV Generado', label: t('dashboard.funnelLabels.CV Generado'), barColor: 'bg-cyan-500' },
    { key: 'Postulada', label: t('dashboard.funnelLabels.Postulada'), barColor: 'bg-yellow-500' },
    { key: 'Entrevista', label: t('dashboard.funnelLabels.Entrevista'), barColor: 'bg-purple-500' },
    { key: 'Oferta', label: t('dashboard.funnelLabels.Oferta'), barColor: 'bg-green-500' },
  ]
  const funnelTotal = statusFlow.reduce((sum, { key }) => sum + (stats?.byStatus?.[key] ?? 0), 0)

  // Acción sugerida: si aún no hay nada en el tracker, priorizar la primera evaluación;
  // si ya hay actividad, sugerir sumar más fuentes de ofertas al pipeline.
  const suggestedAction = tracker.length === 0
    ? {
        label: t('dashboard.quickActions.evaluateLabel'),
        desc: t('dashboard.quickActions.evaluateDesc'),
        icon: Search,
        color: 'text-blue-400',
        to: '/careers/pipeline',
      }
    : {
        label: t('dashboard.quickActions.portalsLabel'),
        desc: t('dashboard.quickActions.portalsDesc'),
        icon: TrendingUp,
        color: 'text-orange-400',
        to: '/careers/portals',
      }

  return (
    <div className="space-y-6">
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}

      <AndroidAppBanner />

      <DemoVideoBanner />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Ergania</h2>
          <p className="text-[var(--text-tertiary)] mt-1">{t('dashboard.subtitle')}</p>
          <button
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm font-medium mt-2 transition-colors"
          >
            <BookOpen size={13} />
            {t('dashboard.learnToUse')}
          </button>
          <div className="mt-3"><EvaluationLimitBanner /></div>
        </div>
        <button
          onClick={() => navigate('/pipeline')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shrink-0"
        >
          <Zap size={16} />
          {t('dashboard.evaluateOffer')}
        </button>
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

      {/* Pipeline visual — una sola barra en vez de 5 tarjetas */}
      <div
        className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5 cursor-pointer hover:border-[var(--border-alt)] transition-colors"
        onClick={() => navigate('/tracker')}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[var(--text-primary)] font-semibold">{t('dashboard.funnel')}</h3>
          <TrendingUp size={16} className="text-[var(--text-muted)]" />
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-[var(--bg-surface-alt)]">
          {funnelTotal === 0 ? null : statusFlow.map(({ key, barColor }) => {
            const count = stats?.byStatus?.[key] ?? 0
            if (count === 0) return null
            return <div key={key} className={barColor} style={{ width: `${(count / funnelTotal) * 100}%` }} />
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
          {statusFlow.map(({ key, label, barColor }) => {
            const count = stats?.byStatus?.[key] ?? 0
            return (
              <div key={key} className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                <span className={`w-2 h-2 rounded-full ${barColor}`} />
                {label} <span className="font-semibold text-[var(--text-primary)]">{count}</span>
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

        {/* Acción sugerida — antes eran 4 botones fijos, el resto ya vive en el sidebar */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
          <h3 className="text-[var(--text-primary)] font-semibold mb-4 flex items-center gap-2">
            <Award size={16} className="text-purple-400" />
            {t('dashboard.quickActions.titleSuggested')}
          </h3>
          <button
            onClick={() => navigate(suggestedAction.to)}
            className="w-full flex items-center gap-3 p-3 bg-[var(--bg-surface-alt)]/50 hover:bg-[var(--bg-surface-alt)] rounded-lg text-left transition-colors group"
          >
            <suggestedAction.icon size={18} className={suggestedAction.color} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">{suggestedAction.label}</p>
              <p className="text-xs text-[var(--text-muted)]">{suggestedAction.desc}</p>
            </div>
            <ChevronRight size={14} className="text-[var(--text-faint)] group-hover:text-[var(--text-tertiary)] transition-colors" />
          </button>
        </div>
      </div>
    </div>
  )
}
