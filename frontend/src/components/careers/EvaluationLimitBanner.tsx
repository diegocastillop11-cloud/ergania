import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, XCircle } from 'lucide-react'
import { api } from '../../lib/api'

interface EvalLimitStatus {
  applies: boolean
  dailyLimit: number
  dailyUsed: number
  totalLimit: number
  totalUsed: number
  dailyBlocked: boolean
  totalBlocked: boolean
  resetsAt: string
}

// Cuenta regresiva hasta el reset diario (medianoche UTC, mismo corte que usa
// el backend para agrupar "fecha" en tracker_entries).
function useResetCountdown(resetsAt?: string): string {
  const [label, setLabel] = useState('')
  useEffect(() => {
    if (!resetsAt) return
    const tick = () => {
      const diffMs = new Date(resetsAt).getTime() - Date.now()
      if (diffMs <= 0) { setLabel('unos minutos'); return }
      const h = Math.floor(diffMs / 3_600_000)
      const m = Math.floor((diffMs % 3_600_000) / 60_000)
      setLabel(h > 0 ? `${h}h ${m}m` : `${m}m`)
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [resetsAt])
  return label
}

export default function EvaluationLimitBanner() {
  const { data } = useQuery<EvalLimitStatus>({
    queryKey: ['careers-eval-limit'],
    queryFn: async () => (await api.get('/evaluation-limit')).data,
    refetchInterval: 60_000,
  })
  const countdown = useResetCountdown(data?.dailyBlocked ? data.resetsAt : undefined)

  if (!data?.applies) return null

  if (data.totalBlocked) {
    return (
      <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 flex items-center gap-3">
        <XCircle size={18} className="text-red-400 shrink-0" />
        <p className="text-red-400 text-sm">
          Alcanzaste el límite de evaluaciones de tu prueba gratuita ({data.totalUsed}/{data.totalLimit}).
        </p>
      </div>
    )
  }

  if (data.dailyBlocked) {
    return (
      <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 flex items-center gap-3">
        <XCircle size={18} className="text-red-400 shrink-0" />
        <p className="text-red-400 text-sm">
          Límite de evaluaciones diarias excedido, intenta en 24hrs
          {countdown && <span className="text-red-300/80"> — vuelve a intentar en {countdown}</span>}
        </p>
      </div>
    )
  }

  if (data.dailyUsed === data.dailyLimit - 1) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl px-4 py-3 flex items-center gap-3">
        <AlertTriangle size={18} className="text-yellow-400 shrink-0" />
        <p className="text-yellow-400 text-sm">
          Acercándose al límite de evaluaciones diarias, intenta mañana nuevamente ({data.dailyUsed}/{data.dailyLimit} hoy)
        </p>
      </div>
    )
  }

  return (
    <p className="text-[var(--text-tertiary)] text-xs">
      Evaluaciones hoy: {data.dailyUsed}/{data.dailyLimit}
    </p>
  )
}
