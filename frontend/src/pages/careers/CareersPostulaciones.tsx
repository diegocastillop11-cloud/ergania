import React, { useState, useEffect, useRef } from 'react'
import { api } from '../../lib/api'
import { saveBlob } from '../../lib/downloadFile'
import { loadLlmProvider, type LlmProvider } from '../../lib/llmProvider'
import { getKeyForProvider } from '../../lib/userApiKeys'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, FileText, Brain, MessageSquare, ExternalLink, Loader2,
  ChevronDown, ChevronUp, Copy, CheckCircle2, X, Star, Send,
  Download, Eye, Rocket, Mail, AlertTriangle, Languages, DollarSign,
  Pencil, Save, Check, MessagesSquare,
} from 'lucide-react'
import { Application, APLICACION_ESTADOS, ESTADO_CONFIG } from '../../types/careers'
import { useTranslation } from '../../lib/i18n/LanguageContext'

async function downloadPdf(appId: string, filename: string) {
  const { data } = await api.get(`/applications/${appId}/pdf`, { responseType: 'blob' })
  await saveBlob(data, filename)
}

async function downloadInterviewPrepPdf(appId: string, empresa: string, rol: string) {
  const { data } = await api.get(`/applications/${appId}/interview-prep/pdf`, { responseType: 'blob' })
  const filename = `Prep-Entrevista-${empresa.replace(/[^a-zA-Z0-9]+/g, '_')}-${rol.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`
  await saveBlob(data, filename)
}

function renderInterviewPrep(prep: string) {
  const lines = prep.replace(/\r\n/g, '\n').split('\n')
  const elements: JSX.Element[] = []
  let listType: 'ul' | 'ol' | null = null
  let listItems: JSX.Element[] = []

  const flushList = () => {
    if (listType && listItems.length > 0) {
      elements.push(
        listType === 'ul'
          ? <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1">{listItems}</ul>
          : <ol key={`list-${elements.length}`} className="list-decimal list-inside space-y-1">{listItems}</ol>
      )
      listItems = []
      listType = null
    }
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) {
      flushList()
      return
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/)
    if (headingMatch) {
      flushList()
      const level = headingMatch[1].length
      const content = headingMatch[2]
      const Tag = `h${Math.min(level, 3)}` as keyof JSX.IntrinsicElements
      elements.push(React.createElement(Tag, { key: `h-${index}`, className: 'text-[var(--text-primary)] font-semibold mt-4 mb-2' }, content))
      return
    }

    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/)
    const ulMatch = trimmed.match(/^[-*+]\s+(.*)$/)
    if (olMatch) {
      if (listType !== 'ol') {
        flushList()
        listType = 'ol'
      }
      listItems.push(<li key={`item-${index}`}>{olMatch[1]}</li>)
      return
    }
    if (ulMatch) {
      if (listType !== 'ul') {
        flushList()
        listType = 'ul'
      }
      listItems.push(<li key={`item-${index}`}>{ulMatch[1]}</li>)
      return
    }

    flushList()
    elements.push(<p key={`p-${index}`} className="text-[var(--text-secondary)] leading-7">{trimmed}</p>)
  })

  flushList()
  return elements
}

// ── Estado badge ─────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado]
  if (!cfg) return <span className="text-xs text-[var(--text-muted)] px-2 py-0.5 rounded-full bg-[var(--bg-surface-alt)]">{estado}</span>
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

// ── Modal Nueva Postulación ───────────────────────────────────────────────────

function NuevaPostulacionModal({ onClose, onCreated, offerWithoutLink }: { onClose: () => void; onCreated: () => void; offerWithoutLink: boolean }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ empresa: '', rol: '', url: '', jd: '' })
  const [llmProvider] = useState<LlmProvider>(() => loadLlmProvider())
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('')
  const [error, setError] = useState('')

  const steps = [
    t('careersPostulaciones.newModal.steps.reading'),
    t('careersPostulaciones.newModal.steps.generating'),
    t('careersPostulaciones.newModal.steps.converting'),
    t('careersPostulaciones.newModal.steps.saving'),
  ]

  const handleSubmit = async () => {
    if (!form.empresa.trim() || !form.rol.trim() || form.jd.trim().length < 100) return
    setLoading(true)
    setError('')
    let stepIdx = 0
    const tick = () => { setStep(steps[stepIdx % steps.length]); stepIdx++ }
    tick()
    const interval = setInterval(tick, 3500)
    try {
      const userApiKey = getKeyForProvider(llmProvider)
      await api.post('/applications', { ...form, llmProvider, ...(userApiKey ? { userApiKey } : {}) })
      clearInterval(interval)
      onCreated()
      onClose()
    } catch (err: unknown) {
      clearInterval(interval)
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('careersPostulaciones.newModal.genericError'))
    } finally {
      setLoading(false)
      setStep('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-alt)] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-default)]">
          <div>
            <h3 className="text-[var(--text-primary)] font-bold text-lg flex items-center gap-2">
              <Plus size={18} className="text-blue-400" /> {offerWithoutLink ? t('careersPostulaciones.newModal.titleOfferNoLink') : t('careersPostulaciones.newModal.titleNew')}
            </h3>
            <p className="text-sm text-[var(--text-tertiary)] mt-1">
              {offerWithoutLink
                ? t('careersPostulaciones.newModal.descOfferNoLink')
                : t('careersPostulaciones.newModal.descNew')}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--text-tertiary)] block mb-1">{t('careersPostulaciones.newModal.company')}</label>
              <input
                value={form.empresa}
                onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))}
                placeholder={t('careersPostulaciones.newModal.companyPlaceholder')}
                className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-tertiary)] block mb-1">{t('careersPostulaciones.newModal.role')}</label>
              <input
                value={form.rol}
                onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
                placeholder={t('careersPostulaciones.newModal.rolePlaceholder')}
                className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--text-tertiary)] block mb-1">{t('careersPostulaciones.newModal.urlLabel')}</label>
            <input
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              placeholder={t('careersPostulaciones.newModal.urlPlaceholder')}
              className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-blue-500"
            />
            <p className="text-[var(--text-muted)] text-xs mt-1">
              {offerWithoutLink
                ? t('careersPostulaciones.newModal.urlNoteOfferNoLink')
                : t('careersPostulaciones.newModal.urlNoteNew')}
            </p>
          </div>

          <div>
            <label className="text-xs text-[var(--text-tertiary)] block mb-1">
              {t('careersPostulaciones.newModal.jdLabel')} <span className="text-[var(--text-faint)]">{t('careersPostulaciones.newModal.jdCharCount', { count: form.jd.length })}</span>
            </label>
            <textarea
              value={form.jd}
              onChange={e => setForm(f => ({ ...f, jd: e.target.value }))}
              placeholder={t('careersPostulaciones.newModal.jdPlaceholder')}
              rows={10}
              className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-blue-500 resize-y font-mono"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
          )}

          {loading && step && (
            <div className="p-4 bg-blue-900/20 border border-blue-800/50 rounded-xl">
              <div className="flex items-center gap-3 text-blue-400 text-sm">
                <Loader2 size={18} className="animate-spin shrink-0" />
                <div>
                  <p className="font-medium">{step}</p>
                  <p className="text-xs text-blue-500 mt-0.5">{t('careersPostulaciones.newModal.aiWorkingNote')}</p>
                </div>
              </div>
              <div className="mt-3 h-1.5 bg-[var(--bg-surface-alt)] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-600 to-violet-600 rounded-full animate-pulse w-3/4" />
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-[var(--border-default)] flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-sm">{t('careersPostulaciones.newModal.cancel')}</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !form.empresa.trim() || !form.rol.trim() || form.jd.trim().length < 100}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {loading ? t('careersPostulaciones.newModal.generating') : t('careersPostulaciones.newModal.submit')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Panel CV Preview ──────────────────────────────────────────────────────────

export function CvPreviewPanel({ app: initialApp, onClose, onRegenerated }: {
  app: Application
  onClose: () => void
  onRegenerated?: (updatedApp: Application) => void
}) {
  const { t } = useTranslation()
  const [app, setApp] = useState(initialApp)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [regenError, setRegenError] = useState('')
  const [lang, setLang] = useState<'es' | 'en'>(initialApp.idioma || 'es')
  const [llmProvider] = useState<LlmProvider>(() => loadLlmProvider())
  const [editing, setEditing] = useState(false)
  const [savingCv, setSavingCv] = useState(false)
  const [saveCvError, setSaveCvError] = useState('')
  const [resetKey, setResetKey] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const copyHtml = () => {
    if (app.cvHtml) {
      navigator.clipboard.writeText(app.cvHtml)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const startEditing = () => {
    setSaveCvError('')
    setEditing(true)
    const doc = iframeRef.current?.contentDocument
    if (doc) doc.designMode = 'on'
  }

  const cancelEditing = () => {
    setSaveCvError('')
    setEditing(false)
    setResetKey(k => k + 1) // remonta el iframe con el HTML original, descartando cambios sin guardar
  }

  const saveEditedCv = async () => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    doc.designMode = 'off'
    const editedHtml = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML
    setSavingCv(true)
    setSaveCvError('')
    try {
      await api.patch(`/applications/${app.id}/cv`, { cvHtml: editedHtml })
      setApp(a => ({ ...a, cvHtml: editedHtml }))
      setEditing(false)
    } catch (err: unknown) {
      setSaveCvError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('careersPostulaciones.cvPreview.genericErrorSave'))
      doc.designMode = 'on' // seguimos editando si falló el guardado
    } finally {
      setSavingCv(false)
    }
  }

  const regenerate = async () => {
    setRegenerating(true)
    setRegenError('')
    try {
      const userApiKey = getKeyForProvider(llmProvider)
      await api.post(`/applications/${app.id}/regenerate-cv`, {
        llmProvider,
        idioma: lang,
        ...(userApiKey ? { userApiKey } : {}),
      })
      const { data: full } = await api.get<Application>(`/applications/${app.id}`)
      setApp(full)
      onRegenerated?.(full)
    } catch (err: unknown) {
      setRegenError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('careersPostulaciones.cvPreview.genericErrorRegen'))
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-alt)] rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)] shrink-0">
          <div>
            <h3 className="text-[var(--text-primary)] font-bold flex items-center gap-2">
              <FileText size={16} className="text-blue-400" />
              {t('careersPostulaciones.cvPreview.titlePrefix')} {app.rol} {t('careersPostulaciones.cvPreview.in')} {app.empresa}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t('careersPostulaciones.cvPreview.generatedNote')} {(app.idioma || 'es') === 'en' ? 'English' : 'Español'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg overflow-hidden border border-[var(--border-alt)] text-xs" title="Idioma del CV">
              <button
                onClick={() => setLang('es')}
                className={`px-2.5 py-1.5 ${lang === 'es' ? 'bg-sky-700 text-[var(--text-primary)]' : 'bg-[var(--bg-surface-alt)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
              >
                ES
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-2.5 py-1.5 ${lang === 'en' ? 'bg-sky-700 text-[var(--text-primary)]' : 'bg-[var(--bg-surface-alt)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
              >
                EN
              </button>
            </div>
            <button
              onClick={() => regenerate()}
              disabled={regenerating || editing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-[var(--text-primary)] rounded-lg text-xs font-medium"
              title={t('careersPostulaciones.cvPreview.regenerateTitle')}
            >
              {regenerating ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
              {regenerating ? t('careersPostulaciones.cvPreview.regenerating') : t('careersPostulaciones.cvPreview.regenerate')}
            </button>
            {app.cvHtml && !editing && (
              <button
                onClick={startEditing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-[var(--text-primary)] rounded-lg text-xs font-medium"
                title={t('careersPostulaciones.cvPreview.editCvTitle')}
              >
                <Pencil size={13} /> {t('careersPostulaciones.cvPreview.editCv')}
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={saveEditedCv}
                  disabled={savingCv}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-[var(--text-primary)] rounded-lg text-xs font-medium"
                >
                  {savingCv ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {savingCv ? t('careersPostulaciones.cvPreview.saving') : t('careersPostulaciones.cvPreview.saveChanges')}
                </button>
                <button
                  onClick={cancelEditing}
                  disabled={savingCv}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-[var(--text-secondary)] rounded-lg text-xs"
                >
                  {t('careersPostulaciones.cvPreview.cancel')}
                </button>
              </>
            )}
            {app.id && (
              <button
                onClick={() => downloadPdf(app.id, app.cvPdfFilename ?? `cv-${app.empresa}-${app.rol}.pdf`.replace(/\s+/g, '-').toLowerCase())}
                disabled={editing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-[var(--text-primary)] rounded-lg text-xs font-medium"
              >
                <Download size={13} /> {t('careersPostulaciones.cvPreview.pdf')}
              </button>
            )}
            {app.cvTex && (
              <button
                onClick={() => {
                  const blob = new Blob([app.cvTex!], { type: 'text/plain' })
                  const filename = `cv-${app.empresa}-${app.rol}.tex`.replace(/\s+/g, '-').toLowerCase()
                  saveBlob(blob, filename)
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-700 hover:bg-violet-600 text-[var(--text-primary)] rounded-lg text-xs font-medium"
                title={t('careersPostulaciones.cvPreview.downloadTexTitle')}
              >
                <Download size={13} /> .tex
              </button>
            )}
            <button
              onClick={copyHtml}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-[var(--text-secondary)] rounded-lg text-xs"
            >
              {copied ? <CheckCircle2 size={13} className="text-green-400" /> : <Copy size={13} />}
              {copied ? t('careersPostulaciones.cvPreview.copied') : t('careersPostulaciones.cvPreview.copyHtml')}
            </button>
            <button onClick={onClose} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X size={18} />
            </button>
          </div>
          {regenError && (
            <p className="text-red-400 text-xs mt-1">{regenError}</p>
          )}
          {saveCvError && (
            <p className="text-red-400 text-xs mt-1">{saveCvError}</p>
          )}
          {editing && (
            <p className="text-blue-400 text-xs mt-1 flex items-center gap-1">
              <Check size={12} /> {t('careersPostulaciones.cvPreview.editModeActive')}
            </p>
          )}
        </div>
        <div className="flex-1 overflow-hidden rounded-b-2xl">
          {app.cvHtml ? (
            <iframe
              key={resetKey}
              ref={iframeRef}
              srcDoc={app.cvHtml}
              className={`w-full h-full bg-white ${editing ? 'ring-2 ring-inset ring-blue-500' : ''}`}
              title="CV Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
              {t('careersPostulaciones.cvPreview.noHtml')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Panel Prep Entrevista ─────────────────────────────────────────────────────

function InterviewPrepPanel({ app, onClose, onGenerated }: { app: Application; onClose: () => void; onGenerated: (prep: string) => void }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [prep, setPrep] = useState(app.interviewPrep || '')
  const [error, setError] = useState('')
  const [lang, setLang] = useState<'es' | 'en'>(app.idioma || 'es')
  const [llmProvider] = useState<LlmProvider>(() => loadLlmProvider())

  const generate = async (idioma?: 'es' | 'en') => {
    const targetLang = idioma || lang
    setLoading(true)
    setError('')
    try {
      const userApiKey = getKeyForProvider(llmProvider)
      const { data } = await api.post(`/applications/${app.id}/interview-prep`, {
        llmProvider,
        idioma: targetLang,
        ...(userApiKey ? { userApiKey } : {}),
      })
      setPrep(data.prep)
      setLang(targetLang)
      onGenerated(data.prep)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (err as Error)?.message
        || t('careersPostulaciones.interviewPrep.genericError')
      setError(msg)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const copyPrep = () => navigator.clipboard.writeText(prep)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-alt)] rounded-2xl w-full max-w-3xl h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)] shrink-0">
          <div>
            <h3 className="text-[var(--text-primary)] font-bold flex items-center gap-2">
              <Brain size={16} className="text-violet-400" />
              {t('careersPostulaciones.interviewPrep.titlePrefix')} {app.empresa}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{t('careersPostulaciones.interviewPrep.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-[var(--border-alt)] text-xs" title="Idioma de la guía">
              <button
                onClick={() => setLang('es')}
                className={`px-2.5 py-1.5 ${lang === 'es' ? 'bg-sky-700 text-[var(--text-primary)]' : 'bg-[var(--bg-surface-alt)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
              >
                ES
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-2.5 py-1.5 ${lang === 'en' ? 'bg-sky-700 text-[var(--text-primary)]' : 'bg-[var(--bg-surface-alt)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
              >
                EN
              </button>
            </div>
            {prep && (
              <>
                <button
                  onClick={() => generate()}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-[var(--text-primary)] rounded-lg text-xs"
                  title={t('careersPostulaciones.interviewPrep.regenerateTitle')}
                >
                  {loading ? <Loader2 size={13} className="animate-spin" /> : <Languages size={13} />} {t('careersPostulaciones.interviewPrep.regenerate')}
                </button>
                <button
                  onClick={copyPrep}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-[var(--text-secondary)] rounded-lg text-xs"
                >
                  <Copy size={13} /> {t('careersPostulaciones.interviewPrep.copy')}
                </button>
                <button
                  onClick={async () => {
                    setError('')
                    try {
                      await downloadInterviewPrepPdf(app.id, app.empresa, app.rol)
                    } catch (err: unknown) {
                      setError(t('careersPostulaciones.interviewPrep.downloadError'))
                      console.error(err)
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-[var(--text-primary)] rounded-lg text-xs"
                >
                  <Download size={13} /> {t('careersPostulaciones.interviewPrep.downloadPdf')}
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && !loading && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-xl text-red-300 text-sm">
              {error}
            </div>
          )}

          {!prep && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-900/30 flex items-center justify-center">
                <Brain size={28} className="text-violet-400" />
              </div>
              <div>
                <p className="text-[var(--text-primary)] font-semibold">{t('careersPostulaciones.interviewPrep.readyTitle')}</p>
                <p className="text-[var(--text-tertiary)] text-sm mt-1 max-w-sm">
                  {t('careersPostulaciones.interviewPrep.readyDesc')}
                </p>
              </div>
              <button
                onClick={() => generate()}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-[var(--text-primary)] rounded-xl font-medium"
              >
                <Brain size={16} /> {t('careersPostulaciones.interviewPrep.generateButton')}
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Loader2 size={32} className="text-violet-400 animate-spin" />
              <p className="text-[var(--text-tertiary)] text-sm">{t('careersPostulaciones.interviewPrep.loadingNote')}</p>
            </div>
          )}

          {prep && !loading && (
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="space-y-3 text-sm leading-7">
                {renderInterviewPrep(prep)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Panel Responder Preguntas ─────────────────────────────────────────────────

function QnAPanel({ app, onClose }: { app: Application; onClose: () => void }) {
  const { t, tList } = useTranslation()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [lang, setLang] = useState<'es' | 'en'>(app.idioma || 'es')
  const [llmProvider] = useState<LlmProvider>(() => loadLlmProvider())

  const generate = async () => {
    if (!question.trim()) return
    setLoading(true)
    setAnswer('')
    setError('')
    try {
      const userApiKey = getKeyForProvider(llmProvider)
      const { data } = await api.post(`/applications/${app.id}/answer`, {
        question,
        llmProvider,
        idioma: lang,
        ...(userApiKey ? { userApiKey } : {}),
      })
      setAnswer(data.answer)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (err as Error)?.message
        || t('careersPostulaciones.qna.genericError')
      setError(msg)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const copyAnswer = () => {
    navigator.clipboard.writeText(answer)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const EJEMPLOS = tList('careersPostulaciones.qna.examples')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-alt)] rounded-2xl w-full max-w-2xl h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)] shrink-0">
          <div>
            <h3 className="text-[var(--text-primary)] font-bold flex items-center gap-2">
              <MessageSquare size={16} className="text-green-400" />
              {t('careersPostulaciones.qna.titlePrefix')} {app.empresa}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{t('careersPostulaciones.qna.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-[var(--border-alt)] text-xs">
              <button
                onClick={() => setLang('es')}
                className={`px-2.5 py-1.5 ${lang === 'es' ? 'bg-sky-700 text-[var(--text-primary)]' : 'bg-[var(--bg-surface-alt)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
                title={t('careersPostulaciones.qna.langEsTitle')}
              >
                ES
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-2.5 py-1.5 ${lang === 'en' ? 'bg-sky-700 text-[var(--text-primary)]' : 'bg-[var(--bg-surface-alt)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
                title={t('careersPostulaciones.qna.langEnTitle')}
              >
                EN
              </button>
            </div>
            <button onClick={onClose} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* Ejemplos rápidos */}
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-2">{t('careersPostulaciones.qna.commonQuestions')}</p>
            <div className="flex flex-wrap gap-2">
              {EJEMPLOS.map(ej => (
                <button
                  key={ej}
                  onClick={() => setQuestion(ej)}
                  className="text-xs bg-[var(--bg-surface-alt)] hover:bg-gray-700 text-[var(--text-secondary)] px-2.5 py-1.5 rounded-lg transition-colors text-left"
                >
                  {ej}
                </button>
              ))}
            </div>
          </div>

          {/* Input pregunta */}
          <div>
            <label className="text-xs text-[var(--text-tertiary)] block mb-1">{t('careersPostulaciones.qna.questionLabel')}</label>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder={t('careersPostulaciones.qna.questionPlaceholder')}
              rows={3}
              className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-green-500 resize-none"
            />
            <button
              onClick={generate}
              disabled={!question.trim() || loading}
              className="mt-2 flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-[var(--text-primary)] rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {loading ? t('careersPostulaciones.qna.generating') : t('careersPostulaciones.qna.generateButton')}
            </button>
          </div>

          {/* Respuesta */}
          {loading && (
            <div className="flex items-center gap-3 p-4 bg-green-900/20 border border-green-800/50 rounded-xl text-green-400 text-sm">
              <Loader2 size={16} className="animate-spin shrink-0" />
              {t('careersPostulaciones.qna.generatingNote')}
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-800/50 rounded-xl text-red-400 text-sm">
              <AlertTriangle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {answer && !loading && (
            <div className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-green-400" /> {t('careersPostulaciones.qna.answerGenerated')}
                </p>
                <button
                  onClick={copyAnswer}
                  className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  {copied ? <CheckCircle2 size={12} className="text-green-400" /> : <Copy size={12} />}
                  {copied ? t('careersPostulaciones.qna.copied') : t('careersPostulaciones.qna.copy')}
                </button>
              </div>
              <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{answer}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Simulador de Entrevista (chat: pregunta → respuesta del usuario → feedback) ─

interface SimTurn { pregunta: string; respuesta: string; feedback: string }

function InterviewSimulatorPanel({ app, onClose }: { app: Application; onClose: () => void }) {
  const { t } = useTranslation()
  const [lang] = useState<'es' | 'en'>(app.idioma || 'es')
  const [llmProvider] = useState<LlmProvider>(() => loadLlmProvider())
  const [preguntas, setPreguntas] = useState<string[]>([])
  const [idx, setIdx] = useState(0)
  const [respuesta, setRespuesta] = useState('')
  const [history, setHistory] = useState<SimTurn[]>([])
  const [loadingPreguntas, setLoadingPreguntas] = useState(true)
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadQuestions = async () => {
      setLoadingPreguntas(true)
      setError('')
      try {
        const userApiKey = getKeyForProvider(llmProvider)
        const { data } = await api.post(`/applications/${app.id}/interview-simulate/questions`, {
          llmProvider, idioma: lang, ...(userApiKey ? { userApiKey } : {}),
        })
        setPreguntas(data.preguntas || [])
      } catch (err: unknown) {
        setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('careersPostulaciones.simulator.questionsError'))
      } finally {
        setLoadingPreguntas(false)
      }
    }
    loadQuestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [history, loadingFeedback])

  const submitRespuesta = async () => {
    if (!respuesta.trim()) return
    setLoadingFeedback(true)
    setError('')
    try {
      const userApiKey = getKeyForProvider(llmProvider)
      const { data } = await api.post(`/applications/${app.id}/interview-simulate/feedback`, {
        pregunta: preguntas[idx], respuesta, llmProvider, idioma: lang, ...(userApiKey ? { userApiKey } : {}),
      })
      setHistory(h => [...h, { pregunta: preguntas[idx], respuesta, feedback: data.feedback }])
      setRespuesta('')
      setIdx(i => i + 1) // avanza sola a la siguiente pregunta
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('careersPostulaciones.simulator.feedbackError'))
    } finally {
      setLoadingFeedback(false)
    }
  }

  const done = idx >= preguntas.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-alt)] rounded-2xl w-full max-w-2xl h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)] shrink-0">
          <div>
            <h3 className="text-[var(--text-primary)] font-bold flex items-center gap-2">
              <MessagesSquare size={16} className="text-indigo-400" />
              {t('careersPostulaciones.simulator.titlePrefix')} {app.empresa}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {loadingPreguntas ? t('careersPostulaciones.simulator.generatingQuestions') : t('careersPostulaciones.simulator.questionCounter', { current: Math.min(idx + 1, preguntas.length), total: preguntas.length })}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {loadingPreguntas && (
            <div className="flex items-center gap-3 p-4 bg-indigo-900/20 border border-indigo-800/50 rounded-xl text-indigo-300 text-sm">
              <Loader2 size={16} className="animate-spin shrink-0" />
              {t('careersPostulaciones.simulator.preparingQuestions', { role: app.rol })}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-800/50 rounded-xl text-red-400 text-sm">
              <AlertTriangle size={16} className="shrink-0" /> {error}
            </div>
          )}

          {/* Historial de turnos ya respondidos */}
          {history.map((turn, i) => (
            <div key={i} className="space-y-2">
              <div className="bg-indigo-900/20 border border-indigo-800/40 rounded-xl p-3">
                <p className="text-xs text-indigo-400 font-medium mb-1">{t('careersPostulaciones.simulator.interviewer')}</p>
                <p className="text-gray-200 text-sm">{turn.pregunta}</p>
              </div>
              <div className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl p-3 ml-4">
                <p className="text-xs text-[var(--text-muted)] font-medium mb-1">{t('careersPostulaciones.simulator.yourAnswer')}</p>
                <p className="text-[var(--text-secondary)] text-sm whitespace-pre-wrap">{turn.respuesta}</p>
              </div>
              <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-3 ml-4">
                <p className="text-xs text-emerald-400 font-medium mb-1">{t('careersPostulaciones.simulator.feedback')}</p>
                <p className="text-[var(--text-secondary)] text-sm whitespace-pre-wrap">{turn.feedback}</p>
              </div>
            </div>
          ))}

          {/* Pregunta activa */}
          {!loadingPreguntas && !done && (
            <div className="bg-indigo-900/20 border border-indigo-800/40 rounded-xl p-3">
              <p className="text-xs text-indigo-400 font-medium mb-1">{t('careersPostulaciones.simulator.interviewer')}</p>
              <p className="text-gray-200 text-sm">{preguntas[idx]}</p>
            </div>
          )}

          {done && !loadingPreguntas && (
            <div className="flex items-center gap-3 p-4 bg-emerald-900/20 border border-emerald-800/50 rounded-xl text-emerald-300 text-sm">
              <CheckCircle2 size={16} className="shrink-0" />
              {t('careersPostulaciones.simulator.completed', { count: history.length })}
            </div>
          )}
        </div>

        {!loadingPreguntas && !done && (
          <div className="p-4 border-t border-[var(--border-default)] shrink-0 space-y-2">
            <textarea
              value={respuesta}
              onChange={e => setRespuesta(e.target.value)}
              placeholder={t('careersPostulaciones.simulator.answerPlaceholder')}
              rows={3}
              disabled={loadingFeedback}
              className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-indigo-500 resize-none disabled:opacity-60"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={submitRespuesta}
                disabled={!respuesta.trim() || loadingFeedback}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-[var(--text-primary)] rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {loadingFeedback ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {loadingFeedback ? t('careersPostulaciones.simulator.evaluating') : t('careersPostulaciones.simulator.sendAnswer')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Panel Postular (Apply Kit) ────────────────────────────────────────────────

interface ApplyKitItem { pregunta: string; respuesta: string; tip?: string }

function ApplyKitPanel({ app, onClose }: { app: Application; onClose: () => void }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [kit, setKit] = useState<ApplyKitItem[]>([])
  const [formularioDetectado, setFormularioDetectado] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [llmProvider] = useState<LlmProvider>(() => loadLlmProvider())
  const [carta, setCarta] = useState(app.coverLetter || '')
  const [cartaLoading, setCartaLoading] = useState(false)
  const [cartaError, setCartaError] = useState('')
  const [cartaCopied, setCartaCopied] = useState(false)

  const generate = async () => {
    setLoading(true)
    setError('')
    setKit([])
    try {
      const userApiKey = getKeyForProvider(llmProvider)
      const { data } = await api.post(`/applications/${app.id}/apply-kit`, {
        llmProvider,
        ...(userApiKey ? { userApiKey } : {}),
      })
      setKit(data.kit?.preguntas || [])
      setFormularioDetectado(data.formulario_detectado ?? false)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('careersPostulaciones.applyKit.genericError'))
    } finally {
      setLoading(false)
    }
  }

  // 1 clic: las respuestas se generan solas al abrir el kit
  useEffect(() => { generate() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const generateCarta = async () => {
    setCartaLoading(true)
    setCartaError('')
    try {
      const userApiKey = getKeyForProvider(llmProvider)
      const { data } = await api.post(`/applications/${app.id}/cover-letter`, {
        llmProvider,
        ...(userApiKey ? { userApiKey } : {}),
      })
      setCarta(data.coverLetter)
    } catch (err: unknown) {
      setCartaError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('careersPostulaciones.applyKit.genericLetterError'))
    } finally {
      setCartaLoading(false)
    }
  }

  const copyCarta = () => {
    navigator.clipboard.writeText(carta)
    setCartaCopied(true)
    setTimeout(() => setCartaCopied(false), 2000)
  }

  const copyItem = (idx: number, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(idx)
    setTimeout(() => setCopied(null), 2000)
  }

  const openJob = () => {
    if (app.url) window.open(app.url, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-alt)] rounded-2xl w-full max-w-3xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)] shrink-0">
          <div>
            <h3 className="text-[var(--text-primary)] font-bold flex items-center gap-2">
              <Rocket size={16} className="text-orange-400" />
              {t('careersPostulaciones.applyKit.titlePrefix')} {app.empresa}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{t('careersPostulaciones.applyKit.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {app.id && (
              <button
                onClick={() => downloadPdf(app.id, app.cvPdfFilename ?? `cv-${app.empresa}-${app.rol}.pdf`.replace(/\s+/g, '-').toLowerCase())}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-[var(--text-primary)] rounded-lg text-xs font-medium"
                title={t('careersPostulaciones.applyKit.downloadCvTitle')}
              >
                <Download size={12} /> {t('careersPostulaciones.applyKit.downloadCv')}
              </button>
            )}
            {app.url && (
              <button
                onClick={openJob}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] rounded-lg text-xs font-medium"
              >
                <ExternalLink size={12} /> {t('careersPostulaciones.applyKit.openOffer')}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Estado inicial */}
          {kit.length === 0 && !loading && !error && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-orange-900/30 flex items-center justify-center">
                <Rocket size={28} className="text-orange-400" />
              </div>
              <div>
                <p className="text-[var(--text-primary)] font-semibold">{t('careersPostulaciones.applyKit.readyTitle')}</p>
                <p className="text-[var(--text-tertiary)] text-sm mt-1 max-w-sm">
                  {t('careersPostulaciones.applyKit.readyDesc', { company: app.empresa })}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-wrap justify-center">
                <button
                  onClick={generate}
                  className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-[var(--text-primary)] rounded-xl font-medium"
                >
                  <Rocket size={16} /> {t('careersPostulaciones.applyKit.generateAnswers')}
                </button>
                {app.id && (
                  <button
                    onClick={() => downloadPdf(app.id, app.cvPdfFilename ?? `cv-${app.empresa}-${app.rol}.pdf`.replace(/\s+/g, '-').toLowerCase())}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-700 hover:bg-green-600 text-[var(--text-primary)] rounded-xl font-medium"
                  >
                    <Download size={16} /> {t('careersPostulaciones.applyKit.downloadCv')}
                  </button>
                )}
                {app.url && (
                  <button
                    onClick={openJob}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-xl font-medium"
                  >
                    <ExternalLink size={16} /> {t('careersPostulaciones.applyKit.openForm')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Loader2 size={32} className="text-orange-400 animate-spin" />
              <div className="text-center">
                <p className="text-[var(--text-secondary)] font-medium">{t('careersPostulaciones.applyKit.loadingTitle')}</p>
                <p className="text-[var(--text-muted)] text-sm mt-1">{t('careersPostulaciones.applyKit.loadingNote')}</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-900/30 border border-red-800 rounded-xl text-red-400 text-sm">
              {error}
              <button onClick={generate} className="ml-3 underline hover:no-underline">{t('careersPostulaciones.applyKit.retry')}</button>
            </div>
          )}

          {/* Kit generado */}
          {kit.length > 0 && !loading && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--text-tertiary)] flex items-center gap-2">
                  <span className="text-[var(--text-primary)] font-medium">{kit.length}</span> {t('careersPostulaciones.applyKit.answersGenerated')}
                  {formularioDetectado
                    ? <span className="text-[10px] bg-green-900/40 text-green-400 border border-green-800/50 px-2 py-0.5 rounded-full">{t('careersPostulaciones.applyKit.formDetected')}</span>
                    : <span className="text-[10px] bg-[var(--bg-surface-alt)] text-[var(--text-muted)] border border-[var(--border-alt)] px-2 py-0.5 rounded-full">{t('careersPostulaciones.applyKit.commonQuestions')}</span>
                  }
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={generate}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center gap-1"
                  >
                    <Rocket size={11} /> {t('careersPostulaciones.applyKit.regenerate')}
                  </button>
                  {app.url && (
                    <button
                      onClick={openJob}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] rounded-lg text-xs font-medium"
                    >
                      <ExternalLink size={11} /> {t('careersPostulaciones.applyKit.openForm')}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {kit.map((item, idx) => (
                  <div key={idx} className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm font-medium text-orange-300">{item.pregunta}</p>
                      <button
                        onClick={() => copyItem(idx, item.respuesta)}
                        className="shrink-0 flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        {copied === idx
                          ? <><CheckCircle2 size={12} className="text-green-400" /> {t('careersPostulaciones.applyKit.copied')}</>
                          : <><Copy size={12} /> {t('careersPostulaciones.applyKit.copy')}</>
                        }
                      </button>
                    </div>
                    <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{item.respuesta}</p>
                    {item.tip && (
                      <p className="mt-2 text-xs text-[var(--text-muted)] italic border-t border-[var(--border-alt)] pt-2">
                        💡 {item.tip}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Carta de presentación integrada al kit */}
          {!loading && (
            <div className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-sm font-medium text-orange-300 flex items-center gap-2">
                  <Mail size={13} /> {t('careersPostulaciones.applyKit.coverLetterTitle')}
                </p>
                {carta ? (
                  <button
                    onClick={copyCarta}
                    className="shrink-0 flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {cartaCopied
                      ? <><CheckCircle2 size={12} className="text-green-400" /> {t('careersPostulaciones.applyKit.copied')}</>
                      : <><Copy size={12} /> {t('careersPostulaciones.applyKit.copy')}</>
                    }
                  </button>
                ) : (
                  <button
                    onClick={generateCarta}
                    disabled={cartaLoading}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-[var(--text-primary)] rounded-lg text-xs font-medium"
                  >
                    {cartaLoading
                      ? <><Loader2 size={12} className="animate-spin" /> {t('careersPostulaciones.applyKit.generatingLetter')}</>
                      : <><Mail size={12} /> {t('careersPostulaciones.applyKit.generateLetter')}</>
                    }
                  </button>
                )}
              </div>
              {carta
                ? <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{carta}</p>
                : !cartaLoading && <p className="text-[var(--text-muted)] text-xs">{t('careersPostulaciones.applyKit.noLetterNote')}</p>
              }
              {cartaError && <p className="text-xs text-red-400 mt-2">{cartaError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Panel Carta de Presentación ───────────────────────────────────────────────

function CoverLetterPanel({ app, onGenerated, onClose }: { app: Application; onGenerated: (letter: string) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [lang, setLang] = useState<'es' | 'en'>(app.idioma || 'es')
  const [llmProvider] = useState<LlmProvider>(() => loadLlmProvider())

  const letter = app.coverLetter

  const copy = () => {
    if (letter) {
      navigator.clipboard.writeText(letter)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const generate = async (idioma?: 'es' | 'en') => {
    const targetLang = idioma || lang
    setGenerating(true)
    setGenError('')
    try {
      const userApiKey = getKeyForProvider(llmProvider)
      const { data } = await api.post(`/applications/${app.id}/cover-letter`, {
        llmProvider,
        idioma: targetLang,
        ...(userApiKey ? { userApiKey } : {}),
      })
      setLang(targetLang)
      onGenerated(data.coverLetter)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (err as Error)?.message
        || t('careersPostulaciones.coverLetter.genericError')
      setGenError(msg)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-alt)] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)] shrink-0">
          <div>
            <h3 className="text-[var(--text-primary)] font-bold flex items-center gap-2">
              <Mail size={16} className="text-teal-400" />
              {t('careersPostulaciones.coverLetter.titlePrefix')} {app.empresa}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{t('careersPostulaciones.coverLetter.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {letter && (
              <button
                onClick={copy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-[var(--text-secondary)] rounded-lg text-xs"
              >
                {copied ? <><CheckCircle2 size={13} className="text-green-400" /> {t('careersPostulaciones.coverLetter.copied')}</> : <><Copy size={13} /> {t('careersPostulaciones.coverLetter.copy')}</>}
              </button>
            )}
            <div className="flex rounded-lg overflow-hidden border border-[var(--border-alt)] text-xs" title="Idioma de la carta">
              <button
                onClick={() => setLang('es')}
                className={`px-2.5 py-1.5 ${lang === 'es' ? 'bg-sky-700 text-[var(--text-primary)]' : 'bg-[var(--bg-surface-alt)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
              >
                ES
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-2.5 py-1.5 ${lang === 'en' ? 'bg-sky-700 text-[var(--text-primary)]' : 'bg-[var(--bg-surface-alt)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
              >
                EN
              </button>
            </div>
            {letter && (
              <button
                onClick={() => generate()}
                disabled={generating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-600 text-[var(--text-primary)] rounded-lg text-xs disabled:opacity-50"
                title={t('careersPostulaciones.coverLetter.regenerateTitle')}
              >
                {generating ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {t('careersPostulaciones.coverLetter.regenerate')}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {letter ? (
            <div className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl p-5">
              <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{letter}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 gap-4 text-center">
              <Mail size={32} className="text-[var(--text-faint)]" />
              <p className="text-[var(--text-tertiary)] text-sm">{t('careersPostulaciones.coverLetter.emptyNote')}</p>
              <button
                onClick={() => generate()}
                disabled={generating}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-[var(--text-primary)] rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {generating ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                {generating ? t('careersPostulaciones.coverLetter.generating') : t('careersPostulaciones.coverLetter.generateButton')}
              </button>
            </div>
          )}
          {genError && (
            <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-800/50 rounded-xl text-red-400 text-sm">
              <AlertTriangle size={16} className="shrink-0" />
              {genError}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Panel Renta a Pedir ────────────────────────────────────────────────────────

export function SalaryPanel({ app, onClose }: { app: Application; onClose: () => void }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rec, setRec] = useState<{ rango_min: number; rango_max: number; moneda: string; explicacion: string; basadoEnAncla: boolean } | null>(null)
  // Ya evaluada la oferta en Tracker → reusar ese estimado en vez de gastar tokens de nuevo.
  const [existingEstimate, setExistingEstimate] = useState(app.salario_clp || '')

  const generate = async (forceRefresh = false) => {
    setLoading(true)
    setError('')
    try {
      const provider = loadLlmProvider()
      const userApiKey = getKeyForProvider(provider)
      const { data } = await api.post('/salary-recommendation', {
        applicationId: app.id,
        llmProvider: provider,
        ...(forceRefresh ? { forceRefresh: true } : {}),
        ...(userApiKey ? { userApiKey } : {}),
      })
      if (data.fromCache && data.salario_clp) {
        setExistingEstimate(data.salario_clp)
        setRec(null)
      } else {
        setRec(data)
        setExistingEstimate('')
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('careersPostulaciones.salary.genericError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!existingEstimate) generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-alt)] rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
          <div>
            <h3 className="text-[var(--text-primary)] font-bold flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-400" />
              {t('careersPostulaciones.salary.titlePrefix')} {app.rol} {t('careersPostulaciones.salary.in')} {app.empresa}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{t('careersPostulaciones.salary.subtitle')}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button>
        </div>
        <div className="p-5">
          {existingEstimate && (
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{existingEstimate}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t('careersPostulaciones.salary.calculatedNote')}</p>
              <button
                onClick={() => generate(true)}
                disabled={loading}
                className="mt-3 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : null}
                {loading ? t('careersPostulaciones.salary.recalculating') : t('careersPostulaciones.salary.recalculate')}
              </button>
            </div>
          )}
          {!existingEstimate && loading && (
            <div className="flex items-center justify-center py-8 text-[var(--text-tertiary)] gap-2 text-sm">
              <Loader2 size={18} className="animate-spin" /> {t('careersPostulaciones.salary.calculating')}
            </div>
          )}
          {!existingEstimate && !loading && error && (
            <div className="text-sm">
              <p className="text-red-400">{error}</p>
              <button onClick={() => generate()} className="mt-2 text-blue-400 hover:text-blue-300 underline text-xs">{t('careersPostulaciones.salary.retry')}</button>
            </div>
          )}
          {!existingEstimate && !loading && rec && (
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {rec.rango_min.toLocaleString('es-CL')} - {rec.rango_max.toLocaleString('es-CL')} {rec.moneda}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {rec.basadoEnAncla ? t('careersPostulaciones.salary.basedOnAnchor') : t('careersPostulaciones.salary.generalEstimate')} · {t('careersPostulaciones.salary.monthlyNet')}
              </p>
              <p className="text-[var(--text-tertiary)] text-sm mt-3 leading-relaxed">{rec.explicacion}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Application Card ──────────────────────────────────────────────────────────

function ApplicationCard({ app: appSummary }: { app: Omit<Application, 'cvHtml'> }) {
  const { t } = useTranslation()
  const [fullApp, setFullApp] = useState<Application | null>(null)
  const [showCv, setShowCv] = useState(false)
  const [showPrep, setShowPrep] = useState(false)
  const [showQnA, setShowQnA] = useState(false)
  const [showSimulator, setShowSimulator] = useState(false)
  const [showApply, setShowApply] = useState(false)
  const [showCoverLetter, setShowCoverLetter] = useState(false)
  const [showSalary, setShowSalary] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [loadingFull, setLoadingFull] = useState(false)
  const qc = useQueryClient()

  const loadFullApp = async () => {
    if (fullApp) return
    setLoadingFull(true)
    try {
      const { data } = await api.get<Application>(`/applications/${appSummary.id}`)
      setFullApp(data)
    } finally {
      setLoadingFull(false)
    }
  }

  const openCv = async () => { await loadFullApp(); setShowCv(true) }
  const openPrep = async () => { await loadFullApp(); setShowPrep(true) }
  const openQnA = async () => { await loadFullApp(); setShowQnA(true) }
  const openSimulator = async () => { await loadFullApp(); setShowSimulator(true) }
  const openApply = async () => { await loadFullApp(); setShowApply(true) }
  const openCoverLetter = async () => { await loadFullApp(); setShowCoverLetter(true) }
  const openSalary = async () => { await loadFullApp(); setShowSalary(true) }

  const statusMut = useMutation({
    mutationFn: (estado: string) => api.patch(`/applications/${appSummary.id}`, { estado }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['applications'] }),
  })

  return (
    <>
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl overflow-hidden hover:border-[var(--border-alt)] transition-colors">
        {/* Header */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[var(--text-primary)] font-semibold truncate">{appSummary.empresa}</h3>
                {appSummary.url && (
                  <a href={appSummary.url} target="_blank" rel="noopener noreferrer"
                    className="text-[var(--text-muted)] hover:text-blue-400">
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
              <p className="text-[var(--text-tertiary)] text-sm">{appSummary.rol}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <EstadoBadge estado={appSummary.estado} />
                {appSummary.score != null && (
                  <span className={`flex items-center gap-1 text-xs font-medium ${
                    appSummary.score >= 3.5 ? 'text-yellow-400' :
                    appSummary.score >= 2.5 ? 'text-orange-400' : 'text-red-400'
                  }`}>
                    <Star size={11} fill="currentColor" /> {appSummary.score}
                    {appSummary.score < 3.5 && (
                      <span title={t('careersPostulaciones.card.lowScoreTitle')}>
                        <AlertTriangle size={11} className="ml-0.5" />
                      </span>
                    )}
                  </span>
                )}
                <span className="text-xs text-[var(--text-faint)]">{appSummary.fecha}</span>
              </div>
            </div>

            {/* Badges estado */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {appSummary.cvPdfFilename && (
                <span className="text-[10px] text-green-400 flex items-center gap-1">
                  <CheckCircle2 size={10} /> {t('careersPostulaciones.card.pdfReady')}
                </span>
              )}
              {appSummary.interviewPrep && (
                <span className="text-[10px] text-violet-400 flex items-center gap-1">
                  <Brain size={10} /> {t('careersPostulaciones.card.prepReady')}
                </span>
              )}
            </div>
          </div>

          {/* Acciones rápidas */}
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={openCv}
              disabled={loadingFull}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-800/50 text-blue-300 rounded-lg text-xs font-medium transition-colors"
            >
              {loadingFull ? <Loader2 size={11} className="animate-spin" /> : <Eye size={11} />}
              {t('careersPostulaciones.card.viewCv')}
            </button>
            <button
              onClick={openPrep}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-900/40 hover:bg-violet-800/60 border border-violet-800/50 text-violet-300 rounded-lg text-xs font-medium transition-colors"
            >
              <Brain size={11} />
              {appSummary.interviewPrep ? t('careersPostulaciones.card.viewPrep') : t('careersPostulaciones.card.preparePrep')}
            </button>
            <button
              onClick={openQnA}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/40 hover:bg-green-800/60 border border-green-800/50 text-green-300 rounded-lg text-xs font-medium transition-colors"
            >
              <MessageSquare size={11} /> {t('careersPostulaciones.card.answerQuestions')}
            </button>
            <button
              onClick={openSimulator}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-900/40 hover:bg-indigo-800/60 border border-indigo-800/50 text-indigo-300 rounded-lg text-xs font-medium transition-colors"
            >
              <MessagesSquare size={11} /> {t('careersPostulaciones.card.simulateInterview')}
            </button>
            <button
              onClick={openApply}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-900/40 hover:bg-orange-800/60 border border-orange-800/50 text-orange-300 rounded-lg text-xs font-medium transition-colors"
            >
              <Rocket size={11} /> {t('careersPostulaciones.card.applyKit')}
            </button>
            <button
              onClick={openCoverLetter}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-900/40 hover:bg-teal-800/60 border border-teal-800/50 text-teal-300 rounded-lg text-xs font-medium transition-colors"
            >
              <Mail size={11} /> {t('careersPostulaciones.card.coverLetter')}
            </button>
            <button
              onClick={openSalary}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-800/50 text-emerald-300 rounded-lg text-xs font-medium transition-colors"
            >
              <DollarSign size={11} /> {t('careersPostulaciones.card.salaryRequest')}
            </button>
            <button
              onClick={() => setExpanded(e => !e)}
              className="ml-auto flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? t('careersPostulaciones.card.less') : t('careersPostulaciones.card.more')}
            </button>
          </div>
        </div>

        {/* Expandible: cambiar estado + notas */}
        {expanded && (
          <div className="border-t border-[var(--border-default)] p-4 bg-gray-800/30">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-[var(--text-muted)]">{t('careersPostulaciones.card.changeStatus')}</p>
              {APLICACION_ESTADOS.map(estado => (
                <button
                  key={estado}
                  onClick={() => statusMut.mutate(estado)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    appSummary.estado === estado
                      ? 'bg-blue-600 border-blue-500 text-[var(--text-primary)]'
                      : 'border-[var(--border-alt)] text-[var(--text-tertiary)] hover:border-gray-500 hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {estado}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modales */}
      {showCv && fullApp && (
        <CvPreviewPanel
          app={fullApp}
          onClose={() => setShowCv(false)}
          onRegenerated={updated => setFullApp(updated)}
        />
      )}
      {showPrep && fullApp && (
        <InterviewPrepPanel
          app={fullApp}
          onClose={() => setShowPrep(false)}
          onGenerated={prep => setFullApp(a => a ? { ...a, interviewPrep: prep } : a)}
        />
      )}
      {showQnA && fullApp && (
        <QnAPanel app={fullApp} onClose={() => setShowQnA(false)} />
      )}
      {showSimulator && fullApp && (
        <InterviewSimulatorPanel app={fullApp} onClose={() => setShowSimulator(false)} />
      )}
      {showApply && fullApp && (
        <ApplyKitPanel app={fullApp} onClose={() => setShowApply(false)} />
      )}
      {showCoverLetter && fullApp && (
        <CoverLetterPanel
          app={fullApp}
          onGenerated={(letter) => setFullApp(prev => prev ? { ...prev, coverLetter: letter } : prev)}
          onClose={() => setShowCoverLetter(false)}
        />
      )}
      {showSalary && fullApp && (
        <SalaryPanel app={fullApp} onClose={() => setShowSalary(false)} />
      )}
    </>
  )
}

// ── Página Principal ──────────────────────────────────────────────────────────

export default function CareersPostulaciones() {
  const { t } = useTranslation()
  const [showModal, setShowModal] = useState(false)
  const [offerWithoutLink, setOfferWithoutLink] = useState(false)
  const qc = useQueryClient()

  const { data: apps = [], isLoading } = useQuery<Omit<Application, 'cvHtml'>[]>({
    queryKey: ['applications'],
    queryFn: () => api.get('/applications').then(r => r.data),
  })

  const byEstado = apps.reduce<Record<string, number>>((acc, a) => {
    acc[a.estado] = (acc[a.estado] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">{t('careersPostulaciones.title')}</h2>
          <p className="text-[var(--text-tertiary)] mt-1 text-sm">
            {t('careersPostulaciones.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => { setOfferWithoutLink(false); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] rounded-xl font-medium text-sm"
          >
            <Plus size={16} /> {t('careersPostulaciones.newApplication')}
          </button>
          <button
            onClick={() => { setOfferWithoutLink(true); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-surface-alt)] hover:bg-gray-700 text-gray-200 rounded-xl font-medium text-sm border border-[var(--border-alt)]"
          >
            <FileText size={16} /> {t('careersPostulaciones.offerWithoutLink')}
          </button>
        </div>
      </div>

      {/* Stats rápidas */}
      {apps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(byEstado).map(([estado, count]) => (
            <div key={estado} className="flex items-center gap-1.5 bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] px-3 py-1.5 rounded-lg">
              <EstadoBadge estado={estado} />
              <span className="text-[var(--text-tertiary)] text-xs font-medium">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-[var(--text-muted)]">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-surface-alt)] flex items-center justify-center">
            <FileText size={28} className="text-[var(--text-faint)]" />
          </div>
          <div>
            <p className="text-[var(--text-primary)] font-semibold">{t('careersPostulaciones.emptyTitle')}</p>
            <p className="text-[var(--text-tertiary)] text-sm mt-1">
              {t('careersPostulaciones.emptyDesc')}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] rounded-xl font-medium"
          >
            <Plus size={16} /> {t('careersPostulaciones.createFirst')}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {[...apps]
            .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id))
            .map(app => (
              <ApplicationCard key={app.id} app={app} />
            ))}
        </div>
      )}

      {/* Modal nueva postulación */}
      {showModal && (
        <NuevaPostulacionModal
          offerWithoutLink={offerWithoutLink}
          onClose={() => { setShowModal(false); setOfferWithoutLink(false) }}
          onCreated={() => qc.invalidateQueries({ queryKey: ['applications'] })}
        />
      )}
    </div>
  )
}
