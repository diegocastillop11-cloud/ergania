import React, { useState } from 'react'
import { api } from '../../lib/api'
import { loadLlmProvider, type LlmProvider } from '../../lib/llmProvider'
import { getKeyForProvider } from '../../lib/userApiKeys'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, FileText, Brain, MessageSquare, ExternalLink, Loader2,
  ChevronDown, ChevronUp, Copy, CheckCircle2, X, Star, Send,
  Download, Eye, Rocket, Mail, AlertTriangle,
} from 'lucide-react'
import { Application, APLICACION_ESTADOS, ESTADO_CONFIG } from '../../types/careers'

async function downloadPdf(appId: string, _filename: string) {
  const { data: app } = await api.get(`/applications/${appId}`)
  const html: string = app?.cvHtml
  if (!html) { alert('CV no disponible'); return }
  printHtmlAsPdf(html)
}

function printHtmlAsPdf(html: string) {
  const script = `<script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),400)})<\/script>`
  const enhanced = html.replace('</body>', script + '</body>').replace('</head>',
    `<style>@media screen{body::before{content:'Selecciona "Guardar como PDF" como destino y haz clic en Guardar';display:block;background:#1e40af;color:#fff;text-align:center;padding:10px 16px;font-family:sans-serif;font-size:14px;position:sticky;top:0;z-index:9999}}@media print{body::before{display:none}}</style></head>`)
  const blob = new Blob([enhanced], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

async function downloadInterviewPrepPdf(appId: string, empresa: string, rol: string) {
  const { data } = await api.get(`/applications/${appId}/interview-prep/pdf`, { responseType: 'blob' })
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = `Prep-Entrevista-${empresa.replace(/[^a-zA-Z0-9]+/g, '_')}-${rol.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
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
      elements.push(React.createElement(Tag, { key: `h-${index}`, className: 'text-white font-semibold mt-4 mb-2' }, content))
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
    elements.push(<p key={`p-${index}`} className="text-gray-300 leading-7">{trimmed}</p>)
  })

  flushList()
  return elements
}

// ── Estado badge ─────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado]
  if (!cfg) return <span className="text-xs text-gray-500 px-2 py-0.5 rounded-full bg-gray-800">{estado}</span>
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

// ── Modal Nueva Postulación ───────────────────────────────────────────────────

function NuevaPostulacionModal({ onClose, onCreated, offerWithoutLink }: { onClose: () => void; onCreated: () => void; offerWithoutLink: boolean }) {
  const [form, setForm] = useState({ empresa: '', rol: '', url: '', jd: '' })
  const [llmProvider] = useState<LlmProvider>(() => loadLlmProvider())
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('')
  const [error, setError] = useState('')

  const steps = [
    '📄 Leyendo tu CV y perfil...',
    '🤖 Generando CV personalizado con IA...',
    '🖨️ Convirtiendo a PDF...',
    '💾 Guardando postulación...',
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
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al crear postulación')
    } finally {
      setLoading(false)
      setStep('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <Plus size={18} className="text-blue-400" /> {offerWithoutLink ? 'Oferta sin link' : 'Nueva Postulación'}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {offerWithoutLink
                ? 'Pega la descripción de la oferta recibida. La IA usará el contenido para generar el CV, preparar entrevista y guardar la postulación.'
                : 'Puedes pegar el link de la oferta o dejarlo vacío si solo tienes la descripción del cargo.'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Empresa *</label>
              <input
                value={form.empresa}
                onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))}
                placeholder="Ej: Falabella, Bci, Cornershop..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Cargo *</label>
              <input
                value={form.rol}
                onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
                placeholder="Ej: Data Analyst, Frontend Developer..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">URL de la oferta (opcional)</label>
            <input
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              placeholder="https://getOnBoard.com/jobs/..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
            <p className="text-gray-500 text-xs mt-1">
              {offerWithoutLink
                ? 'Este modo está pensado para ofertas sin link. Deja esto vacío y pega la descripción completa del cargo.'
                : 'Si no tienes URL, deja esto vacío y pega la descripción completa del puesto en el campo de abajo.'}
            </p>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Descripción de la oferta / tareas del puesto * <span className="text-gray-600">({form.jd.length} chars — mín 100)</span>
            </label>
            <textarea
              value={form.jd}
              onChange={e => setForm(f => ({ ...f, jd: e.target.value }))}
              placeholder="Pega aquí la descripción completa de lo que te ofrecieron: responsabilidades, objetivos, tareas, resultados esperados, herramientas, etc."
              rows={10}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-y font-mono"
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
                  <p className="text-xs text-blue-500 mt-0.5">La IA está armando tu CV personalizado — esto tarda ~30 segundos</p>
                </div>
              </div>
              <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-600 to-violet-600 rounded-full animate-pulse w-3/4" />
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-800 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !form.empresa.trim() || !form.rol.trim() || form.jd.trim().length < 100}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {loading ? 'Generando CV...' : 'Generar CV y Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Panel CV Preview ──────────────────────────────────────────────────────────

function CvPreviewPanel({ app: initialApp, onClose, onRegenerated }: {
  app: Application
  onClose: () => void
  onRegenerated?: (updatedApp: Application) => void
}) {
  const [app, setApp] = useState(initialApp)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [regenError, setRegenError] = useState('')
  const [llmProvider] = useState<LlmProvider>(() => loadLlmProvider())

  const copyHtml = () => {
    if (app.cvHtml) {
      navigator.clipboard.writeText(app.cvHtml)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const regenerate = async () => {
    setRegenerating(true)
    setRegenError('')
    try {
      const userApiKey = getKeyForProvider(llmProvider)
      await api.post(`/applications/${app.id}/regenerate-cv`, {
        llmProvider,
        ...(userApiKey ? { userApiKey } : {}),
      })
      const { data: full } = await api.get<Application>(`/applications/${app.id}`)
      setApp(full)
      onRegenerated?.(full)
    } catch (err: unknown) {
      setRegenError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al regenerar')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
          <div>
            <h3 className="text-white font-bold flex items-center gap-2">
              <FileText size={16} className="text-blue-400" />
              CV — {app.rol} en {app.empresa}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Generado con IA y personalizado para esta oferta</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium"
              title="Genera una nueva versión del CV con IA"
            >
              {regenerating ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
              {regenerating ? 'Regenerando...' : 'Regenerar CV'}
            </button>
            {app.id && (
              <button
                onClick={() => downloadPdf(app.id, app.cvPdfFilename ?? `cv-${app.empresa}-${app.rol}.pdf`.replace(/\s+/g, '-').toLowerCase())}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-lg text-xs font-medium"
              >
                <Download size={13} /> PDF
              </button>
            )}
            {app.cvTex && (
              <button
                onClick={() => {
                  const blob = new Blob([app.cvTex!], { type: 'text/plain' })
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(blob)
                  a.download = `cv-${app.empresa}-${app.rol}.tex`.replace(/\s+/g, '-').toLowerCase()
                  a.click()
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-700 hover:bg-violet-600 text-white rounded-lg text-xs font-medium"
                title="Descargar fuente LaTeX"
              >
                <Download size={13} /> .tex
              </button>
            )}
            <button
              onClick={copyHtml}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs"
            >
              {copied ? <CheckCircle2 size={13} className="text-green-400" /> : <Copy size={13} />}
              {copied ? 'Copiado' : 'Copiar HTML'}
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white">
              <X size={18} />
            </button>
          </div>
          {regenError && (
            <p className="text-red-400 text-xs mt-1">{regenError}</p>
          )}
        </div>
        <div className="flex-1 overflow-hidden rounded-b-2xl">
          {app.cvHtml ? (
            <iframe
              srcDoc={app.cvHtml}
              className="w-full h-full bg-white"
              title="CV Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No hay HTML disponible
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Panel Prep Entrevista ─────────────────────────────────────────────────────

function InterviewPrepPanel({ app, onClose, onGenerated }: { app: Application; onClose: () => void; onGenerated: (prep: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [prep, setPrep] = useState(app.interviewPrep || '')
  const [llmProvider] = useState<LlmProvider>(() => loadLlmProvider())

  const generate = async () => {
    setLoading(true)
    try {
      const userApiKey = getKeyForProvider(llmProvider)
      const { data } = await api.post(`/applications/${app.id}/interview-prep`, {
        llmProvider,
        ...(userApiKey ? { userApiKey } : {}),
      })
      setPrep(data.prep)
      onGenerated(data.prep)
    } catch (err: unknown) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const copyPrep = () => navigator.clipboard.writeText(prep)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
          <div>
            <h3 className="text-white font-bold flex items-center gap-2">
              <Brain size={16} className="text-violet-400" />
              Prep. Entrevista — {app.empresa}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Guía personalizada basada en tu CV y la oferta</p>
          </div>
          <div className="flex items-center gap-2">
            {prep && (
              <>
                <button
                  onClick={copyPrep}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs"
                >
                  <Copy size={13} /> Copiar
                </button>
                <button
                  onClick={() => downloadInterviewPrepPdf(app.id, app.empresa, app.rol)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-lg text-xs"
                >
                  <Download size={13} /> Descargar PDF
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!prep && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-900/30 flex items-center justify-center">
                <Brain size={28} className="text-violet-400" />
              </div>
              <div>
                <p className="text-white font-semibold">¿Listo para la entrevista?</p>
                <p className="text-gray-400 text-sm mt-1 max-w-sm">
                  La IA analizará la oferta y tu CV para generar preguntas probables, cómo responderlas y estrategias para brechas de experiencia.
                </p>
              </div>
              <button
                onClick={generate}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium"
              >
                <Brain size={16} /> Generar Guía de Entrevista
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Loader2 size={32} className="text-violet-400 animate-spin" />
              <p className="text-gray-400 text-sm">Analizando oferta y preparando tu guía...</p>
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
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
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
        ...(userApiKey ? { userApiKey } : {}),
      })
      setAnswer(data.answer)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (err as Error)?.message
        || 'Error al generar la respuesta'
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

  const EJEMPLOS = [
    '¿Por qué quieres trabajar con nosotros?',
    '¿Cuál es tu mayor fortaleza?',
    '¿Qué experiencia tienes con [tecnología de la oferta]?',
    'Cuéntanos sobre un proyecto desafiante que hayas enfrentado.',
    '¿Por qué debería contratarte para este cargo?',
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
          <div>
            <h3 className="text-white font-bold flex items-center gap-2">
              <MessageSquare size={16} className="text-green-400" />
              Responder Preguntas — {app.empresa}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">La IA responde de forma humanizada basándose en tu CV</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* Ejemplos rápidos */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Preguntas frecuentes:</p>
            <div className="flex flex-wrap gap-2">
              {EJEMPLOS.map(ej => (
                <button
                  key={ej}
                  onClick={() => setQuestion(ej)}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1.5 rounded-lg transition-colors text-left"
                >
                  {ej}
                </button>
              ))}
            </div>
          </div>

          {/* Input pregunta */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Pregunta del formulario o entrevistador:</label>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Escribe la pregunta exacta que te hacen..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 resize-none"
            />
            <button
              onClick={generate}
              disabled={!question.trim() || loading}
              className="mt-2 flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {loading ? 'Generando...' : 'Generar Respuesta'}
            </button>
          </div>

          {/* Respuesta */}
          {loading && (
            <div className="flex items-center gap-3 p-4 bg-green-900/20 border border-green-800/50 rounded-xl text-green-400 text-sm">
              <Loader2 size={16} className="animate-spin shrink-0" />
              Redactando respuesta profesional y humanizada...
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-800/50 rounded-xl text-red-400 text-sm">
              <AlertTriangle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {answer && !loading && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-green-400" /> Respuesta generada
                </p>
                <button
                  onClick={copyAnswer}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white"
                >
                  {copied ? <CheckCircle2 size={12} className="text-green-400" /> : <Copy size={12} />}
                  {copied ? 'Copiado' : 'Copiar'}
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

// ── Panel Postular (Apply Kit) ────────────────────────────────────────────────

interface ApplyKitItem { pregunta: string; respuesta: string; tip?: string }

function ApplyKitPanel({ app, onClose }: { app: Application; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [kit, setKit] = useState<ApplyKitItem[]>([])
  const [formularioDetectado, setFormularioDetectado] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [llmProvider] = useState<LlmProvider>(() => loadLlmProvider())

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
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error generando kit')
    } finally {
      setLoading(false)
    }
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
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
          <div>
            <h3 className="text-white font-bold flex items-center gap-2">
              <Rocket size={16} className="text-orange-400" />
              Kit de Postulación — {app.empresa}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Respuestas humanizadas listas para copiar al formulario</p>
          </div>
          <div className="flex items-center gap-2">
            {app.id && (
              <button
                onClick={() => downloadPdf(app.id, app.cvPdfFilename ?? `cv-${app.empresa}-${app.rol}.pdf`.replace(/\s+/g, '-').toLowerCase())}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-lg text-xs font-medium"
                title="Descarga el CV para adjuntarlo en la postulación"
              >
                <Download size={12} /> Descargar CV
              </button>
            )}
            {app.url && (
              <button
                onClick={openJob}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium"
              >
                <ExternalLink size={12} /> Abrir Oferta
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white"><X size={18} /></button>
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
                <p className="text-white font-semibold">¿Listo para postular?</p>
                <p className="text-gray-400 text-sm mt-1 max-w-sm">
                  La IA analiza el formulario de {app.empresa} y genera respuestas humanizadas para cada pregunta — listas para copiar y pegar.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-wrap justify-center">
                <button
                  onClick={generate}
                  className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium"
                >
                  <Rocket size={16} /> Generar Respuestas
                </button>
                {app.id && (
                  <button
                    onClick={() => downloadPdf(app.id, app.cvPdfFilename ?? `cv-${app.empresa}-${app.rol}.pdf`.replace(/\s+/g, '-').toLowerCase())}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-700 hover:bg-green-600 text-white rounded-xl font-medium"
                  >
                    <Download size={16} /> Descargar CV
                  </button>
                )}
                {app.url && (
                  <button
                    onClick={openJob}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-xl font-medium"
                  >
                    <ExternalLink size={16} /> Abrir Formulario
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
                <p className="text-gray-300 font-medium">Analizando oferta y preparando respuestas...</p>
                <p className="text-gray-500 text-sm mt-1">Esto tarda ~15 segundos</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-900/30 border border-red-800 rounded-xl text-red-400 text-sm">
              {error}
              <button onClick={generate} className="ml-3 underline hover:no-underline">Reintentar</button>
            </div>
          )}

          {/* Kit generado */}
          {kit.length > 0 && !loading && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400 flex items-center gap-2">
                  <span className="text-white font-medium">{kit.length}</span> respuestas generadas
                  {formularioDetectado
                    ? <span className="text-[10px] bg-green-900/40 text-green-400 border border-green-800/50 px-2 py-0.5 rounded-full">✓ Formulario detectado</span>
                    : <span className="text-[10px] bg-gray-800 text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full">Preguntas comunes del cargo</span>
                  }
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={generate}
                    className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                  >
                    <Rocket size={11} /> Regenerar
                  </button>
                  {app.url && (
                    <button
                      onClick={openJob}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium"
                    >
                      <ExternalLink size={11} /> Abrir Formulario
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {kit.map((item, idx) => (
                  <div key={idx} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm font-medium text-orange-300">{item.pregunta}</p>
                      <button
                        onClick={() => copyItem(idx, item.respuesta)}
                        className="shrink-0 flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
                      >
                        {copied === idx
                          ? <><CheckCircle2 size={12} className="text-green-400" /> Copiado</>
                          : <><Copy size={12} /> Copiar</>
                        }
                      </button>
                    </div>
                    <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{item.respuesta}</p>
                    {item.tip && (
                      <p className="mt-2 text-xs text-gray-500 italic border-t border-gray-700 pt-2">
                        💡 {item.tip}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Panel Carta de Presentación ───────────────────────────────────────────────

function CoverLetterPanel({ app, onGenerated, onClose }: { app: Application; onGenerated: (letter: string) => void; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [llmProvider] = useState<LlmProvider>(() => loadLlmProvider())

  const letter = app.coverLetter

  const copy = () => {
    if (letter) {
      navigator.clipboard.writeText(letter)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const generate = async () => {
    setGenerating(true)
    setGenError('')
    try {
      const userApiKey = getKeyForProvider(llmProvider)
      const { data } = await api.post(`/applications/${app.id}/cover-letter`, {
        llmProvider,
        ...(userApiKey ? { userApiKey } : {}),
      })
      onGenerated(data.coverLetter)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (err as Error)?.message
        || 'Error al generar la carta'
      setGenError(msg)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
          <div>
            <h3 className="text-white font-bold flex items-center gap-2">
              <Mail size={16} className="text-teal-400" />
              Carta de Presentación — {app.empresa}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Generada con IA basada en tu CV y la oferta</p>
          </div>
          <div className="flex items-center gap-2">
            {letter && (
              <button
                onClick={copy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs"
              >
                {copied ? <><CheckCircle2 size={13} className="text-green-400" /> Copiado</> : <><Copy size={13} /> Copiar</>}
              </button>
            )}
            {letter && (
              <button
                onClick={generate}
                disabled={generating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-600 text-white rounded-lg text-xs disabled:opacity-50"
              >
                {generating ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Regenerar
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {letter ? (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{letter}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 gap-4 text-center">
              <Mail size={32} className="text-gray-600" />
              <p className="text-gray-400 text-sm">Esta postulación no tiene carta de presentación aún.</p>
              <button
                onClick={generate}
                disabled={generating}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {generating ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                {generating ? 'Generando carta...' : 'Generar Carta de Presentación'}
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

// ── Application Card ──────────────────────────────────────────────────────────

function ApplicationCard({ app: appSummary }: { app: Omit<Application, 'cvHtml'> }) {
  const [fullApp, setFullApp] = useState<Application | null>(null)
  const [showCv, setShowCv] = useState(false)
  const [showPrep, setShowPrep] = useState(false)
  const [showQnA, setShowQnA] = useState(false)
  const [showApply, setShowApply] = useState(false)
  const [showCoverLetter, setShowCoverLetter] = useState(false)
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
  const openApply = async () => { await loadFullApp(); setShowApply(true) }
  const openCoverLetter = async () => { await loadFullApp(); setShowCoverLetter(true) }

  const statusMut = useMutation({
    mutationFn: (estado: string) => api.patch(`/applications/${appSummary.id}`, { estado }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['applications'] }),
  })

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors">
        {/* Header */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-white font-semibold truncate">{appSummary.empresa}</h3>
                {appSummary.url && (
                  <a href={appSummary.url} target="_blank" rel="noopener noreferrer"
                    className="text-gray-500 hover:text-blue-400">
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
              <p className="text-gray-400 text-sm">{appSummary.rol}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <EstadoBadge estado={appSummary.estado} />
                {appSummary.score != null && (
                  <span className={`flex items-center gap-1 text-xs font-medium ${
                    appSummary.score >= 3.5 ? 'text-yellow-400' :
                    appSummary.score >= 2.5 ? 'text-orange-400' : 'text-red-400'
                  }`}>
                    <Star size={11} fill="currentColor" /> {appSummary.score}
                    {appSummary.score < 3.5 && (
                      <span title="Score bajo — puede ser difícil pasar filtros. Evalúa si vale la pena el esfuerzo.">
                        <AlertTriangle size={11} className="ml-0.5" />
                      </span>
                    )}
                  </span>
                )}
                <span className="text-xs text-gray-600">{appSummary.fecha}</span>
              </div>
            </div>

            {/* Badges estado */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {appSummary.cvPdfFilename && (
                <span className="text-[10px] text-green-400 flex items-center gap-1">
                  <CheckCircle2 size={10} /> PDF listo
                </span>
              )}
              {appSummary.interviewPrep && (
                <span className="text-[10px] text-violet-400 flex items-center gap-1">
                  <Brain size={10} /> Prep lista
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
              Ver CV
            </button>
            <button
              onClick={openPrep}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-900/40 hover:bg-violet-800/60 border border-violet-800/50 text-violet-300 rounded-lg text-xs font-medium transition-colors"
            >
              <Brain size={11} />
              {appSummary.interviewPrep ? 'Ver Prep. Entrevista' : 'Preparar Entrevista'}
            </button>
            <button
              onClick={openQnA}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/40 hover:bg-green-800/60 border border-green-800/50 text-green-300 rounded-lg text-xs font-medium transition-colors"
            >
              <MessageSquare size={11} /> Responder Preguntas
            </button>
            <button
              onClick={openApply}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-900/40 hover:bg-orange-800/60 border border-orange-800/50 text-orange-300 rounded-lg text-xs font-medium transition-colors"
            >
              <Rocket size={11} /> Postular
            </button>
            <button
              onClick={openCoverLetter}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-900/40 hover:bg-teal-800/60 border border-teal-800/50 text-teal-300 rounded-lg text-xs font-medium transition-colors"
            >
              <Mail size={11} /> Carta
            </button>
            <button
              onClick={() => setExpanded(e => !e)}
              className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? 'Menos' : 'Más'}
            </button>
          </div>
        </div>

        {/* Expandible: cambiar estado + notas */}
        {expanded && (
          <div className="border-t border-gray-800 p-4 bg-gray-800/30">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-gray-500">Cambiar estado:</p>
              {APLICACION_ESTADOS.map(estado => (
                <button
                  key={estado}
                  onClick={() => statusMut.mutate(estado)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    appSummary.estado === estado
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
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
    </>
  )
}

// ── Página Principal ──────────────────────────────────────────────────────────

export default function CareersPostulaciones() {
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
          <h2 className="text-2xl font-bold text-white">Mis Postulaciones</h2>
          <p className="text-gray-400 mt-1 text-sm">
            CV personalizado por oferta · Prep. entrevista · Respuesta de preguntas
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => { setOfferWithoutLink(false); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm"
          >
            <Plus size={16} /> Nueva Postulación
          </button>
          <button
            onClick={() => { setOfferWithoutLink(true); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl font-medium text-sm border border-gray-700"
          >
            <FileText size={16} /> Oferta sin link
          </button>
        </div>
      </div>

      {/* Stats rápidas */}
      {apps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(byEstado).map(([estado, count]) => (
            <div key={estado} className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg">
              <EstadoBadge estado={estado} />
              <span className="text-gray-400 text-xs font-medium">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-gray-500">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center">
            <FileText size={28} className="text-gray-600" />
          </div>
          <div>
            <p className="text-white font-semibold">Sin postulaciones aún</p>
            <p className="text-gray-400 text-sm mt-1">
              Crea tu primera postulación — la IA arma el CV personalizado para la oferta
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium"
          >
            <Plus size={16} /> Crear Primera Postulación
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
