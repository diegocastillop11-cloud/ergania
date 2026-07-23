import { api } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { loadLlmProvider } from '../../lib/llmProvider'
import { getKeyForProvider } from '../../lib/userApiKeys'
import PerfilTabs from '../../components/careers/PerfilTabs'
import {
  Radio, Play, Square, ExternalLink, CheckCircle2,
  XCircle, Zap, Globe, ChevronDown, ChevronUp,
  Loader2
} from 'lucide-react'
import { useTranslation } from '../../lib/i18n/LanguageContext'


// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Oferta {
  titulo: string
  empresa: string
  url: string
  ubicacion: string
  match_score: number
  razon: string
}

interface PortalEvent {
  nombre: string
  url?: string
  estado?: string
  encontradas?: number
  agregadas?: number
  omitidas?: number
  ofertas?: Oferta[]
  error?: string
  nota?: string   // ej: "Portal SPA — requiere navegador"
  seenAt?: number
}

interface OfferClickData {
  clicks: number
  lastClicked: number
}

interface EvaluationConfirmation {
  titulo: string
  score: number
  recomendacion: string
  url: string
}

function getOfferClickData(url: string): OfferClickData {
  try {
    const raw = window.localStorage.getItem('offerClickData')
    const parsed = raw ? JSON.parse(raw) as Record<string, OfferClickData> : {}
    return parsed[url] || { clicks: 0, lastClicked: 0 }
  } catch {
    return { clicks: 0, lastClicked: 0 }
  }
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

function MatchBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-orange-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[var(--text-tertiary)] w-8 text-right">{pct}%</span>
    </div>
  )
}

function UbicacionBadge({ ubicacion }: { ubicacion: string }) {
  const { t } = useTranslation()
  const u = ubicacion?.toLowerCase() || ''
  if (u.includes('remoto') || u.includes('remote')) return (
    <span className="text-xs bg-green-900/40 text-green-400 border border-green-800/40 px-2 py-0.5 rounded-full">{t('careersScanner.ubicacion.remote')}</span>
  )
  if (u.includes('híbrido') || u.includes('hybrid')) return (
    <span className="text-xs bg-blue-900/40 text-blue-400 border border-blue-800/40 px-2 py-0.5 rounded-full">{t('careersScanner.ubicacion.hybrid')}</span>
  )
  if (u.includes('presencial')) return (
    <span className="text-xs bg-orange-900/40 text-orange-400 border border-orange-800/40 px-2 py-0.5 rounded-full">{t('careersScanner.ubicacion.onsite')}</span>
  )
  return <span className="text-xs bg-[var(--bg-surface-alt)] text-[var(--text-muted)] px-2 py-0.5 rounded-full">{t('careersScanner.ubicacion.unspecified')}</span>
}

function PortalCard({ event, onEvaluar, onExternalClick }: { event: PortalEvent; onEvaluar: (url: string, titulo: string, empresa: string, razon: string, ubicacion: string) => void; onExternalClick: (url: string) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)
  const isError = !!event.error
  const isDone = event.encontradas !== undefined

  const sortedOffers = (event.ofertas ?? []).slice().sort((a, b) => {
    const aClicks = getOfferClickData(a.url).clicks
    const bClicks = getOfferClickData(b.url).clicks
    if (aClicks !== bClicks) return aClicks - bClicks
    const aLast = getOfferClickData(a.url).lastClicked
    const bLast = getOfferClickData(b.url).lastClicked
    if (aLast !== bLast) return bLast - aLast
    return 0
  })

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      isError ? 'border-red-900/50 bg-red-950/20' :
      isDone  ? 'border-[var(--border-alt)] bg-gray-900/50' :
                'border-blue-900/50 bg-blue-950/10'
    }`}>
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-800/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="shrink-0">
          {isError ? (
            <XCircle size={18} className="text-red-400" />
          ) : isDone ? (
            <CheckCircle2 size={18} className="text-green-400" />
          ) : (
            <Loader2 size={18} className="text-blue-400 animate-spin" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[var(--text-primary)] text-sm font-medium">{event.nombre}</p>
          {isError && <p className="text-red-400 text-xs mt-0.5">{event.error}</p>}
          {isDone && (
            <p className="text-[var(--text-tertiary)] text-xs mt-0.5">
              {event.nota
                ? <span className="text-yellow-600">{event.nota}</span>
                : (event.encontradas ?? 0) === 0
                ? <span className="text-amber-500">
                    {t('careersScanner.noOffersFound')}
                    {event.url && (
                      <>
                        {' '}
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-blue-400 hover:underline"
                        >
                          {t('careersScanner.searchManuallyLink')}
                        </a>
                      </>
                    )}
                  </span>
                : <>
                    {t('careersScanner.matchesFound', { count: event.encontradas ?? 0, added: event.agregadas ?? 0 })}
                    {event.omitidas ? t('careersScanner.alreadyAppliedSuffix', { count: event.omitidas }) : ''}
                  </>
              }
            </p>
          )}
          {!isError && !isDone && (
            <p className="text-blue-400 text-xs mt-0.5 animate-pulse">{t('careersScanner.analyzingWithAi')}</p>
          )}
        </div>
        {isDone && (event.ofertas?.length || 0) > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full">
              {event.encontradas} {t('careersScanner.matchLabel', { plural: (event.encontradas || 0) !== 1 ? 'es' : '' })}
            </span>
            {open ? <ChevronUp size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
          </div>
        )}
      </div>

      {open && isDone && sortedOffers.length > 0 && (
        <div className="border-t border-[var(--border-default)] divide-y divide-gray-800/50">
          {sortedOffers.map((oferta, i) => (
            <div key={i} className="p-4 hover:bg-gray-800/20 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[var(--text-primary)] text-sm font-medium">{oferta.titulo}</p>
                    <UbicacionBadge ubicacion={oferta.ubicacion} />
                  </div>
                  {oferta.empresa && (
                    <p className="text-[var(--text-tertiary)] text-xs mt-0.5">{oferta.empresa}</p>
                  )}
                  <p className="text-[var(--text-muted)] text-xs mt-1 italic">{oferta.razon}</p>
                  <div className="mt-2 max-w-[200px]">
                    <MatchBar score={oferta.match_score} />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {oferta.url.startsWith('http') && (
                    <a
                      href={oferta.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.stopPropagation()
                        onExternalClick(oferta.url)
                      }}
                      className="p-1.5 text-[var(--text-muted)] hover:text-blue-400 transition-colors"
                      title={t('careersScanner.viewOfferTitle')}
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEvaluar(oferta.url, oferta.titulo, oferta.empresa || '', oferta.razon || '', oferta.ubicacion || '')
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-[var(--text-primary)] rounded-lg text-xs font-medium transition-all"
                  >
                    <Zap size={12} /> {t('careersScanner.evaluate')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CareersScanner() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [scanning, setScanning] = useState(false)
  const [portalEvents, setPortalEvents] = useState<Record<string, PortalEvent>>({})
  const [regionFilter, setRegionFilter] = useState<'todos' | 'chile' | 'remoto'>('todos')
  const [scanError, setScanError] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ total: number; encontradas: number; agregadas: number } | null>(null)
  const [searchInfo, setSearchInfo] = useState<{ queries: string[]; keywords_positivas: string[] } | null>(null)
  const [evaluatingUrl, setEvaluatingUrl] = useState<string | null>(null)
  const [evalResult, setEvalResult] = useState<{ titulo: string; score: number; recomendacion: string } | null>(null)
  const [evalError, setEvalError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<EvaluationConfirmation | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const startScan = useCallback(async () => {
    if (scanning) return
    setScanning(true)
    setPortalEvents({})
    setScanError(null)
    setSummary(null)
    setSearchInfo(null)
    setEvalResult(null)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const provider = loadLlmProvider()
    const userApiKey = getKeyForProvider(provider)
    const params = new URLSearchParams()
    params.set('llmProvider', provider)
    if (userApiKey) params.set('userApiKey', userApiKey)

    const controller = new AbortController()
    abortRef.current = controller

    const handleEvent = (eventType: string, rawData: string) => {
      try {
        const data = JSON.parse(rawData) as Record<string, unknown>
        if (eventType === 'search_info') {
          setSearchInfo(data as { queries: string[]; keywords_positivas: string[] })
        } else if (eventType === 'portal') {
          const pe = data as unknown as PortalEvent
          setPortalEvents(prev => ({ ...prev, [pe.nombre]: { ...pe, seenAt: Date.now() } }))
        } else if (eventType === 'portal_done' || eventType === 'portal_error' || eventType === 'portal_warn') {
          const pe = data as unknown as PortalEvent
          setPortalEvents(prev => ({ ...prev, [pe.nombre]: { ...prev[pe.nombre], ...pe, seenAt: prev[pe.nombre]?.seenAt || Date.now() } }))
        } else if (eventType === 'done') {
          setSummary({
            total: data.total_portales as number,
            encontradas: data.ofertas_encontradas as number,
            agregadas: data.agregadas_pipeline as number,
          })
          setScanning(false)
          qc.invalidateQueries({ queryKey: ['careers-pipeline'] })
          qc.invalidateQueries({ queryKey: ['careers-stats'] })
        } else if (eventType === 'error') {
          setScanError(String(data.error || t('careersScanner.log.genericError')))
          setScanning(false)
        }
      } catch { /* ignore parse errors */ }
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/careers/scan?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        setScanError(`Error ${response.status}: ${response.statusText}`)
        setScanning(false)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })

        let idx
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const block = buf.slice(0, idx)
          buf = buf.slice(idx + 2)

          let eventType = 'message'
          let dataLine = ''
          for (const line of block.split('\n')) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim()
            else if (line.startsWith('data: ')) dataLine = line.slice(6)
          }
          if (dataLine) handleEvent(eventType, dataLine)
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setScanError((err as Error).message || t('careersScanner.log.connectionError'))
        setScanning(false)
      }
    }
  }, [scanning, qc, t])

  const stopScan = useCallback(() => {
    abortRef.current?.abort()
    setScanning(false)
    // Los portales que quedaron a mitad de camino (sin portal_done/portal_error todavía)
    // nunca van a recibir ese evento — el servidor deja de mandar datos apenas detecta
    // que el cliente se desconectó. Sin esto, la tarjeta se quedaba pulsando "Analizando
    // con IA..." para siempre, dando la sensación de que "Detener" no hizo nada.
    setPortalEvents(prev => {
      const next: Record<string, PortalEvent> = {}
      for (const [nombre, event] of Object.entries(prev)) {
        next[nombre] = event.encontradas !== undefined || event.error
          ? event
          : { ...event, encontradas: 0, agregadas: 0, ofertas: [], nota: t('careersScanner.stoppedNote') }
      }
      return next
    })
  }, [t])

  // Permite que el botón "Escanear Ofertas" del Dashboard (/scanner?autostart=1)
  // llegue directo a este módulo y arranque el escaneo sin que el usuario tenga
  // que encontrar y apretar el botón "Iniciar Escaneo" de nuevo.
  useEffect(() => {
    if (searchParams.get('autostart') !== '1') return
    setSearchParams(prev => { prev.delete('autostart'); return prev }, { replace: true })
    startScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const evaluarOferta = useCallback(async (url: string, titulo: string, empresa: string, razon: string, ubicacion: string) => {
    setEvaluatingUrl(url)
    setEvalError(null)
    try {
      const { data } = await api.post('/evaluate', {
        url,
        empresa: empresa || undefined,
        rol: titulo || undefined,
        // Incluir razon + ubicación del scanner como contexto para cuando el scraping
        // falle (ej. LinkedIn) y para que la IA detecte el país real de la oferta.
        jd: (razon || ubicacion)
          ? `Oferta: "${titulo}"${empresa ? ` en ${empresa}` : ''}\nURL: ${url}\nUbicación detectada por el scanner: ${ubicacion || 'no especificada'}\n\nContexto del análisis previo:\n${razon || ''}`
          : undefined,
      })
      const result = {
        titulo: data.meta?.rol || titulo,
        score: data.meta?.score || 0,
        recomendacion: data.meta?.recomendacion || '—',
      }
      setEvalResult(result)
      setConfirmation({ ...result, url })
      qc.invalidateQueries({ queryKey: ['careers-tracker'] })
      qc.invalidateQueries({ queryKey: ['careers-stats'] })
      qc.invalidateQueries({ queryKey: ['careers-eval-limit'] })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: unknown } } }
      const rawErr = e?.response?.data?.error
      setEvalError(typeof rawErr === 'string' && rawErr ? rawErr : t('careersPipeline.genericError'))
      qc.invalidateQueries({ queryKey: ['careers-eval-limit'] })
    }
    finally { setEvaluatingUrl(null) }
  }, [qc, t])

  const portalList = Object.values(portalEvents).slice().sort((a, b) => (b.seenAt || 0) - (a.seenAt || 0))
  const doneCount = portalList.filter(p => p.encontradas !== undefined || p.error).length
  const totalPortals = portalList.length

  // Filtro de región sobre los resultados ya encontrados (no re-escanea).
  // "Resto del mundo" no existe todavía como scraping real — todos los portales
  // hoy son de Chile — así que el filtro por ahora separa Chile vs Remoto.
  const filteredPortalList = regionFilter === 'todos'
    ? portalList
    : portalList.map(event => {
        if (!event.ofertas) return event
        const ofertas = event.ofertas.filter(o => {
          const u = (o.ubicacion || '').toLowerCase()
          const esRemoto = u.includes('remoto') || u.includes('remote')
          return regionFilter === 'remoto' ? esRemoto : !esRemoto
        })
        return { ...event, ofertas, encontradas: ofertas.length }
      })

  return (
    <div className="space-y-5">
      <PerfilTabs />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Radio size={22} className={scanning ? 'text-green-400 animate-pulse' : 'text-[var(--text-muted)]'} />
            {t('careersScanner.title')}
          </h2>
          <p className="text-[var(--text-tertiary)] mt-1">
            {t('careersScanner.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          {scanning ? (
            <button
              onClick={stopScan}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-[var(--text-primary)] border border-red-800/50 rounded-lg text-sm font-medium transition-all"
            >
              <Square size={14} /> {t('careersScanner.stop')}
            </button>
          ) : (
            <button
              onClick={startScan}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors"
            >
              <Play size={14} /> {t('careersScanner.start')}
            </button>
          )}
        </div>
      </div>

      {/* Resumen de resultado */}
      {scanError && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-4 text-red-300 text-sm">
          {scanError}
        </div>
      )}

      {summary && (
        <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 size={20} className="text-green-400" />
            <h3 className="text-[var(--text-primary)] font-semibold">{t('careersScanner.summary.completed')}</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{summary.total}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{t('careersScanner.summary.portalsScanned')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-400">{summary.encontradas}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{t('careersScanner.summary.offersFound')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">{summary.agregadas}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{t('careersScanner.summary.addedToPipeline')}</p>
            </div>
          </div>
          {summary.agregadas > 0 && (
            <p className="text-center text-sm text-[var(--text-tertiary)] mt-3">
              {t('careersScanner.summary.goEvaluateNote1')} <strong className="text-[var(--text-primary)]">{t('careersScanner.summary.goEvaluateNoteLink')}</strong> {t('careersScanner.summary.goEvaluateNote2')}
            </p>
          )}
        </div>
      )}

      {/* Error de evaluación rápida (ej. límite diario de evaluaciones en trial) */}
      {evalError && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-4">
          <p className="text-red-400 text-sm">{evalError}</p>
        </div>
      )}

      {/* Resultado de evaluación rápida */}
      {evalResult && (
        <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 flex items-center gap-4">
          <Zap size={18} className="text-blue-400 shrink-0" />
          <div className="flex-1">
            <p className="text-[var(--text-primary)] text-sm font-medium">{evalResult.titulo}</p>
            <p className="text-[var(--text-tertiary)] text-xs">
              {t('careersScanner.scoreLabel')} <strong className="text-[var(--text-primary)]">{evalResult.score}/5</strong> · {evalResult.recomendacion}
            </p>
          </div>
        </div>
      )}

      {confirmation && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4 py-8">
          <div className="max-w-md w-full bg-[var(--bg-app)] border border-blue-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-blue-900/20 p-3 text-blue-300">
                <Zap size={24} />
              </div>
              <div className="flex-1">
                <p className="text-[var(--text-primary)] text-lg font-semibold">{t('careersScanner.confirmationModal.title')}</p>
                <p className="text-[var(--text-tertiary)] text-sm mt-1">{confirmation.titulo}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] p-4">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-[0.2em]">{t('careersScanner.confirmationModal.score')}</p>
                <p className="text-3xl font-bold text-[var(--text-primary)] mt-1">{confirmation.score}/5</p>
              </div>
              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] p-4">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-[0.2em]">{t('careersScanner.confirmationModal.recommendation')}</p>
                <p className="text-[var(--text-primary)] mt-1 font-semibold">{confirmation.recomendacion}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={() => {
                  setConfirmation(null)
                  navigate('/tracker')
                }}
                className="w-full sm:w-auto px-4 py-3 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] rounded-xl text-sm font-semibold transition-colors"
              >
                {t('careersScanner.confirmationModal.goToTracker')}
              </button>
              <button
                onClick={() => setConfirmation(null)}
                className="w-full sm:w-auto px-4 py-3 border border-[var(--border-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl text-sm transition-colors"
              >
                {t('careersScanner.confirmationModal.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parámetros de búsqueda activos */}
      {searchInfo && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4 space-y-2">
          <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">{t('careersScanner.searchInfo.title')}</p>
          <div>
            <p className="text-xs text-[var(--text-tertiary)] mb-1.5">{t('careersScanner.searchInfo.queriesLabel', { count: searchInfo.queries.length })}</p>
            <div className="flex flex-wrap gap-1.5">
              {searchInfo.queries.map(q => (
                <span key={q} className="text-xs bg-blue-900/40 text-blue-300 border border-blue-800/50 px-2.5 py-1 rounded-lg font-medium">
                  "{q}"
                </span>
              ))}
            </div>
          </div>
          {searchInfo.keywords_positivas.length > 0 && (
            <div>
              <p className="text-xs text-[var(--text-tertiary)] mb-1.5">{t('careersScanner.searchInfo.keywordsLabel')}</p>
              <div className="flex flex-wrap gap-1.5">
                {searchInfo.keywords_positivas.map(k => (
                  <span key={k} className="text-xs bg-green-900/30 text-green-400 border border-green-800/40 px-2 py-0.5 rounded-full">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress bar durante escaneo */}
      {scanning && totalPortals > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--text-tertiary)] flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              {t('careersScanner.scanningPortals')}
            </span>
            <span className="text-sm text-[var(--text-tertiary)]">{doneCount}/{totalPortals}</span>
          </div>
          <div className="w-full bg-[var(--bg-surface-alt)] rounded-full h-2">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-green-500 transition-all duration-500"
              style={{ width: `${totalPortals > 0 ? (doneCount / totalPortals) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Feed de portales en tiempo real */}
      {portalList.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-[var(--text-primary)] font-semibold flex items-center gap-2">
              <Globe size={16} className="text-blue-400" />
              {t('careersScanner.portalsHeader', { count: portalList.length })}
            </h3>
            <div className="flex rounded-lg overflow-hidden border border-[var(--border-alt)] text-xs">
              {([
                { id: 'todos', label: t('careersScanner.regions.all') },
                { id: 'chile', label: t('careersScanner.regions.chile') },
                { id: 'remoto', label: t('careersScanner.regions.remote') },
              ] as const).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setRegionFilter(opt.id)}
                  className={`px-3 py-1.5 ${regionFilter === opt.id ? 'bg-blue-700 text-[var(--text-primary)]' : 'bg-[var(--bg-surface-alt)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {filteredPortalList.map(event => (
            <PortalCard
              key={event.nombre}
              event={event}
              onEvaluar={(url, titulo, empresa, razon, ubicacion) => evaluarOferta(url, titulo, empresa, razon, ubicacion)}
              onExternalClick={incrementOfferClick}
            />
          ))}
        </div>
      )}

      {/* Estado vacío */}
      {!scanning && portalList.length === 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-10 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-surface-alt)] flex items-center justify-center mx-auto">
            <Radio size={32} className="text-[var(--text-faint)]" />
          </div>
          <div>
            <h3 className="text-[var(--text-primary)] font-semibold mb-1">{t('careersScanner.emptyState.title')}</h3>
            <p className="text-[var(--text-tertiary)] text-sm max-w-md mx-auto">
              {t('careersScanner.emptyState.desc')}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-md mx-auto text-xs">
            <div className="bg-[var(--bg-surface-alt)] rounded-lg p-2.5 text-left">
              <p className="text-green-400 font-medium">✓ GetOnBoard</p>
              <p className="text-[var(--text-muted)] mt-0.5">{t('careersScanner.emptyState.getOnBoardDesc')}</p>
            </div>
            <div className="bg-[var(--bg-surface-alt)] rounded-lg p-2.5 text-left">
              <p className="text-green-400 font-medium">✓ Indeed Chile</p>
              <p className="text-[var(--text-muted)] mt-0.5">{t('careersScanner.emptyState.indeedDesc')}</p>
            </div>
            <div className="bg-[var(--bg-surface-alt)] rounded-lg p-2.5 text-left">
              <p className="text-blue-400 font-medium">◌ {t('careersScanner.emptyState.othersLabel')}</p>
              <p className="text-[var(--text-muted)] mt-0.5">{t('careersScanner.emptyState.othersDesc')}</p>
            </div>
          </div>
          <p className="text-xs text-[var(--text-faint)]">
            {t('careersScanner.emptyState.zeroResultsNote1')}{' '}
            <strong className="text-[var(--text-tertiary)]">{t('careersScanner.emptyState.zeroResultsNoteLink')}</strong>{' '}
            {t('careersScanner.emptyState.zeroResultsNote2')}
          </p>
        </div>
      )}

      {/* Loading overlay para evaluación */}
      {evaluatingUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-alt)] rounded-xl p-6 flex items-center gap-4 max-w-sm mx-4">
            <Loader2 size={24} className="animate-spin text-blue-400 shrink-0" />
            <div>
              <p className="text-[var(--text-primary)] font-medium">{t('careersScanner.evaluatingOverlay.title')}</p>
              <p className="text-[var(--text-tertiary)] text-sm mt-0.5">{t('careersScanner.evaluatingOverlay.subtitle')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
