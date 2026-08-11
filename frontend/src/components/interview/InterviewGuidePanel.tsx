import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../../lib/api'
import { saveBlob } from '../../lib/downloadFile'
import { loadLlmProvider, type LlmProvider } from '../../lib/llmProvider'
import { getKeyForProvider } from '../../lib/userApiKeys'
import {
  Brain, Loader2, X, Download, FileCode2, Sparkles, RefreshCw, Search,
} from 'lucide-react'
import type { Application, InterviewMeta } from '../../types/careers'
import { useTranslation } from '../../lib/i18n/LanguageContext'

const EMPTY_META: InterviewMeta = { entrevistadores: '', fecha: '', hora: '', modalidad: '', tipo: '' }

function fileBase(app: Application): string {
  const clean = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `Guia_Entrevista_${clean(app.empresa)}_${clean(app.rol)}`
}

export function InterviewGuidePanel({
  app, onClose, onGenerated, onViewLegacy,
}: {
  app: Application
  onClose: () => void
  onGenerated: (guide: NonNullable<Application['interviewGuide']>) => void
  /** Solo se ofrece cuando la postulación tiene una guía markdown vieja y ninguna nueva. */
  onViewLegacy?: () => void
}) {
  const { t } = useTranslation()
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingGuide, setLoadingGuide] = useState(!!app.interviewGuide)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(!app.interviewGuide)
  const [meta, setMeta] = useState<InterviewMeta>({ ...EMPTY_META, ...(app.interviewMeta || {}) })
  const [lang, setLang] = useState<'es' | 'en'>(app.idioma || 'es')
  const [reinvestigar, setReinvestigar] = useState(false)
  const [step, setStep] = useState<'research' | 'writing' | null>(null)
  // La investigación sobrevive a un fallo del paso 2 para no volver a pagarla en el reintento.
  const [research, setResearch] = useState<unknown>(null)
  const [llmProvider] = useState<LlmProvider>(() => loadLlmProvider())
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!loading) { setElapsed(0); return }
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [loading])

  const errMsg = useCallback((err: unknown, fallback: string) => {
    return (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      || (err as Error)?.message
      || fallback
  }, [])

  // Guía ya generada: se pide el HTML al backend en vez de armarlo acá — así el preview,
  // el .html descargado y el PDF salen del mismo builder y no pueden divergir.
  useEffect(() => {
    if (!app.interviewGuide) return
    let cancelled = false
    setLoadingGuide(true)
    api.get(`/applications/${app.id}/interview-guide`)
      .then(({ data }) => { if (!cancelled) setHtml(data.html) })
      .catch(err => { if (!cancelled) setError(errMsg(err, t('careersPostulaciones.interviewGuide.loadError'))) })
      .finally(() => { if (!cancelled) setLoadingGuide(false) })
    return () => { cancelled = true }
  }, [app.id, app.interviewGuide, errMsg, t])

  // Las notas se escriben dentro del iframe y viajan por postMessage: así el HTML no
  // necesita el token de auth (se descarga y se comparte, no puede llevar credenciales).
  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      if (e.data?.type !== 'ergania:guide-notes') return
      try {
        await api.patch(`/applications/${app.id}/interview-guide/notes`, { notes: e.data.notes })
        iframeRef.current?.contentWindow?.postMessage({ type: 'ergania:notes-saved' }, '*')
      } catch (err) {
        console.error('No se pudieron guardar las notas', err)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [app.id])

  // Dos requests a propósito: juntas rozaban el maxDuration de 300s de la función y un 504
  // tiraba a la basura la búsqueda ya pagada. Partido, si falla el paso 2 la investigación
  // queda en estado y el reintento no vuelve a buscar.
  const generate = async () => {
    setLoading(true)
    setError('')
    const userApiKey = getKeyForProvider(llmProvider)
    const auth = userApiKey ? { userApiKey } : {}

    try {
      let info = reinvestigar ? null : research
      if (!info) {
        setStep('research')
        const { data } = await api.post(`/applications/${app.id}/interview-guide/research`, {
          llmProvider, idioma: lang, reinvestigar, ...auth,
        })
        info = data.empresaInfo
        setResearch(info)
      }

      setStep('writing')
      const { data } = await api.post(`/applications/${app.id}/interview-guide`, {
        llmProvider, idioma: lang, meta, empresaInfo: info, ...auth,
      })
      setHtml(data.html)
      setShowForm(false)
      setReinvestigar(false)
      onGenerated(data.guide)
    } catch (err: unknown) {
      setError(errMsg(err, t('careersPostulaciones.interviewGuide.genericError')))
      console.error(err)
    } finally {
      setLoading(false)
      setStep(null)
    }
  }

  const download = async (kind: 'html' | 'pdf') => {
    setError('')
    try {
      const { data } = await api.get(`/applications/${app.id}/interview-guide/${kind}`, { responseType: 'blob' })
      await saveBlob(data, `${fileBase(app)}.${kind}`)
    } catch (err: unknown) {
      setError(errMsg(err, t('careersPostulaciones.interviewGuide.downloadError')))
      console.error(err)
    }
  }

  const field = (key: keyof InterviewMeta, label: string, placeholder: string) => (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">
        {label}
      </label>
      <input
        type="text"
        value={meta[key] || ''}
        onChange={e => setMeta(m => ({ ...m, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-violet-500"
      />
    </div>
  )

  const hasGuide = !!html && !showForm

  return (
    // Pantalla completa en el celular y casi completa en el PC: es un documento para
    // estudiar, no un diálogo de confirmación. En móvil sin padding ni esquinas
    // redondeadas para no perder ni un píxel de ancho de lectura.
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/85 p-0 sm:items-center sm:p-4">
      <div className="bg-[var(--bg-surface)] border-0 sm:border border-[var(--border-alt)] rounded-none sm:rounded-2xl w-full h-full sm:h-[95vh] sm:max-w-[1180px] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5 border-b border-[var(--border-default)] shrink-0">
          {/* Con la guía abierta el título ya lo muestra su propia cabecera: repetirlo acá
              solo comía alto de lectura. En el formulario sí hace falta. */}
          <div className="min-w-0 flex items-center gap-2">
            <Brain size={16} className="text-violet-400 shrink-0" />
            <span className="text-[var(--text-primary)] font-bold truncate text-sm">
              {hasGuide
                ? t('careersPostulaciones.interviewGuide.shortTitle')
                : `${t('careersPostulaciones.interviewGuide.titlePrefix')} ${app.empresa}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {hasGuide && (
              <>
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3 sm:py-1.5 bg-violet-700 hover:bg-violet-600 text-[var(--text-primary)] rounded-lg text-xs"
                  title={t('careersPostulaciones.interviewGuide.regenerateTitle')}
                >
                  <RefreshCw size={14} />
                  <span className="hidden md:inline">{t('careersPostulaciones.interviewGuide.regenerate')}</span>
                </button>
                <button
                  onClick={() => download('html')}
                  className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3 sm:py-1.5 bg-gray-700 hover:bg-gray-600 text-[var(--text-secondary)] rounded-lg text-xs"
                  title={t('careersPostulaciones.interviewGuide.downloadHtmlTitle')}
                >
                  <FileCode2 size={14} />
                  <span className="hidden md:inline">HTML</span>
                </button>
                <button
                  onClick={() => download('pdf')}
                  className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3 sm:py-1.5 bg-green-700 hover:bg-green-600 text-[var(--text-primary)] rounded-lg text-xs"
                  title="PDF"
                >
                  <Download size={14} />
                  <span className="hidden md:inline">PDF</span>
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* El scroll lo maneja cada vista: el iframe el suyo, el formulario el propio. Antes
            este contenedor también scrolleaba y quedaban dos barras compitiendo. */}
        <div className="flex-1 min-h-0 flex flex-col">
          {error && (
            <div className="m-3 p-3 bg-red-900/30 border border-red-800 rounded-xl text-red-300 text-sm shrink-0">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <Loader2 size={32} className="text-violet-400 animate-spin" />
              <div>
                <p className="text-[var(--text-primary)] font-medium">
                  {step === 'research'
                    ? t('careersPostulaciones.interviewGuide.stepResearch')
                    : t('careersPostulaciones.interviewGuide.stepWriting')}
                </p>
                <p className="text-[var(--text-tertiary)] text-sm mt-1 max-w-md">
                  {t('careersPostulaciones.interviewGuide.loadingNote')}
                </p>
                {/* Sin esto el spinner se ve igual al minuto 1 que al 3 y parece colgado. */}
                <p className="text-[var(--text-muted)] text-xs mt-3 tabular-nums">
                  {t('careersPostulaciones.interviewGuide.elapsed')} {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={step === 'research' ? 'text-violet-300 font-semibold' : 'text-[var(--text-muted)]'}>
                  1. {t('careersPostulaciones.interviewGuide.stepResearchShort')}
                </span>
                <span className="text-[var(--text-faint)]">→</span>
                <span className={step === 'writing' ? 'text-violet-300 font-semibold' : 'text-[var(--text-muted)]'}>
                  2. {t('careersPostulaciones.interviewGuide.stepWritingShort')}
                </span>
              </div>
            </div>
          )}

          {!loading && showForm && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-2xl w-full mx-auto">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-11 h-11 rounded-xl bg-violet-900/30 flex items-center justify-center shrink-0">
                  <Sparkles size={20} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-[var(--text-primary)] font-semibold">
                    {t('careersPostulaciones.interviewGuide.readyTitle')}
                  </p>
                  <p className="text-[var(--text-tertiary)] text-sm mt-1">
                    {t('careersPostulaciones.interviewGuide.readyDesc')}
                  </p>
                </div>
              </div>

              {onViewLegacy && !app.interviewGuide && (
                <div className="mb-4 p-3 bg-amber-900/20 border border-amber-800/50 rounded-xl text-amber-200 text-xs flex flex-wrap items-center justify-between gap-2">
                  <span>{t('careersPostulaciones.interviewGuide.legacyNotice')}</span>
                  <button onClick={onViewLegacy} className="underline hover:text-amber-100 shrink-0">
                    {t('careersPostulaciones.card.viewPrep')}
                  </button>
                </div>
              )}

              <div className="bg-[var(--bg-surface-alt)]/50 border border-[var(--border-alt)] rounded-xl p-4 mb-4">
                <p className="text-xs text-[var(--text-tertiary)] mb-4">
                  {t('careersPostulaciones.interviewGuide.metaHint')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {field('entrevistadores', t('careersPostulaciones.interviewGuide.fieldInterviewers'), t('careersPostulaciones.interviewGuide.phInterviewers'))}
                  {field('tipo', t('careersPostulaciones.interviewGuide.fieldType'), t('careersPostulaciones.interviewGuide.phType'))}
                  {field('fecha', t('careersPostulaciones.interviewGuide.fieldDate'), t('careersPostulaciones.interviewGuide.phDate'))}
                  {field('hora', t('careersPostulaciones.interviewGuide.fieldTime'), t('careersPostulaciones.interviewGuide.phTime'))}
                </div>
                <div className="mt-3">
                  {field('modalidad', t('careersPostulaciones.interviewGuide.fieldFormat'), t('careersPostulaciones.interviewGuide.phFormat'))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex rounded-lg overflow-hidden border border-[var(--border-alt)] text-xs">
                    <button
                      onClick={() => setLang('es')}
                      className={`px-3 py-1.5 ${lang === 'es' ? 'bg-sky-700 text-[var(--text-primary)]' : 'bg-[var(--bg-surface-alt)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
                    >ES</button>
                    <button
                      onClick={() => setLang('en')}
                      className={`px-3 py-1.5 ${lang === 'en' ? 'bg-sky-700 text-[var(--text-primary)]' : 'bg-[var(--bg-surface-alt)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
                    >EN</button>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reinvestigar}
                      onChange={e => setReinvestigar(e.target.checked)}
                      className="accent-violet-500"
                    />
                    <Search size={12} />
                    {t('careersPostulaciones.interviewGuide.researchAgain')}
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  {html && (
                    <button
                      onClick={() => setShowForm(false)}
                      className="px-4 py-2.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                      {t('careersPostulaciones.interviewGuide.cancel')}
                    </button>
                  )}
                  <button
                    onClick={generate}
                    className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-[var(--text-primary)] rounded-xl font-medium"
                  >
                    <Brain size={16} /> {t('careersPostulaciones.interviewGuide.generateButton')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!loading && !showForm && loadingGuide && (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={28} className="text-violet-400 animate-spin" />
            </div>
          )}

          {!loading && hasGuide && !loadingGuide && (
            <iframe
              ref={iframeRef}
              srcDoc={html}
              className="flex-1 w-full min-h-0 border-0"
              title={t('careersPostulaciones.interviewGuide.titlePrefix')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
