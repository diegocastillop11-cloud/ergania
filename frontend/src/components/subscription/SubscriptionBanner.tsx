import { Crown, AlertTriangle, X, Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { SubscriptionState } from '../../hooks/useSubscription'

interface Props {
  sub: SubscriptionState
}

export default function SubscriptionBanner({ sub }: Props) {
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (sub.loading || sub.isActive && dismissed) return null

  const handleSubscribe = async () => {
    setLoadingCheckout(true)
    try {
      await sub.openCheckout()
    } catch {
      setLoadingCheckout(false)
    }
  }

  // Trial activo: banner informativo, descartable
  if (sub.status === 'trial') {
    return (
      <div className="flex items-center gap-3 bg-blue-950/60 border border-blue-700/40 rounded-xl px-4 py-2.5 mb-4">
        <Crown size={15} className="text-blue-400 shrink-0" />
        <p className="text-sm text-blue-300 flex-1">
          Prueba gratuita — {sub.daysLeft} {sub.daysLeft === 1 ? 'día' : 'días'} restante{sub.daysLeft === 1 ? '' : 's'}
        </p>
        <button
          onClick={handleSubscribe}
          disabled={loadingCheckout}
          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
        >
          {loadingCheckout && <Loader2 size={12} className="animate-spin" />}
          Suscribirse $9.990/mes
        </button>
        <button onClick={() => setDismissed(true)} className="text-blue-600 hover:text-blue-300 transition-colors">
          <X size={14} />
        </button>
      </div>
    )
  }

  // Trial vencido / cancelado / expirado: banner bloqueante, no descartable
  return (
    <div className="flex items-center gap-3 bg-orange-950/70 border border-orange-600/50 rounded-xl px-4 py-3 mb-4">
      <AlertTriangle size={16} className="text-orange-400 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-orange-200">
          {sub.status === 'cancelled' ? 'Suscripción cancelada' : 'Período de prueba finalizado'}
        </p>
        <p className="text-xs text-orange-400 mt-0.5">
          Suscríbete para seguir usando Ergania. Puedes cancelar cuando quieras.
        </p>
      </div>
      <button
        onClick={handleSubscribe}
        disabled={loadingCheckout}
        className="flex items-center gap-1.5 text-sm font-bold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-60 px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
      >
        {loadingCheckout
          ? <Loader2 size={14} className="animate-spin" />
          : <Crown size={14} />
        }
        Suscribirse — $9.990/mes
      </button>
    </div>
  )
}
