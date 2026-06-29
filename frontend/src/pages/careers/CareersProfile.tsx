import { api } from '../../lib/api'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  User, FileText, Save, Loader2, Check, Edit3,
  EyeOff, ChevronDown, ChevronUp, AlertCircle, MessageSquare,
  Linkedin, Copy, CheckCircle2, Sparkles, Upload,
} from 'lucide-react'
import { loadLlmProvider } from '../../lib/llmProvider'
import { getKeyForProvider } from '../../lib/userApiKeys'


interface ProfileData {
  candidate?: {
    full_name?: string
    email?: string
    phone?: string
    location?: string
    linkedin?: string
    github?: string
    portfolio_url?: string
  }
  target_roles?: {
    primary?: string[]
    archetypes?: Array<{ name: string; level: string; fit: string }>
  }
  narrative?: {
    headline?: string
    exit_story?: string
    superpowers?: string[]
  }
  compensation?: {
    target_range?: string
    currency?: string
    minimum?: string
    location_flexibility?: string
  }
  location?: {
    country?: string
    city?: string
    timezone?: string
    visa_status?: string
  }
  cv_instructions?: string
}

function Section({
  title, icon: Icon, defaultOpen = true, children
}: {
  title: string; icon: React.ElementType; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon size={18} className="text-blue-400" />
          <h3 className="text-white font-semibold">{title}</h3>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}

function Field({
  label, value, onChange, type = 'text', placeholder = ''
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />
    </div>
  )
}

export default function CareersProfile() {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)
  const [cvSaved, setCvSaved] = useState(false)
  const [cvEdit, setCvEdit] = useState(false)
  const [cvContent, setCvContent] = useState('')
  const [profile, setProfile] = useState<ProfileData>({})

  const { data: profileData, isLoading: profileLoading } = useQuery<ProfileData>({
    queryKey: ['careers-profile'],
    queryFn: () => api.get('/profile').then(r => r.data),
  })

  const { data: cvData, isLoading: cvLoading } = useQuery<{ content: string }>({
    queryKey: ['careers-cv'],
    queryFn: () => api.get('/cv').then(r => r.data),
  })

  useEffect(() => {
    if (profileData) setProfile(profileData)
  }, [profileData])

  useEffect(() => {
    if (cvData?.content) setCvContent(cvData.content)
  }, [cvData])

  const saveMut = useMutation({
    mutationFn: (data: ProfileData) => api.put('/profile', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['careers-profile'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const cvMut = useMutation({
    mutationFn: (content: string) => api.put('/cv', { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['careers-cv'] })
      setCvSaved(true)
      setTimeout(() => setCvSaved(false), 2500)
      setCvEdit(false)
    },
  })

  const set = (path: string[], value: string) => {
    setProfile(prev => {
      const next = { ...prev } as Record<string, unknown>
      let current = next
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) current[path[i]] = {}
        current = current[path[i]] as Record<string, unknown>
      }
      current[path[path.length - 1]] = value
      return next as ProfileData
    })
  }

  const c = profile.candidate || {}
  const tr = profile.target_roles || {}
  const comp = profile.compensation || {}
  const loc = profile.location || {}
  const narr = profile.narrative || {}

  // ── Import CV state ───────────────────────────────────────────────────────
  const [cvImporting, setCvImporting] = useState(false)
  const [cvImportError, setCvImportError] = useState('')
  const [cvImportSuccess, setCvImportSuccess] = useState(false)

  const handleImportCv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setCvImporting(true)
    setCvImportError('')
    setCvImportSuccess(false)
    try {
      const provider = loadLlmProvider()
      const userApiKey = getKeyForProvider(provider)
      const formData = new FormData()
      formData.append('cv', file)
      formData.append('llmProvider', provider)
      if (userApiKey) formData.append('userApiKey', userApiKey)

      const { data } = await api.post('/parse-cv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const d = data.data || {}

      const newProfile: ProfileData = {
        ...profileData,
        candidate: { ...profileData?.candidate, ...Object.fromEntries(Object.entries(d.candidate || {}).filter(([, v]) => v)) },
        narrative: {
          ...profileData?.narrative,
          ...(d.narrative?.headline ? { headline: d.narrative.headline } : {}),
          ...(d.narrative?.exit_story ? { exit_story: d.narrative.exit_story } : {}),
          ...(d.narrative?.superpowers?.length ? { superpowers: d.narrative.superpowers } : {}),
        },
        target_roles: {
          ...profileData?.target_roles,
          ...(d.target_roles?.primary?.length ? { primary: d.target_roles.primary } : {}),
        },
        compensation: { ...profileData?.compensation, ...Object.fromEntries(Object.entries(d.compensation || {}).filter(([, v]) => v)) },
        location: { ...profileData?.location, ...Object.fromEntries(Object.entries(d.location || {}).filter(([, v]) => v)) },
      }
      setProfile(newProfile)

      if (d.cv_markdown) setCvContent(d.cv_markdown)

      // Guardar perfil y CV automáticamente
      await api.put('/profile', newProfile)
      if (d.cv_markdown) await api.put('/cv', { content: d.cv_markdown })

      // Guardar config de búsqueda si el CV la trae
      const sc = d.search_config
      if (sc && (sc.keywords_positive?.length || sc.keywords_negative?.length || sc.search_queries?.length)) {
        const { data: portalsData } = await api.get('/portals')
        const updatedPortals = {
          ...portalsData,
          title_filter: {
            ...portalsData?.title_filter,
            ...(sc.keywords_positive?.length ? { positive: sc.keywords_positive } : {}),
            ...(sc.keywords_negative?.length ? { negative: sc.keywords_negative } : {}),
          },
          ...(sc.search_queries?.length ? {
            search_queries: sc.search_queries.map((q: { name: string; query: string }) => ({
              name: q.name, query: q.query, enabled: true,
            })),
          } : {}),
        }
        await api.put('/portals', updatedPortals)
      }

      qc.invalidateQueries({ queryKey: ['careers-profile'] })
      qc.invalidateQueries({ queryKey: ['careers-cv'] })
      qc.invalidateQueries({ queryKey: ['portals'] })
      qc.invalidateQueries({ queryKey: ['profile'] })

      setCvImportSuccess(true)
      setTimeout(() => setCvImportSuccess(false), 4000)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string }
      setCvImportError(e?.response?.data?.error || e?.message || 'Error al importar CV')
    } finally {
      setCvImporting(false)
    }
  }

  // ── LinkedIn Optimizer state ──────────────────────────────────────────────
  const [liLoading, setLiLoading] = useState(false)
  const [liError, setLiError] = useState('')
  const [liResult, setLiResult] = useState<{
    headline?: string
    about?: string
    skills?: string[]
    experience_tips?: Array<{ empresa: string; sugerencia: string }>
    featured_ideas?: string[]
    open_to_work?: string
    keywords_to_include?: string[]
  } | null>(null)
  const [liCopied, setLiCopied] = useState<string | null>(null)

  const copyLi = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setLiCopied(key)
    setTimeout(() => setLiCopied(null), 2000)
  }

  const generateLinkedin = async () => {
    setLiLoading(true)
    setLiError('')
    setLiResult(null)
    try {
      const provider = loadLlmProvider()
      const userApiKey = getKeyForProvider(provider)
      const { data } = await api.post('/linkedin-optimize', {
        llmProvider: provider,
        ...(userApiKey ? { userApiKey } : {}),
      })
      setLiResult(data.result)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; message?: string } }; message?: string }
      const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Error al generar optimización'
      console.error('[linkedin-optimize] error:', msg, err)
      setLiError(msg)
    } finally {
      setLiLoading(false)
    }
  }

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-blue-400" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Perfil & CV</h2>
          <p className="text-gray-400 mt-1">Datos personales que la IA usa para evaluar y personalizar tu CV</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {cvImportSuccess && (
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <CheckCircle2 size={14} /> CV importado — revisa los campos
            </span>
          )}
          {saved && (
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <Check size={14} /> Perfil guardado
            </span>
          )}
          <label className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${cvImporting ? 'bg-purple-800 opacity-60 cursor-not-allowed' : 'bg-purple-700 hover:bg-purple-600 text-white'}`}>
            {cvImporting ? (
              <><Loader2 size={14} className="animate-spin" /> Analizando CV...</>
            ) : (
              <><Upload size={14} /> Importar CV con IA</>
            )}
            <input
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              className="hidden"
              disabled={cvImporting}
              onChange={handleImportCv}
            />
          </label>
          <button
            onClick={() => saveMut.mutate(profile)}
            disabled={saveMut.isPending}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            {saveMut.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Guardando...</>
            ) : (
              <><Save size={14} /> Guardar Perfil</>
            )}
          </button>
        </div>
      </div>

      <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 flex gap-3">
        <AlertCircle size={18} className="text-blue-400 shrink-0 mt-0.5" />
        <p className="text-blue-300 text-sm">
          La IA lee estos datos para evaluar el match con cada oferta y personalizar tu CV.
          Mantén todo actualizado para mejores resultados.
          {' '}Puedes subir tu CV (PDF, DOCX o TXT) con el botón <strong>"Importar CV con IA"</strong> para rellenar los campos automáticamente.
        </p>
      </div>

      {cvImportError && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 text-sm font-medium">Error al importar CV</p>
            <p className="text-red-400 text-xs mt-1">{cvImportError}</p>
          </div>
          <button onClick={() => setCvImportError('')} className="ml-auto text-red-500 hover:text-red-300 text-xs">✕</button>
        </div>
      )}

      {/* Datos personales */}
      <Section title="Datos Personales" icon={User}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nombre completo" value={c.full_name || ''} onChange={v => set(['candidate', 'full_name'], v)} />
          <Field label="Email" value={c.email || ''} onChange={v => set(['candidate', 'email'], v)} type="email" />
          <Field label="Teléfono" value={c.phone || ''} onChange={v => set(['candidate', 'phone'], v)} placeholder="+56 9..." />
          <Field label="Ciudad/País" value={c.location || ''} onChange={v => set(['candidate', 'location'], v)} placeholder="Santiago, Chile" />
          <Field label="LinkedIn" value={c.linkedin || ''} onChange={v => set(['candidate', 'linkedin'], v)} placeholder="linkedin.com/in/..." />
          <Field label="GitHub" value={c.github || ''} onChange={v => set(['candidate', 'github'], v)} placeholder="github.com/..." />
          <Field label="Portfolio" value={c.portfolio_url || ''} onChange={v => set(['candidate', 'portfolio_url'], v)} placeholder="https://..." />
        </div>
      </Section>

      {/* Compensación */}
      <Section title="Compensación & Disponibilidad" icon={FileText}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Rango objetivo"
            value={comp.target_range || ''}
            onChange={v => set(['compensation', 'target_range'], v)}
            placeholder="$80M-120M CLP o USD 2000-3500/mes"
          />
          <Field
            label="Mínimo aceptable"
            value={comp.minimum || ''}
            onChange={v => set(['compensation', 'minimum'], v)}
            placeholder="$70M CLP"
          />
          <Field
            label="Moneda preferida"
            value={comp.currency || ''}
            onChange={v => set(['compensation', 'currency'], v)}
            placeholder="CLP, USD, EUR"
          />
          <Field
            label="Flexibilidad"
            value={comp.location_flexibility || ''}
            onChange={v => set(['compensation', 'location_flexibility'], v)}
            placeholder="Remoto preferido, híbrido Santiago posible"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Ciudad"
            value={loc.city || ''}
            onChange={v => set(['location', 'city'], v)}
            placeholder="Santiago"
          />
          <Field
            label="Timezone"
            value={loc.timezone || ''}
            onChange={v => set(['location', 'timezone'], v)}
            placeholder="CLT (GMT-3)"
          />
          <Field
            label="Status visado"
            value={loc.visa_status || ''}
            onChange={v => set(['location', 'visa_status'], v)}
            placeholder="Ciudadano chileno, no requiere visa"
          />
        </div>
      </Section>

      {/* Narrativa */}
      <Section title="Narrativa Profesional" icon={Edit3} defaultOpen={false}>
        <div className="space-y-4">
          <Field
            label="Headline"
            value={narr.headline || ''}
            onChange={v => set(['narrative', 'headline'], v)}
            placeholder="Senior DB Analyst | SQL Server · Azure · Automatización"
          />
          <div>
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1.5 block">
              Historia de salida / diferenciador
            </label>
            <textarea
              value={narr.exit_story || ''}
              onChange={e => set(['narrative', 'exit_story'], e.target.value)}
              placeholder="Qué te hace único y por qué estás buscando trabajo ahora..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1.5 block">
              Superpoderes (uno por línea)
            </label>
            <textarea
              value={(narr.superpowers || []).join('\n')}
              onChange={e => setProfile(prev => ({
                ...prev,
                narrative: { ...prev.narrative, superpowers: e.target.value.split('\n').filter(Boolean) }
              }))}
              placeholder="Optimización de stored procedures bajo alta carga&#10;Automatización de procesos T-SQL&#10;..."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1.5 block">
              Roles objetivo (uno por línea)
            </label>
            <textarea
              value={(tr.primary || []).join('\n')}
              onChange={e => setProfile(prev => ({
                ...prev,
                target_roles: { ...prev.target_roles, primary: e.target.value.split('\n').filter(Boolean) }
              }))}
              placeholder="Database Administrator&#10;Data Engineer&#10;SQL Developer"
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y font-mono"
            />
          </div>
        </div>
      </Section>

      {/* CV Editor */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <FileText size={18} className="text-purple-400" />
            <h3 className="text-white font-semibold">CV Completo (Markdown)</h3>
          </div>
          <div className="flex items-center gap-2">
            {cvSaved && (
              <span className="flex items-center gap-1 text-green-400 text-sm">
                <Check size={14} /> Guardado
              </span>
            )}
            <button
              onClick={() => setCvEdit(!cvEdit)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
            >
              {cvEdit ? <><EyeOff size={14} /> Solo ver</> : <><Edit3 size={14} /> Editar</>}
            </button>
            {cvEdit && (
              <button
                onClick={() => cvMut.mutate(cvContent)}
                disabled={cvMut.isPending}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {cvMut.isPending ? (
                  <><Loader2 size={13} className="animate-spin" /> Guardando...</>
                ) : (
                  <><Save size={13} /> Guardar CV</>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="p-5">
          {cvLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={20} className="animate-spin text-blue-400" />
            </div>
          ) : cvEdit ? (
            <textarea
              value={cvContent}
              onChange={e => setCvContent(e.target.value)}
              className="w-full h-[600px] bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-gray-300 text-xs font-mono focus:outline-none focus:border-blue-500 resize-y leading-relaxed"
            />
          ) : (
            <div className="bg-gray-950 rounded-lg p-4 max-h-[400px] overflow-y-auto">
              <pre className="text-gray-300 text-xs whitespace-pre-wrap font-mono leading-relaxed">
                {cvContent || 'CV vacío. Haz click en "Editar" para ingresar tu CV en formato Markdown.'}
              </pre>
            </div>
          )}
          <p className="text-xs text-gray-600 mt-3">
            Archivo: <code className="text-gray-500">career-ops/cv.md</code>
            {' · '}
            La IA lee este archivo para evaluar el match con cada oferta.
          </p>
        </div>
      </div>

      {/* LinkedIn Optimizer */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Linkedin size={18} className="text-blue-400" />
            <div>
              <h3 className="text-white font-semibold">Optimizar Perfil LinkedIn</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Genera headline, about, skills y tips adaptados a todos tus roles objetivo simultáneamente
              </p>
            </div>
          </div>
          <button
            onClick={generateLinkedin}
            disabled={liLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            {liLoading
              ? <><Loader2 size={14} className="animate-spin" /> Generando...</>
              : <><Sparkles size={14} /> Generar optimización</>
            }
          </button>
        </div>

        {liError && !liLoading && (
          <div className="mx-5 mt-4 p-3 bg-red-900/20 border border-red-700 rounded-lg flex items-start gap-2">
            <span className="text-red-400 font-bold text-sm shrink-0">Error:</span>
            <span className="text-red-300 text-sm break-words">{liError}</span>
          </div>
        )}

        {liLoading && (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <Loader2 size={28} className="animate-spin text-blue-400" />
            <p className="text-gray-400 text-sm">Analizando tu CV y roles objetivo para construir tu perfil ideal...</p>
          </div>
        )}

        {liResult && !liLoading && (
          <div className="p-5 space-y-5">
            {/* Headline */}
            {liResult.headline && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Titular (Headline)</p>
                  <button onClick={() => copyLi('headline', liResult.headline!)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white">
                    {liCopied === 'headline' ? <><CheckCircle2 size={12} className="text-green-400" /> Copiado</> : <><Copy size={12} /> Copiar</>}
                  </button>
                </div>
                <p className="text-white font-medium">{liResult.headline}</p>
                <p className="text-xs text-gray-600 mt-1">{liResult.headline.length}/220 caracteres</p>
              </div>
            )}

            {/* About */}
            {liResult.about && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Sección "Acerca de"</p>
                  <button onClick={() => copyLi('about', liResult.about!)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white">
                    {liCopied === 'about' ? <><CheckCircle2 size={12} className="text-green-400" /> Copiado</> : <><Copy size={12} /> Copiar</>}
                  </button>
                </div>
                <p className="text-gray-200 text-sm whitespace-pre-wrap leading-relaxed">{liResult.about}</p>
              </div>
            )}

            {/* Skills */}
            {liResult.skills && liResult.skills.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Skills a agregar (en orden)</p>
                  <button onClick={() => copyLi('skills', liResult.skills!.join(', '))} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white">
                    {liCopied === 'skills' ? <><CheckCircle2 size={12} className="text-green-400" /> Copiado</> : <><Copy size={12} /> Copiar todas</>}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {liResult.skills.map((s, i) => (
                    <span key={i} className="text-xs bg-blue-900/30 text-blue-300 border border-blue-800/50 px-2.5 py-1 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Open to Work */}
            {liResult.open_to_work && (
              <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-green-400 font-medium uppercase tracking-wider">Texto "Open to Work"</p>
                  <button onClick={() => copyLi('otw', liResult.open_to_work!)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white">
                    {liCopied === 'otw' ? <><CheckCircle2 size={12} className="text-green-400" /> Copiado</> : <><Copy size={12} /> Copiar</>}
                  </button>
                </div>
                <p className="text-gray-200 text-sm">{liResult.open_to_work}</p>
              </div>
            )}

            {/* Experience tips */}
            {liResult.experience_tips && liResult.experience_tips.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-3">Tips por experiencia laboral</p>
                <div className="space-y-3">
                  {liResult.experience_tips.map((tip, i) => (
                    <div key={i} className="border-l-2 border-blue-700 pl-3">
                      <p className="text-white text-sm font-medium">{tip.empresa}</p>
                      <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{tip.sugerencia}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords */}
            {liResult.keywords_to_include && liResult.keywords_to_include.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-3">Keywords clave para aparecer en búsquedas</p>
                <div className="flex flex-wrap gap-2">
                  {liResult.keywords_to_include.map((k, i) => (
                    <span key={i} className="text-xs bg-gray-700 text-gray-300 px-2.5 py-1 rounded-full">{k}</span>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-2">Asegúrate de que estas keywords aparezcan de forma natural en tu About, experiencia y skills.</p>
              </div>
            )}

            {/* Featured ideas */}
            {liResult.featured_ideas && liResult.featured_ideas.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-3">Ideas para sección "Destacados"</p>
                <ul className="space-y-1">
                  {liResult.featured_ideas.map((idea, i) => (
                    <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>{idea}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!liResult && !liLoading && !liError && (
          <div className="p-6 text-center text-gray-500 text-sm">
            Haz clic en "Generar optimización" para obtener recomendaciones personalizadas para tu perfil de LinkedIn.
          </div>
        )}
      </div>

      {/* Instrucciones de redacción para la IA */}
      <Section title="Instrucciones de Redacción de CV" icon={MessageSquare} defaultOpen={false}>
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Escribe aquí cómo quieres que la IA redacte tu CV. Por ejemplo: qué experiencia destacar,
            qué omitir, el tono que prefieres, si incluir o no años de experiencia, etc.
            Estas instrucciones tienen prioridad máxima al generar cada CV personalizado.
          </p>
          <div>
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1.5 block">
              Mis preferencias para la IA
            </label>
            <textarea
              value={profile.cv_instructions || ''}
              onChange={e => setProfile(prev => ({ ...prev, cv_instructions: e.target.value }))}
              placeholder={`Ejemplos:\n- Enfócate en mi experiencia en SQL Server y Azure, no en Python.\n- No menciones mis años de experiencia, solo logros concretos.\n- El tono debe ser directo y técnico, sin frases motivacionales.\n- Prioriza los proyectos personales de IA sobre los roles administrativos.\n- Siempre incluye mis certificaciones en el CV.`}
              rows={8}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y font-mono"
            />
          </div>
          <p className="text-xs text-gray-600">
            Estas instrucciones se aplican en cada CV generado desde "Postulaciones" o al regenerar un CV.
          </p>
        </div>
      </Section>
    </div>
  )
}
