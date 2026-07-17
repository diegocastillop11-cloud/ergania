import { api } from '../../lib/api'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Target, Plus, X, Loader2, Sparkles, Save, CheckCircle2,
  Search, Tag, Ban, ListFilter, RefreshCw,
} from 'lucide-react'
import { PortalsConfig } from '../../types/careers'
import PerfilTabs from '../../components/careers/PerfilTabs'
import { useTranslation } from '../../lib/i18n/LanguageContext'


// ── Editable tag list ─────────────────────────────────────────────────────────

function TagList({
  items, onChange, placeholder, colorClass,
}: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
  colorClass: string
}) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')

  const add = () => {
    const val = input.trim()
    if (val && !items.includes(val)) onChange([...items, val])
    setInput('')
  }

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 min-h-[36px]">
        {items.map((item, i) => (
          <span key={i} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium max-w-full ${colorClass}`}>
            <span className="truncate min-w-0" title={item}>{item}</span>
            <button onClick={() => remove(i)} className="hover:opacity-70 shrink-0">
              <X size={11} />
            </button>
          </span>
        ))}
        {items.length === 0 && (
          <span className="text-xs text-[var(--text-faint)] italic">{t('careersBusqueda.noItems')}</span>
        )}
      </div>
      <div className="flex gap-2 min-w-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-1.5 text-[var(--text-primary)] text-xs focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={add}
          disabled={!input.trim()}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-[var(--text-primary)] rounded-lg text-xs disabled:opacity-40"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Query row ─────────────────────────────────────────────────────────────────

function QueryRow({
  q, onChange, onRemove,
}: {
  q: { name: string; query: string; enabled: boolean }
  onChange: (updated: typeof q) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2 bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg p-2.5">
      <button
        onClick={() => onChange({ ...q, enabled: !q.enabled })}
        className={`shrink-0 w-8 h-4 rounded-full transition-colors ${q.enabled ? 'bg-blue-600' : 'bg-gray-600'} relative`}
      >
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${q.enabled ? 'left-4' : 'left-0.5'}`} />
      </button>
      <input
        value={q.name}
        onChange={e => onChange({ ...q, name: e.target.value })}
        placeholder={t('careersBusqueda.namePlaceholder')}
        className="w-28 bg-transparent text-xs text-[var(--text-secondary)] focus:outline-none"
      />
      <span className="text-[var(--text-faint)] text-xs">→</span>
      <input
        value={q.query}
        onChange={e => onChange({ ...q, query: e.target.value })}
        placeholder={t('careersBusqueda.queryPlaceholder')}
        className="flex-1 bg-transparent text-xs text-[var(--text-tertiary)] focus:outline-none focus:text-[var(--text-primary)]"
      />
      <button onClick={onRemove} className="shrink-0 text-[var(--text-faint)] hover:text-red-400">
        <X size={13} />
      </button>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function CareersBusqueda() {
  const { t } = useTranslation()
  const qc = useQueryClient()

  // ── Cargar datos
  const { data: portals, isLoading: loadingPortals } = useQuery<PortalsConfig>({
    queryKey: ['portals'],
    queryFn: () => api.get('/portals').then(r => r.data),
  })
  const { data: profile, isLoading: loadingProfile } = useQuery<Record<string, unknown>>({
    queryKey: ['profile'],
    queryFn: () => api.get('/profile').then(r => r.data),
  })

  // ── Estado local editable
  const [roles, setRoles] = useState<string[] | null>(null)
  const [kwPos, setKwPos] = useState<string[] | null>(null)
  const [kwNeg, setKwNeg] = useState<string[] | null>(null)
  const [queries, setQueries] = useState<Array<{ name: string; query: string; enabled: boolean }> | null>(null)
  const [saved, setSaved] = useState(false)
  const [suggestions, setSuggestions] = useState<{
    roles?: string[]; keywords_positivas?: string[]; keywords_negativas?: string[]
    queries?: Array<{ nombre: string; query: string; habilitada: boolean }>; razon?: string
  } | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)

  // Inicializar desde datos cargados
  const getTargetRoles = (): string[] => {
    if (roles !== null) return roles
    const tr = (profile?.target_roles as Record<string, string[]>) || {}
    return [...(tr.primary || []), ...(tr.secondary || [])]
  }
  const getKwPos = (): string[] => {
    if (kwPos !== null) return kwPos
    return portals?.title_filter?.positive || []
  }
  const getKwNeg = (): string[] => {
    if (kwNeg !== null) return kwNeg
    return portals?.title_filter?.negative || []
  }
  const getQueries = () => {
    if (queries !== null) return queries
    return (portals?.search_queries || []).map(q => ({ name: q.name, query: q.query, enabled: q.enabled }))
  }

  // ── Guardar
  const saveMut = useMutation({
    mutationFn: async () => {
      const currentRoles = getTargetRoles()
      const currentPortals = portals!

      // Guardar roles en profile
      const prof = profile as Record<string, unknown>
      const updatedProfile = {
        ...prof,
        target_roles: { primary: currentRoles, secondary: [] },
      }
      await api.put('/profile', updatedProfile)

      // Guardar keywords + queries en portals
      const updatedPortals: PortalsConfig = {
        ...currentPortals,
        title_filter: {
          ...currentPortals.title_filter,
          positive: getKwPos(),
          negative: getKwNeg(),
        },
        search_queries: getQueries().map(q => ({ name: q.name, query: q.query, enabled: q.enabled })),
      }
      await api.put('/portals', updatedPortals)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portals'] })
      qc.invalidateQueries({ queryKey: ['profile'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  // ── Sugerencias IA
  const suggest = async () => {
    setSuggesting(true)
    setSuggestions(null)
    setSuggestError(null)
    try {
      const { data } = await api.post('/suggest-targets')
      setSuggestions(data.suggestions)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      const msg = axiosErr?.response?.data?.error
      setSuggestError(msg || t('careersBusqueda.suggestions.genericError'))
    }
    finally { setSuggesting(false) }
  }

  const applySuggestion = (field: 'roles' | 'kwPos' | 'kwNeg', items: string[]) => {
    const setter = field === 'roles' ? setRoles : field === 'kwPos' ? setKwPos : setKwNeg
    const current = field === 'roles' ? getTargetRoles() : field === 'kwPos' ? getKwPos() : getKwNeg()
    const merged = [...new Set([...current, ...items])]
    setter(merged)
  }

  const applyAllSuggestions = () => {
    if (!suggestions) return
    if (suggestions.roles?.length)             applySuggestion('roles',  suggestions.roles)
    if (suggestions.keywords_positivas?.length) applySuggestion('kwPos', suggestions.keywords_positivas)
    if (suggestions.keywords_negativas?.length) applySuggestion('kwNeg', suggestions.keywords_negativas)
    if (suggestions.queries?.length) {
      const newQueries = suggestions.queries.map(q => ({ name: q.nombre, query: q.query, enabled: q.habilitada }))
      setQueries([...getQueries(), ...newQueries.filter(nq => !getQueries().some(eq => eq.query === nq.query))])
    }
    setSuggestions(null)
  }

  const addEmptyQuery = () => {
    setQueries([...getQueries(), { name: '', query: '', enabled: true }])
  }

  const isLoading = loadingPortals || loadingProfile

  // Detecta si el config está vacío
  const isConfigEmpty =
    !loadingPortals &&
    (portals?.title_filter?.positive ?? []).length === 0 &&
    (portals?.search_queries ?? []).length === 0

  // Auto-sugerir con IA si el config está vacío (solo una vez)
  const [autoTriggered, setAutoTriggered] = useState(false)
  useEffect(() => {
    if (isConfigEmpty && !autoTriggered && !suggesting) {
      setAutoTriggered(true)
      suggest()
    }
  }, [isConfigEmpty]) // eslint-disable-line

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-muted)]">
        <Loader2 size={24} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl w-full min-w-0">
      <PerfilTabs />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Target size={22} className="text-blue-400" /> {t('careersBusqueda.title')}
          </h2>
          <p className="text-[var(--text-tertiary)] mt-1 text-sm">
            {t('careersBusqueda.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={suggest}
            disabled={suggesting}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-[var(--text-primary)] rounded-xl font-medium text-sm"
          >
            {suggesting
              ? <><Loader2 size={14} className="animate-spin" /> {t('careersBusqueda.analyzing')}</>
              : <><Sparkles size={14} /> {t('careersBusqueda.analyzeWithAi')}</>
            }
          </button>
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-[var(--text-primary)] rounded-xl font-medium text-sm"
          >
            {saveMut.isPending ? <Loader2 size={15} className="animate-spin" /> :
             saved ? <CheckCircle2 size={15} className="text-green-300" /> : <Save size={15} />}
            {saveMut.isPending ? t('careersBusqueda.saving') : saved ? t('careersBusqueda.saved') : t('careersBusqueda.saveChanges')}
          </button>
        </div>
      </div>

      {/* Grid principal */}
      <div className="grid gap-5 lg:grid-cols-2 min-w-0">
        {/* Cargos objetivo */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5 min-w-0">
          <div className="flex items-center gap-2 mb-4 min-w-0">
            <Search size={15} className="text-blue-400 shrink-0" />
            <h3 className="text-[var(--text-primary)] font-semibold text-sm truncate">{t('careersBusqueda.targetRoles.title')}</h3>
            <span className="ml-auto text-xs text-[var(--text-muted)] shrink-0 whitespace-nowrap pl-1">{t('careersBusqueda.targetRoles.configuredCount', { count: getTargetRoles().length })}</span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            {t('careersBusqueda.targetRoles.desc')}
          </p>
          <TagList
            items={getTargetRoles()}
            onChange={setRoles}
            placeholder={t('careersBusqueda.targetRoles.placeholder')}
            colorClass="bg-blue-900/40 text-blue-300 border border-blue-800/50"
          />
        </div>

        {/* Keywords positivas */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5 min-w-0">
          <div className="flex items-center gap-2 mb-4 min-w-0">
            <Tag size={15} className="text-green-400 shrink-0" />
            <h3 className="text-[var(--text-primary)] font-semibold text-sm truncate">{t('careersBusqueda.skills.title')}</h3>
            <span className="ml-auto text-xs text-[var(--text-muted)] shrink-0 whitespace-nowrap pl-1">{t('careersBusqueda.skills.configuredCount', { count: getKwPos().length })}</span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            {t('careersBusqueda.skills.desc')}
          </p>
          <TagList
            items={getKwPos()}
            onChange={setKwPos}
            placeholder={t('careersBusqueda.skills.placeholder')}
            colorClass="bg-green-900/40 text-green-300 border border-green-800/50"
          />
        </div>

        {/* Keywords negativas */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5 min-w-0">
          <div className="flex items-center gap-2 mb-4 min-w-0">
            <Ban size={15} className="text-red-400 shrink-0" />
            <h3 className="text-[var(--text-primary)] font-semibold text-sm truncate">{t('careersBusqueda.exclude.title')}</h3>
            <span className="ml-auto text-xs text-[var(--text-muted)] shrink-0 whitespace-nowrap pl-1">{t('careersBusqueda.exclude.configuredCount', { count: getKwNeg().length })}</span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            {t('careersBusqueda.exclude.desc')}
          </p>
          <TagList
            items={getKwNeg()}
            onChange={setKwNeg}
            placeholder={t('careersBusqueda.exclude.placeholder')}
            colorClass="bg-red-900/40 text-red-300 border border-red-800/50"
          />
        </div>

        {/* Consultas de búsqueda */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ListFilter size={15} className="text-violet-400" />
            <h3 className="text-[var(--text-primary)] font-semibold text-sm">{t('careersBusqueda.queries.title')}</h3>
            <span className="text-xs text-[var(--text-muted)] ml-1">{t('careersBusqueda.queries.activeCount', { count: getQueries().length })}</span>
            <button
              onClick={addEmptyQuery}
              className="ml-auto flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <Plus size={12} /> {t('careersBusqueda.queries.add')}
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {getQueries().map((q, i) => (
              <QueryRow
                key={i}
                q={q}
                onChange={updated => {
                  const arr = [...getQueries()]
                  arr[i] = updated
                  setQueries(arr)
                }}
                onRemove={() => setQueries(getQueries().filter((_, idx) => idx !== i))}
              />
            ))}
            {getQueries().length === 0 && (
              <p className="text-xs text-[var(--text-faint)] text-center py-4">
                {t('careersBusqueda.queries.empty')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Sugerencias IA (aparece al hacer clic en el botón del header) */}
      {(suggesting || suggestions || suggestError) && (
      <div className="bg-[var(--bg-surface)] border border-amber-900/40 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={15} className="text-amber-400" />
          <h3 className="text-[var(--text-primary)] font-semibold text-sm">{t('careersBusqueda.suggestions.title')}</h3>
        </div>

        {suggesting && (
          <div className="flex items-center gap-3 text-amber-400 text-sm">
            <Loader2 size={18} className="animate-spin shrink-0" />
            {t('careersBusqueda.suggestions.analyzing')}
          </div>
        )}

        {suggestError && !suggesting && (
          <div className="rounded-lg bg-red-950/40 border border-red-800/50 px-4 py-3 text-sm text-red-300 space-y-1">
            <p className="font-medium">{t('careersBusqueda.suggestions.errorTitle')}</p>
            <p className="text-red-400 text-xs">{suggestError}</p>
            <button
              onClick={suggest}
              className="mt-2 text-xs text-red-300 hover:text-[var(--text-primary)] underline"
            >
              {t('careersBusqueda.suggestions.retry')}
            </button>
          </div>
        )}

        {suggestions && (
          <div className="space-y-4">
            {suggestions.razon && (
              <p className="text-sm text-[var(--text-secondary)] italic border-l-2 border-amber-500 pl-3">
                {suggestions.razon}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Roles sugeridos */}
              {(suggestions.roles?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] mb-2 flex items-center gap-1">
                    <Search size={11} className="text-blue-400" /> {t('careersBusqueda.suggestions.suggestedRoles')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.roles!.map((r, i) => (
                      <span key={i} className="text-xs bg-blue-900/40 text-blue-300 border border-blue-800/50 px-2 py-0.5 rounded-lg">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Keywords positivas */}
              {(suggestions.keywords_positivas?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] mb-2 flex items-center gap-1">
                    <Tag size={11} className="text-green-400" /> {t('careersBusqueda.suggestions.suggestedSkills')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.keywords_positivas!.map((k, i) => (
                      <span key={i} className="text-xs bg-green-900/40 text-green-300 border border-green-800/50 px-2 py-0.5 rounded-lg">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Queries */}
              {(suggestions.queries?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] mb-2 flex items-center gap-1">
                    <ListFilter size={11} className="text-violet-400" /> {t('careersBusqueda.suggestions.suggestedQueries')}
                  </p>
                  <div className="space-y-1">
                    {suggestions.queries!.map((q, i) => (
                      <div key={i} className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-surface-alt)] rounded px-2 py-1">
                        <span className="text-[var(--text-secondary)] font-medium">{q.nombre}</span>
                        <span className="text-[var(--text-faint)] mx-1">→</span>
                        <span className="font-mono text-violet-300">{q.query}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-[var(--border-default)]">
              <button
                onClick={applyAllSuggestions}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-[var(--text-primary)] rounded-lg text-xs font-medium"
              >
                <CheckCircle2 size={13} /> {t('careersBusqueda.suggestions.applyAll')}
              </button>
              <button
                onClick={suggest}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-[var(--text-secondary)] rounded-lg text-xs"
              >
                <RefreshCw size={13} /> {t('careersBusqueda.suggestions.regenerate')}
              </button>
              <button
                onClick={() => setSuggestions(null)}
                className="text-xs text-[var(--text-faint)] hover:text-[var(--text-tertiary)] px-2"
              >
                {t('careersBusqueda.suggestions.discard')}
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Tip final */}
      <div className="p-4 bg-blue-950/30 border border-blue-900/40 rounded-xl text-xs text-blue-300">
        <strong>{t('careersBusqueda.finalTip.label')}</strong> {t('careersBusqueda.finalTip.part1')}{' '}
        <strong>{t('careersBusqueda.finalTip.scanner')}</strong> {t('careersBusqueda.finalTip.part2')}
      </div>
    </div>
  )
}
