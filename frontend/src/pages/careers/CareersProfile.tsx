import { api } from '../../lib/api'
import { saveBlob } from '../../lib/downloadFile'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  User, FileText, Save, Loader2, Check, Edit3,
  EyeOff, ChevronDown, ChevronUp, AlertCircle, MessageSquare,
  Linkedin, Copy, CheckCircle2, Sparkles, Upload, Rocket, Download, X, Languages,
} from 'lucide-react'
import { loadLlmProvider } from '../../lib/llmProvider'
import { getKeyForProvider } from '../../lib/userApiKeys'
import PerfilTabs from '../../components/careers/PerfilTabs'
import { COUNTRIES } from '../../lib/countries'
import { useTranslation } from '../../lib/i18n/LanguageContext'


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
  linkedin_optimization?: LinkedinOptimization
}

interface LinkedinOptimization {
  headline?: string
  about?: string
  skills?: string[]
  experience_tips?: Array<{ empresa: string; sugerencia: string }>
  featured_ideas?: string[]
  open_to_work?: string
  keywords_to_include?: string[]
}

function Section({
  title, icon: Icon, defaultOpen = true, children
}: {
  title: string; icon: React.ElementType; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon size={18} className="text-blue-400" />
          <h3 className="text-[var(--text-primary)] font-semibold">{title}</h3>
        </div>
        {open ? <ChevronUp size={16} className="text-[var(--text-muted)]" /> : <ChevronDown size={16} className="text-[var(--text-muted)]" />}
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
      <label className="text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wider mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />
    </div>
  )
}

function SelectField({
  label, value, onChange, options
}: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wider mb-1.5 block">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
      >
        <option value="">Sin especificar</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export default function CareersProfile() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { t } = useTranslation()
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
    // Sin el fallback a '' un perfil nuevo (CV vacío) mostraría el CV del perfil anterior
    if (cvData) setCvContent(cvData.content || '')
  }, [cvData])

  useEffect(() => {
    // Cada perfil guarda su propia optimización de LinkedIn (persistida en el perfil,
    // ver linkedin_optimization). Al cambiar de perfil se carga la suya, no se pierde
    // ni se arrastra la del perfil anterior — antes esto se reseteaba a null siempre,
    // obligando a regenerar (y gastar tokens) cada vez que volvías a un perfil.
    setLiResult(profileData?.linkedin_optimization || null)
    setLiError('')
  }, [profileData])

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

      // Si ya había un CV Markdown guardado (posiblemente con ediciones manuales que
      // no vienen en este PDF/DOCX), confirmar antes de reemplazarlo — antes se
      // sobreescribía en silencio y se perdía lo editado a mano.
      const overwritesExistingCv = d.cv_markdown && cvContent.trim() && cvContent.trim() !== d.cv_markdown.trim()
      const shouldUpdateCv = d.cv_markdown && (
        !overwritesExistingCv ||
        window.confirm('Ya tienes un CV guardado en "CV Completo (Markdown)". Importar este archivo lo va a reemplazar por completo — cualquier edición manual que no esté en este PDF/DOCX se perderá. ¿Continuar?')
      )

      if (shouldUpdateCv) setCvContent(d.cv_markdown)

      // Guardar perfil y CV automáticamente
      await api.put('/profile', newProfile)
      if (shouldUpdateCv) await api.put('/cv', { content: d.cv_markdown })

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

  // ── CV Optimizer (aplica cv_instructions al CV base, sin oferta específica) ─
  interface CvData {
    name: string
    contact: { city: string; phone: string; email: string; linkedin?: string; github?: string }
    summary: string
    experience: Array<{ company: string; location: string; role: string; dates: string; bullets: string[] }>
    projects: Array<{ name: string; year?: string; bullets: string[] }>
    skills: Record<string, string>
    education: Array<{ title: string; institution: string; year: string }>
  }
  const [cvOptimizing, setCvOptimizing] = useState(false)
  const [cvOptimizeError, setCvOptimizeError] = useState('')
  const [cvOptimizeResult, setCvOptimizeResult] = useState<{ cvData: CvData; cvHtml: string } | null>(null)
  const [cvOptimizeOpen, setCvOptimizeOpen] = useState(false)
  const [cvOptimizeDownloading, setCvOptimizeDownloading] = useState(false)

  const handleOptimizeCv = async () => {
    setCvOptimizing(true)
    setCvOptimizeError('')
    try {
      await saveMut.mutateAsync(profile) // asegura que las instrucciones actuales queden guardadas antes de generar
      const { data } = await api.post('/cv/optimize', {})
      setCvOptimizeResult({ cvData: data.cvData, cvHtml: data.cvHtml })
      setCvOptimizeOpen(true)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string }
      setCvOptimizeError(e?.response?.data?.error || e?.message || 'Error al generar el CV')
    } finally {
      setCvOptimizing(false)
    }
  }

  const handleDownloadOptimizedCv = async () => {
    if (!cvOptimizeResult) return
    setCvOptimizeDownloading(true)
    try {
      const { data } = await api.post('/cv/optimize/pdf', { cvData: cvOptimizeResult.cvData }, { responseType: 'blob' })
      await saveBlob(data, 'CV_Optimizado.pdf')
    } catch {
      setCvOptimizeError('Error al descargar el PDF')
    } finally {
      setCvOptimizeDownloading(false)
    }
  }

  const cvDataToMarkdown = (d: CvData): string => {
    const lines: string[] = [`# ${d.name}`]
    const contactParts = [d.contact?.city, d.contact?.phone, d.contact?.email, d.contact?.linkedin, d.contact?.github].filter(Boolean)
    if (contactParts.length) lines.push(contactParts.join(' | '))
    lines.push('')
    if (d.summary) { lines.push('## Resumen', d.summary, '') }
    if (d.experience?.length) {
      lines.push('## Experiencia')
      for (const exp of d.experience) {
        lines.push(`### ${exp.role} — ${exp.company} (${exp.dates})`)
        if (exp.location) lines.push(`_${exp.location}_`)
        exp.bullets.forEach(b => lines.push(`- ${b}`))
        lines.push('')
      }
    }
    if (d.projects?.length) {
      lines.push('## Proyectos')
      for (const proj of d.projects) {
        lines.push(`### ${proj.name}${proj.year ? ` (${proj.year})` : ''}`)
        proj.bullets.forEach(b => lines.push(`- ${b}`))
        lines.push('')
      }
    }
    if (d.skills && Object.keys(d.skills).length) {
      lines.push('## Habilidades')
      Object.entries(d.skills).forEach(([cat, val]) => lines.push(`**${cat}:** ${val}`))
      lines.push('')
    }
    if (d.education?.length) {
      lines.push('## Educación')
      d.education.forEach(edu => lines.push(`- ${edu.title} — ${edu.institution} (${edu.year})`))
    }
    return lines.join('\n')
  }

  const handleSaveOptimizedAsBase = () => {
    if (!cvOptimizeResult) return
    const md = cvDataToMarkdown(cvOptimizeResult.cvData)
    setCvContent(md)
    cvMut.mutate(md)
    setCvOptimizeOpen(false)
  }

  // ── CV Translator (traduce el CV base a cualquier idioma a pedido) ─────────
  const [translateLang, setTranslateLang] = useState('')
  const [translating, setTranslating] = useState(false)
  const [translateError, setTranslateError] = useState('')
  const [translateResult, setTranslateResult] = useState<{ cvData: CvData; cvHtml: string } | null>(null)
  const [translateOpen, setTranslateOpen] = useState(false)
  const [translateDownloading, setTranslateDownloading] = useState(false)

  const handleTranslateCv = async () => {
    if (!translateLang.trim()) return
    setTranslating(true)
    setTranslateError('')
    try {
      const { data } = await api.post('/cv/translate', { idioma: translateLang.trim() })
      setTranslateResult({ cvData: data.cvData, cvHtml: data.cvHtml })
      setTranslateOpen(true)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string }
      setTranslateError(e?.response?.data?.error || e?.message || 'Error al traducir el CV')
    } finally {
      setTranslating(false)
    }
  }

  const handleDownloadTranslatedCv = async () => {
    if (!translateResult) return
    setTranslateDownloading(true)
    try {
      const { data } = await api.post('/cv/optimize/pdf', { cvData: translateResult.cvData }, { responseType: 'blob' })
      await saveBlob(data, `CV_${translateLang.trim().replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`)
    } catch {
      setTranslateError('Error al descargar el PDF')
    } finally {
      setTranslateDownloading(false)
    }
  }

  const handleSaveTranslatedAsBase = () => {
    if (!translateResult) return
    const md = cvDataToMarkdown(translateResult.cvData)
    setCvContent(md)
    cvMut.mutate(md)
    setTranslateOpen(false)
  }

  // ── LinkedIn Optimizer state ──────────────────────────────────────────────
  const [liLoading, setLiLoading] = useState(false)
  const [liError, setLiError] = useState('')
  const [liResult, setLiResult] = useState<LinkedinOptimization | null>(null)
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
      qc.invalidateQueries({ queryKey: ['careers-profile'] }) // el backend ya lo persistió en el perfil activo
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
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">{t('careersProfile.title')}</h2>
          <p className="text-[var(--text-tertiary)] mt-1">{t('careersProfile.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {cvImportSuccess && (
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <CheckCircle2 size={14} /> {t('careersProfile.cvImportedSuccess')}
            </span>
          )}
          {saved && (
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <Check size={14} /> {t('careersProfile.profileSaved')}
            </span>
          )}
          <label className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${cvImporting ? 'bg-purple-800 opacity-60 cursor-not-allowed' : 'bg-purple-700 hover:bg-purple-600 text-[var(--text-primary)]'}`}>
            {cvImporting ? (
              <><Loader2 size={14} className="animate-spin" /> {t('careersProfile.analyzingCv')}</>
            ) : (
              <><Upload size={14} /> {t('careersProfile.importCv')}</>
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
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            {saveMut.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> {t('careersProfile.saving')}</>
            ) : (
              <><Save size={14} /> {t('careersProfile.saveProfile')}</>
            )}
          </button>
        </div>
      </div>

      <PerfilTabs />

      <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 flex gap-3">
        <AlertCircle size={18} className="text-blue-400 shrink-0 mt-0.5" />
        <p className="text-blue-300 text-sm">
          {t('careersProfile.aiNote1')}
          {' '}{t('careersProfile.aiNote2')} <strong>"{t('careersProfile.importCv')}"</strong> {t('careersProfile.aiNote3')}
        </p>
      </div>

      {cvImportError && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 text-sm font-medium">{t('careersProfile.importCvErrorTitle')}</p>
            <p className="text-red-400 text-xs mt-1">{cvImportError}</p>
          </div>
          <button onClick={() => setCvImportError('')} className="ml-auto text-red-500 hover:text-red-300 text-xs">✕</button>
        </div>
      )}

      {/* Datos personales */}
      <Section title={t('careersProfile.sections.personalData')} icon={User}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('careersProfile.fields.fullName')} value={c.full_name || ''} onChange={v => set(['candidate', 'full_name'], v)} />
          <Field label={t('careersProfile.fields.email')} value={c.email || ''} onChange={v => set(['candidate', 'email'], v)} type="email" />
          <Field label={t('careersProfile.fields.phone')} value={c.phone || ''} onChange={v => set(['candidate', 'phone'], v)} placeholder="+56 9..." />
          <Field label={t('careersProfile.fields.cityCountry')} value={c.location || ''} onChange={v => set(['candidate', 'location'], v)} placeholder="Santiago, Chile" />
          <Field label={t('careersProfile.fields.linkedin')} value={c.linkedin || ''} onChange={v => set(['candidate', 'linkedin'], v)} placeholder="linkedin.com/in/..." />
          <Field label={t('careersProfile.fields.github')} value={c.github || ''} onChange={v => set(['candidate', 'github'], v)} placeholder="github.com/..." />
          <Field label={t('careersProfile.fields.portfolio')} value={c.portfolio_url || ''} onChange={v => set(['candidate', 'portfolio_url'], v)} placeholder="https://..." />
        </div>
      </Section>

      {/* Compensación */}
      <Section title={t('careersProfile.sections.compensation')} icon={FileText}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label={t('careersProfile.fields.targetRange')}
            value={comp.target_range || ''}
            onChange={v => set(['compensation', 'target_range'], v)}
            placeholder="$80M-120M CLP o USD 2000-3500/mes"
          />
          <Field
            label={t('careersProfile.fields.minimumAcceptable')}
            value={comp.minimum || ''}
            onChange={v => set(['compensation', 'minimum'], v)}
            placeholder="$70M CLP"
          />
          <Field
            label={t('careersProfile.fields.preferredCurrency')}
            value={comp.currency || ''}
            onChange={v => set(['compensation', 'currency'], v)}
            placeholder="CLP, USD, EUR"
          />
          <Field
            label={t('careersProfile.fields.flexibility')}
            value={comp.location_flexibility || ''}
            onChange={v => set(['compensation', 'location_flexibility'], v)}
            placeholder="Remoto preferido, híbrido Santiago posible"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            label={t('careersProfile.fields.country')}
            value={loc.country || ''}
            onChange={v => set(['location', 'country'], v)}
            options={COUNTRIES.map(c => ({ value: c.nombre, label: c.nombre }))}
          />
          <Field
            label={t('careersProfile.fields.city')}
            value={loc.city || ''}
            onChange={v => set(['location', 'city'], v)}
            placeholder="Santiago"
          />
          <Field
            label={t('careersProfile.fields.timezone')}
            value={loc.timezone || ''}
            onChange={v => set(['location', 'timezone'], v)}
            placeholder="CLT (GMT-3)"
          />
          <Field
            label={t('careersProfile.fields.visaStatus')}
            value={loc.visa_status || ''}
            onChange={v => set(['location', 'visa_status'], v)}
            placeholder="Ciudadano chileno, no requiere visa"
          />
        </div>
      </Section>

      {/* Narrativa */}
      <Section title={t('careersProfile.sections.narrative')} icon={Edit3} defaultOpen={false}>
        <div className="space-y-4">
          <Field
            label={t('careersProfile.fields.headline')}
            value={narr.headline || ''}
            onChange={v => set(['narrative', 'headline'], v)}
            placeholder="Senior DB Analyst | SQL Server · Azure · Automatización"
          />
          <div>
            <label className="text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wider mb-1.5 block">
              {t('careersProfile.fields.exitStory')}
            </label>
            <textarea
              value={narr.exit_story || ''}
              onChange={e => set(['narrative', 'exit_story'], e.target.value)}
              placeholder={t('careersProfile.fields.exitStoryPlaceholder')}
              rows={3}
              className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wider mb-1.5 block">
              {t('careersProfile.fields.superpowers')}
            </label>
            <textarea
              value={(narr.superpowers || []).join('\n')}
              onChange={e => setProfile(prev => ({
                ...prev,
                narrative: { ...prev.narrative, superpowers: e.target.value.split('\n').filter(Boolean) }
              }))}
              placeholder="Optimización de stored procedures bajo alta carga&#10;Automatización de procesos T-SQL&#10;..."
              rows={4}
              className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wider mb-1.5 block">
              {t('careersProfile.fields.targetRoles')}
            </label>
            <textarea
              value={(tr.primary || []).join('\n')}
              onChange={e => setProfile(prev => ({
                ...prev,
                target_roles: { ...prev.target_roles, primary: e.target.value.split('\n').filter(Boolean) }
              }))}
              placeholder="Database Administrator&#10;Data Engineer&#10;SQL Developer"
              rows={4}
              className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y font-mono"
            />
          </div>
        </div>
      </Section>

      {/* CV Editor */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-3">
            <FileText size={18} className="text-purple-400" />
            <h3 className="text-[var(--text-primary)] font-semibold">{t('careersProfile.cvEditor.title')}</h3>
          </div>
          <div className="flex items-center gap-2">
            {cvSaved && (
              <span className="flex items-center gap-1 text-green-400 text-sm">
                <Check size={14} /> {t('careersProfile.cvEditor.saved')}
              </span>
            )}
            <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${cvImporting ? 'bg-purple-800 opacity-60 cursor-not-allowed' : 'bg-[var(--bg-surface-alt)] hover:bg-gray-700 text-[var(--text-secondary)]'}`}>
              {cvImporting ? (
                <><Loader2 size={13} className="animate-spin" /> {t('careersProfile.cvEditor.analyzing')}</>
              ) : (
                <><Upload size={13} /> {t('careersProfile.importCv')}</>
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
              onClick={() => setCvEdit(!cvEdit)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-surface-alt)] hover:bg-gray-700 text-[var(--text-secondary)] rounded-lg text-sm transition-colors"
            >
              {cvEdit ? <><EyeOff size={14} /> {t('careersProfile.cvEditor.viewOnly')}</> : <><Edit3 size={14} /> {t('careersProfile.cvEditor.edit')}</>}
            </button>
            {cvEdit && (
              <button
                onClick={() => cvMut.mutate(cvContent)}
                disabled={cvMut.isPending}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {cvMut.isPending ? (
                  <><Loader2 size={13} className="animate-spin" /> {t('careersProfile.saving')}</>
                ) : (
                  <><Save size={13} /> {t('careersProfile.cvEditor.saveCv')}</>
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
              className="w-full h-[600px] bg-[var(--bg-app)] border border-[var(--border-alt)] rounded-lg px-4 py-3 text-[var(--text-secondary)] text-xs font-mono focus:outline-none focus:border-blue-500 resize-y leading-relaxed"
            />
          ) : (
            <div className="bg-[var(--bg-app)] rounded-lg p-4 max-h-[400px] overflow-y-auto">
              <pre className="text-[var(--text-secondary)] text-xs whitespace-pre-wrap font-mono leading-relaxed">
                {cvContent || t('careersProfile.cvEditor.emptyPlaceholder')}
              </pre>
            </div>
          )}
          <p className="text-xs text-[var(--text-faint)] mt-3">
            {t('careersProfile.cvEditor.fileNote1')} <code className="text-[var(--text-muted)]">career-ops/cv.md</code>
            {' · '}
            {t('careersProfile.cvEditor.fileNote2')}
          </p>

          <div className="mt-4 pt-4 border-t border-[var(--border-default)] flex items-center gap-2 flex-wrap">
            <label className="text-xs text-[var(--text-muted)] shrink-0">{t('careersProfile.cvEditor.translateLabel')}</label>
            <input
              value={translateLang}
              onChange={e => setTranslateLang(e.target.value)}
              placeholder={t('careersProfile.cvEditor.translatePlaceholder')}
              className="flex-1 min-w-[180px] bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleTranslateCv}
              disabled={translating || !translateLang.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-[var(--text-primary)] rounded-lg text-xs font-medium transition-colors shrink-0"
            >
              {translating ? <Loader2 size={13} className="animate-spin" /> : <Languages size={13} />}
              {translating ? t('careersProfile.cvEditor.translating') : t('careersProfile.cvEditor.translateButton')}
            </button>
          </div>
          {translateError && (
            <p className="text-xs text-red-400 flex items-center gap-1.5 mt-2">
              <AlertCircle size={12} /> {translateError}
            </p>
          )}
        </div>
      </div>

      {translateOpen && translateResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-alt)] rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)] shrink-0">
              <div>
                <h3 className="text-[var(--text-primary)] font-bold flex items-center gap-2">
                  <Languages size={16} className="text-blue-400" />
                  {t('careersProfile.translateModal.title', { lang: translateLang })}
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{t('careersProfile.translateModal.previewNote')}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadTranslatedCv}
                  disabled={translateDownloading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-[var(--text-primary)] rounded-lg text-xs font-medium"
                >
                  {translateDownloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  {t('careersProfile.translateModal.downloadPdf')}
                </button>
                <button
                  onClick={handleSaveTranslatedAsBase}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-[var(--text-primary)] rounded-lg text-xs font-medium"
                  title={t('careersProfile.translateModal.saveAsBaseTitle')}
                >
                  <Save size={13} /> {t('careersProfile.translateModal.saveAsBase')}
                </button>
                <button
                  onClick={() => setTranslateOpen(false)}
                  className="p-1.5 bg-[var(--bg-surface-alt)] hover:bg-gray-700 text-[var(--text-tertiary)] rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-white">
              <iframe title="CV traducido" srcDoc={translateResult.cvHtml} className="w-full h-full border-0" />
            </div>
          </div>
        </div>
      )}

      {/* LinkedIn Optimizer */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-3">
            <Linkedin size={18} className="text-blue-400" />
            <div>
              <h3 className="text-[var(--text-primary)] font-semibold">{t('careersProfile.linkedinOptimizer.title')}</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {t('careersProfile.linkedinOptimizer.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={generateLinkedin}
            disabled={liLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            {liLoading
              ? <><Loader2 size={14} className="animate-spin" /> {t('careersProfile.linkedinOptimizer.generating')}</>
              : liResult
                ? <><Sparkles size={14} /> {t('careersProfile.linkedinOptimizer.regenerate')}</>
                : <><Sparkles size={14} /> {t('careersProfile.linkedinOptimizer.generate')}</>
            }
          </button>
        </div>

        {liError && !liLoading && (
          <div className="mx-5 mt-4 p-3 bg-red-900/20 border border-red-700 rounded-lg flex items-start gap-2">
            <span className="text-red-400 font-bold text-sm shrink-0">{t('careersProfile.linkedinOptimizer.errorPrefix')}</span>
            <span className="text-red-300 text-sm break-words">{liError}</span>
          </div>
        )}

        {liLoading && (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <Loader2 size={28} className="animate-spin text-blue-400" />
            <p className="text-[var(--text-tertiary)] text-sm">{t('careersProfile.linkedinOptimizer.analyzingNote')}</p>
          </div>
        )}

        {liResult && !liLoading && (
          <div className="p-5 space-y-5">
            {/* Headline */}
            {liResult.headline && (
              <div className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wider">{t('careersProfile.linkedinOptimizer.headlineLabel')}</p>
                  <button onClick={() => copyLi('headline', liResult.headline!)} className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                    {liCopied === 'headline' ? <><CheckCircle2 size={12} className="text-green-400" /> {t('careersProfile.linkedinOptimizer.copied')}</> : <><Copy size={12} /> {t('careersProfile.linkedinOptimizer.copy')}</>}
                  </button>
                </div>
                <p className="text-[var(--text-primary)] font-medium">{liResult.headline}</p>
                <p className="text-xs text-[var(--text-faint)] mt-1">{t('careersProfile.linkedinOptimizer.charCount', { count: liResult.headline.length })}</p>
              </div>
            )}

            {/* About */}
            {liResult.about && (
              <div className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wider">{t('careersProfile.linkedinOptimizer.aboutLabel')}</p>
                  <button onClick={() => copyLi('about', liResult.about!)} className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                    {liCopied === 'about' ? <><CheckCircle2 size={12} className="text-green-400" /> {t('careersProfile.linkedinOptimizer.copied')}</> : <><Copy size={12} /> {t('careersProfile.linkedinOptimizer.copy')}</>}
                  </button>
                </div>
                <p className="text-gray-200 text-sm whitespace-pre-wrap leading-relaxed">{liResult.about}</p>
              </div>
            )}

            {/* Skills */}
            {liResult.skills && liResult.skills.length > 0 && (
              <div className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wider">{t('careersProfile.linkedinOptimizer.skillsLabel')}</p>
                  <button onClick={() => copyLi('skills', liResult.skills!.join(', '))} className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                    {liCopied === 'skills' ? <><CheckCircle2 size={12} className="text-green-400" /> {t('careersProfile.linkedinOptimizer.copied')}</> : <><Copy size={12} /> {t('careersProfile.linkedinOptimizer.copyAll')}</>}
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
                  <p className="text-xs text-green-400 font-medium uppercase tracking-wider">{t('careersProfile.linkedinOptimizer.openToWorkLabel')}</p>
                  <button onClick={() => copyLi('otw', liResult.open_to_work!)} className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                    {liCopied === 'otw' ? <><CheckCircle2 size={12} className="text-green-400" /> {t('careersProfile.linkedinOptimizer.copied')}</> : <><Copy size={12} /> {t('careersProfile.linkedinOptimizer.copy')}</>}
                  </button>
                </div>
                <p className="text-gray-200 text-sm">{liResult.open_to_work}</p>
              </div>
            )}

            {/* Experience tips */}
            {liResult.experience_tips && liResult.experience_tips.length > 0 && (
              <div className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl p-4">
                <p className="text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wider mb-3">{t('careersProfile.linkedinOptimizer.experienceTipsLabel')}</p>
                <div className="space-y-3">
                  {liResult.experience_tips.map((tip, i) => (
                    <div key={i} className="border-l-2 border-blue-700 pl-3">
                      <p className="text-[var(--text-primary)] text-sm font-medium">{tip.empresa}</p>
                      <p className="text-[var(--text-tertiary)] text-xs mt-0.5 leading-relaxed">{tip.sugerencia}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords */}
            {liResult.keywords_to_include && liResult.keywords_to_include.length > 0 && (
              <div className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl p-4">
                <p className="text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wider mb-3">{t('careersProfile.linkedinOptimizer.keywordsLabel')}</p>
                <div className="flex flex-wrap gap-2">
                  {liResult.keywords_to_include.map((k, i) => (
                    <span key={i} className="text-xs bg-gray-700 text-[var(--text-secondary)] px-2.5 py-1 rounded-full">{k}</span>
                  ))}
                </div>
                <p className="text-xs text-[var(--text-faint)] mt-2">{t('careersProfile.linkedinOptimizer.keywordsNote')}</p>
              </div>
            )}

            {/* Featured ideas */}
            {liResult.featured_ideas && liResult.featured_ideas.length > 0 && (
              <div className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl p-4">
                <p className="text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wider mb-3">{t('careersProfile.linkedinOptimizer.featuredIdeasLabel')}</p>
                <ul className="space-y-1">
                  {liResult.featured_ideas.map((idea, i) => (
                    <li key={i} className="text-[var(--text-secondary)] text-sm flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>{idea}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!liResult && !liLoading && !liError && (
          <div className="p-6 text-center text-[var(--text-muted)] text-sm">
            {t('careersProfile.linkedinOptimizer.emptyState')}
          </div>
        )}
      </div>

      {/* Instrucciones de redacción para la IA */}
      <Section title={t('careersProfile.sections.cvInstructions')} icon={MessageSquare} defaultOpen={false}>
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-tertiary)]">
            {t('careersProfile.cvInstructions.desc')}
          </p>
          <div>
            <label className="text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wider mb-1.5 block">
              {t('careersProfile.cvInstructions.myPreferencesLabel')}
            </label>
            <textarea
              value={profile.cv_instructions || ''}
              onChange={e => setProfile(prev => ({ ...prev, cv_instructions: e.target.value }))}
              placeholder={`Ejemplos:\n- Enfócate en mi experiencia en SQL Server y Azure, no en Python.\n- No menciones mis años de experiencia, solo logros concretos.\n- El tono debe ser directo y técnico, sin frases motivacionales.\n- Prioriza los proyectos personales de IA sobre los roles administrativos.\n- Siempre incluye mis certificaciones en el CV.`}
              rows={8}
              className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y font-mono"
            />
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-[var(--text-faint)]">
              {t('careersProfile.cvInstructions.generateNote1')}{' '}
              <button onClick={() => navigate('/postulaciones')} className="text-purple-400 hover:underline">
                {t('careersProfile.cvInstructions.generateNoteLink')}
              </button>.
            </p>
            <button
              onClick={handleOptimizeCv}
              disabled={cvOptimizing || !profile.cv_instructions?.trim()}
              title={!profile.cv_instructions?.trim() ? t('careersProfile.cvInstructions.generateButtonTitle') : undefined}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-primary)] rounded-lg text-xs font-medium transition-colors shrink-0"
            >
              {cvOptimizing ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
              {cvOptimizing ? t('careersProfile.cvInstructions.generating') : t('careersProfile.cvInstructions.generateButton')}
            </button>
          </div>
          {cvOptimizeError && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <AlertCircle size={12} /> {cvOptimizeError}
            </p>
          )}
        </div>
      </Section>

      {cvOptimizeOpen && cvOptimizeResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-alt)] rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)] shrink-0">
              <div>
                <h3 className="text-[var(--text-primary)] font-bold flex items-center gap-2">
                  <FileText size={16} className="text-purple-400" />
                  {t('careersProfile.optimizedModal.title')}
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{t('careersProfile.optimizedModal.previewNote')}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadOptimizedCv}
                  disabled={cvOptimizeDownloading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-[var(--text-primary)] rounded-lg text-xs font-medium"
                >
                  {cvOptimizeDownloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  {t('careersProfile.translateModal.downloadPdf')}
                </button>
                <button
                  onClick={handleSaveOptimizedAsBase}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-[var(--text-primary)] rounded-lg text-xs font-medium"
                  title={t('careersProfile.optimizedModal.saveAsBaseTitle')}
                >
                  <Save size={13} /> {t('careersProfile.translateModal.saveAsBase')}
                </button>
                <button
                  onClick={() => setCvOptimizeOpen(false)}
                  className="p-1.5 bg-[var(--bg-surface-alt)] hover:bg-gray-700 text-[var(--text-tertiary)] rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-white">
              <iframe title="CV optimizado" srcDoc={cvOptimizeResult.cvHtml} className="w-full h-full border-0" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
