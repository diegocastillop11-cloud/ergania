import { api } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { loadLlmProvider } from '../../lib/llmProvider'
import { getKeyForProvider } from '../../lib/userApiKeys'
import PerfilTabs from '../../components/careers/PerfilTabs'
import {
  Radio, Play, Square, ExternalLink, CheckCircle2,
  XCircle, Zap, Globe, ChevronDown, ChevronUp,
  Loader2, TrendingUp
} from 'lucide-react'


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

interface LogEntry {
  type: 'start' | 'portal' | 'portal_done' | 'portal_error' | 'portal_warn' | 'done' | 'error'
  timestamp: string
  data: Record<string, unknown>
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
      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
    </div>
  )
}

function UbicacionBadge({ ubicacion }: { ubicacion: string }) {
  const u = ubicacion?.toLowerCase() || ''
  if (u.includes('remoto') || u.includes('remote')) return (
    <span className="text-xs bg-green-900/40 text-green-400 border border-green-800/40 px-2 py-0.5 rounded-full">Remoto</span>
  )
  if (u.includes('híbrido') || u.includes('hybrid')) return (
    <span className="text-xs bg-blue-900/40 text-blue-400 border border-blue-800/40 px-2 py-0.5 rounded-full">Híbrido</span>
  )
  if (u.includes('presencial')) return (
    <span className="text-xs bg-orange-900/40 text-orange-400 border border-orange-800/40 px-2 py-0.5 rounded-full">Presencial</span>
  )
  return <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">No especificado</span>
}

function PortalCard({ event, onEvaluar, onExternalClick }: { event: PortalEvent; onEvaluar: (url: string, titulo: string, empresa: string, razon: string) => void; onExternalClick: (url: string) => void }) {
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
      isDone  ? 'border-gray-700 bg-gray-900/50' :
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
          <p className="text-white text-sm font-medium">{event.nombre}</p>
          {isError && <p className="text-red-400 text-xs mt-0.5">{event.error}</p>}
          {isDone && (
            <p className="text-gray-400 text-xs mt-0.5">
              {event.nota
                ? <span className="text-yellow-600">{event.nota}</span>
                : <>
                    {event.encontradas} encontradas · {event.agregadas} al pipeline
                    {event.omitidas ? ` · ${event.omitidas} ya postuladas` : ''}
                  </>
              }
            </p>
          )}
          {!isError && !isDone && (
            <p className="text-blue-400 text-xs mt-0.5 animate-pulse">Analizando con IA...</p>
          )}
        </div>
        {isDone && (event.ofertas?.length || 0) > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full">
              {event.encontradas} match{(event.encontradas || 0) !== 1 ? 'es' : ''}
            </span>
            {open ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
          </div>
        )}
      </div>

      {open && isDone && sortedOffers.length > 0 && (
        <div className="border-t border-gray-800 divide-y divide-gray-800/50">
          {sortedOffers.map((oferta, i) => (
            <div key={i} className="p-4 hover:bg-gray-800/20 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white text-sm font-medium">{oferta.titulo}</p>
                    <UbicacionBadge ubicacion={oferta.ubicacion} />
                  </div>
                  {oferta.empresa && (
                    <p className="text-gray-400 text-xs mt-0.5">{oferta.empresa}</p>
                  )}
                  <p className="text-gray-500 text-xs mt-1 italic">{oferta.razon}</p>
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
                      className="p-1.5 text-gray-500 hover:text-blue-400 transition-colors"
                      title="Ver oferta"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEvaluar(oferta.url, oferta.titulo, oferta.empresa || '', oferta.razon || '')
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-xs font-medium transition-all"
                  >
                    <Zap size={12} /> Evaluar
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
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [scanning, setScanning] = useState(false)
  const [portalEvents, setPortalEvents] = useState<Record<string, PortalEvent>>({})
  const [log, setLog] = useState<LogEntry[]>([])
  const [summary, setSummary] = useState<{ total: number; encontradas: number; agregadas: number } | null>(null)
  const [searchInfo, setSearchInfo] = useState<{ queries: string[]; keywords_positivas: string[] } | null>(null)
  const [evaluatingUrl, setEvaluatingUrl] = useState<string | null>(null)
  const [evalResult, setEvalResult] = useState<{ titulo: string; score: number; recomendacion: string } | null>(null)
  const [confirmation, setConfirmation] = useState<EvaluationConfirmation | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const addLog = useCallback((type: LogEntry['type'], data: Record<string, unknown>) => {
    const entry: LogEntry = { type, timestamp: new Date().toLocaleTimeString('es-CL'), data }
    setLog(prev => [...prev, entry])
  }, [])

  const startScan = useCallback(async () => {
    if (scanning) return
    setScanning(true)
    setPortalEvents({})
    setLog([])
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
        } else if (eventType === 'start') {
          addLog('start', data)
        } else if (eventType === 'portal') {
          const pe = data as unknown as PortalEvent
          setPortalEvents(prev => ({ ...prev, [pe.nombre]: { ...pe, seenAt: Date.now() } }))
          addLog('portal', data)
        } else if (eventType === 'portal_done') {
          const pe = data as unknown as PortalEvent
          setPortalEvents(prev => ({ ...prev, [pe.nombre]: { ...prev[pe.nombre], ...pe, seenAt: prev[pe.nombre]?.seenAt || Date.now() } }))
          addLog('portal_done', data)
        } else if (eventType === 'portal_error') {
          const pe = data as unknown as PortalEvent
          setPortalEvents(prev => ({ ...prev, [pe.nombre]: { ...prev[pe.nombre], ...pe, seenAt: prev[pe.nombre]?.seenAt || Date.now() } }))
          addLog('portal_error', data)
        } else if (eventType === 'portal_warn') {
          addLog('portal_warn', data)
        } else if (eventType === 'done') {
          setSummary({
            total: data.total_portales as number,
            encontradas: data.ofertas_encontradas as number,
            agregadas: data.agregadas_pipeline as number,
          })
          addLog('done', data)
          setScanning(false)
          qc.invalidateQueries({ queryKey: ['careers-pipeline'] })
          qc.invalidateQueries({ queryKey: ['careers-stats'] })
        } else if (eventType === 'error') {
          addLog('error', data)
          setScanning(false)
        }
      } catch { /* ignore parse errors */ }
    }

    try {
      const response = await fetch(`/api/careers/scan?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        addLog('error', { error: `Error ${response.status}: ${response.statusText}` })
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
        addLog('error', { error: (err as Error).message || 'Error de conexión' })
        setScanning(false)
      }
    }
  }, [scanning, addLog, qc])

  const stopScan = useCallback(() => {
    abortRef.current?.abort()
    setScanning(false)
    addLog('error', { error: 'Escaneo detenido por el usuario' })
  }, [addLog])

  const evaluarOferta = useCallback(async (url: string, titulo: string, empresa: string, razon: string) => {
    setEvaluatingUrl(url)
    try {
      const { data } = await api.post('/evaluate', {
        url,
        empresa: empresa || undefined,
        rol: titulo || undefined,
        // Incluir razon del scanner como contexto para cuando el scraping falle (ej. LinkedIn)
        jd: razon
          ? `Oferta: "${titulo}"${empresa ? ` en ${empresa}` : ''}\nURL: ${url}\n\nContexto del análisis previo:\n${razon}`
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
    } catch { /* ignore */ }
    finally { setEvaluatingUrl(null) }
  }, [qc])

  const portalList = Object.values(portalEvents).slice().sort((a, b) => (b.seenAt || 0) - (a.seenAt || 0))
  const doneCount = portalList.filter(p => p.encontradas !== undefined || p.error).length
  const totalPortals = portalList.length

  return (
    <div className="space-y-5">
      <PerfilTabs />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Radio size={22} className={scanning ? 'text-green-400 animate-pulse' : 'text-gray-500'} />
            Escáner de Portales
          </h2>
          <p className="text-gray-400 mt-1">
            Busca trabajos automáticamente en portales chilenos y los filtra por tu perfil
          </p>
        </div>
        <div className="flex gap-2">
          {scanning ? (
            <button
              onClick={stopScan}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-800/50 rounded-lg text-sm font-medium transition-all"
            >
              <Square size={14} /> Detener
            </button>
          ) : (
            <button
              onClick={startScan}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Play size={14} /> Iniciar Escaneo
            </button>
          )}
        </div>
      </div>

      {/* Resumen de resultado */}
      {summary && (
        <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 size={20} className="text-green-400" />
            <h3 className="text-white font-semibold">Escaneo completado</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white">{summary.total}</p>
              <p className="text-xs text-gray-400">Portales escaneados</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-400">{summary.encontradas}</p>
              <p className="text-xs text-gray-400">Ofertas encontradas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">{summary.agregadas}</p>
              <p className="text-xs text-gray-400">Agregadas al pipeline</p>
            </div>
          </div>
          {summary.agregadas > 0 && (
            <p className="text-center text-sm text-gray-400 mt-3">
              Ve a <strong className="text-white">Evaluar Oferta</strong> para analizar las ofertas encontradas con IA
            </p>
          )}
        </div>
      )}

      {/* Resultado de evaluación rápida */}
      {evalResult && (
        <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 flex items-center gap-4">
          <Zap size={18} className="text-blue-400 shrink-0" />
          <div className="flex-1">
            <p className="text-white text-sm font-medium">{evalResult.titulo}</p>
            <p className="text-gray-400 text-xs">
              Score: <strong className="text-white">{evalResult.score}/5</strong> · {evalResult.recomendacion}
            </p>
          </div>
        </div>
      )}

      {confirmation && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4 py-8">
          <div className="max-w-md w-full bg-gray-950 border border-blue-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-blue-900/20 p-3 text-blue-300">
                <Zap size={24} />
              </div>
              <div className="flex-1">
                <p className="text-white text-lg font-semibold">Evaluación completada</p>
                <p className="text-gray-400 text-sm mt-1">{confirmation.titulo}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4">
                <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">Score</p>
                <p className="text-3xl font-bold text-white mt-1">{confirmation.score}/5</p>
              </div>
              <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4">
                <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">Recomendación</p>
                <p className="text-white mt-1 font-semibold">{confirmation.recomendacion}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={() => {
                  setConfirmation(null)
                  navigate('/tracker')
                }}
                className="w-full sm:w-auto px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Ir al tracker
              </button>
              <button
                onClick={() => setConfirmation(null)}
                className="w-full sm:w-auto px-4 py-3 border border-gray-700 text-gray-300 hover:text-white rounded-xl text-sm transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parámetros de búsqueda activos */}
      {searchInfo && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Buscando con estos parámetros</p>
          <div>
            <p className="text-xs text-gray-400 mb-1.5">Consultas ({searchInfo.queries.length}):</p>
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
              <p className="text-xs text-gray-400 mb-1.5">Keywords de filtro:</p>
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
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Escaneando portales...
            </span>
            <span className="text-sm text-gray-400">{doneCount}/{totalPortals}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
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
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Globe size={16} className="text-blue-400" />
            Portales ({portalList.length})
          </h3>
          {portalList.map(event => (
            <PortalCard
              key={event.nombre}
              event={event}
              onEvaluar={(url, titulo, empresa, razon) => evaluarOferta(url, titulo, empresa, razon)}
              onExternalClick={incrementOfferClick}
            />
          ))}
        </div>
      )}

      {/* Log en tiempo real */}
      {log.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <h3 className="text-white text-sm font-semibold flex items-center gap-2">
              <TrendingUp size={14} className="text-gray-400" />
              Log en tiempo real
            </h3>
            <span className="text-xs text-gray-500">{log.length} eventos</span>
          </div>
          <div className="p-3 max-h-48 overflow-y-auto space-y-1 font-mono">
            {log.map((entry, i) => {
              const colors: Record<LogEntry['type'], string> = {
                start: 'text-blue-400',
                portal: 'text-gray-400',
                portal_done: 'text-green-400',
                portal_error: 'text-red-400',
                portal_warn: 'text-amber-400',
                done: 'text-green-300',
                error: 'text-red-300',
              }
              const icons: Record<LogEntry['type'], string> = {
                start: '▶',
                portal: '◌',
                portal_done: '✓',
                portal_error: '✗',
                portal_warn: '⚠',
                done: '★',
                error: '!',
              }
              return (
                <div key={i} className={`text-xs flex gap-2 ${colors[entry.type]}`}>
                  <span className="shrink-0 text-gray-600">{entry.timestamp}</span>
                  <span className="shrink-0">{icons[entry.type]}</span>
                  <span>
                    {entry.type === 'portal' && `Escaneando: ${entry.data.nombre}`}
                    {entry.type === 'portal_done' && (entry.data.nota
                      ? `${entry.data.nombre}: ${entry.data.nota}`
                      : `${entry.data.nombre}: ${entry.data.encontradas} encontradas, ${entry.data.agregadas} al pipeline${entry.data.omitidas ? `, ${entry.data.omitidas} omitidas (ya postuladas)` : ''}`
                    )}
                    {entry.type === 'portal_error' && `${entry.data.nombre}: ${entry.data.error}`}
                    {entry.type === 'portal_warn' && `⚠ ${entry.data.nombre}: ${entry.data.nota}`}
                    {entry.type === 'start' && `Iniciando escaneo de ${entry.data.total} portales...`}
                    {entry.type === 'done' && `Completado — ${entry.data.agregadas_pipeline} ofertas relevantes agregadas`}
                    {entry.type === 'error' && String(entry.data.error || 'Error desconocido')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {!scanning && portalList.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto">
            <Radio size={32} className="text-gray-600" />
          </div>
          <div>
            <h3 className="text-white font-semibold mb-1">Escáner listo</h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              Busca en portales chilenos usando tus cargos y keywords. Para mejores resultados configura primero tus cargos objetivo.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-md mx-auto text-xs">
            <div className="bg-gray-800 rounded-lg p-2.5 text-left">
              <p className="text-green-400 font-medium">✓ GetOnBoard</p>
              <p className="text-gray-500 mt-0.5">API pública · resultados reales</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-2.5 text-left">
              <p className="text-green-400 font-medium">✓ Indeed Chile</p>
              <p className="text-gray-500 mt-0.5">RSS feed · actualizaciones diarias</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-2.5 text-left">
              <p className="text-blue-400 font-medium">◌ Otros portales</p>
              <p className="text-gray-500 mt-0.5">Búsqueda + extracción IA</p>
            </div>
          </div>
          <p className="text-xs text-gray-600">
            ¿0 resultados? Ve a{' '}
            <strong className="text-gray-400">Mi Búsqueda</strong>{' '}
            y configura tus cargos objetivo y keywords primero.
          </p>
        </div>
      )}

      {/* Loading overlay para evaluación */}
      {evaluatingUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 flex items-center gap-4 max-w-sm mx-4">
            <Loader2 size={24} className="animate-spin text-blue-400 shrink-0" />
            <div>
              <p className="text-white font-medium">Evaluando oferta con IA...</p>
              <p className="text-gray-400 text-sm mt-0.5">Analizando bloques A-G completos</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
