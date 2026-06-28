import { Crown, CheckCircle, Clock, XCircle, AlertTriangle, Loader2, CreditCard, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useSubscription } from '../hooks/useSubscription'

const STATUS_CFG = {
  trial:           { icon: Clock,         color: 'text-blue-400',   bg: 'bg-blue-950/50 border-blue-700/40',     label: 'Período de prueba' },
  active:          { icon: CheckCircle,   color: 'text-green-400',  bg: 'bg-green-950/50 border-green-700/40',   label: 'Suscripción activa' },
  expired:         { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-950/50 border-orange-700/40', label: 'Prueba expirada' },
  cancelled:       { icon: XCircle,       color: 'text-red-400',    bg: 'bg-red-950/50 border-red-700/40',       label: 'Suscripción cancelada' },
  pending_payment: { icon: Clock,         color: 'text-yellow-400', bg: 'bg-yellow-950/50 border-yellow-700/40', label: 'Pago pendiente' },
  none:            { icon: AlertTriangle, color: 'text-gray-400',   bg: 'bg-gray-900 border-gray-700',           label: 'Sin plan activo' },
}

export default function Subscription() {
  const sub = useSubscription()
  const [cancelling, setCancelling]       = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [cancelled, setCancelled]         = useState(false)

  const handleSubscribe = async () => {
    setCheckoutLoading(true)
    setError(null)
    try { await sub.openCheckout() }
    catch (e) {
      setError(e instanceof Error ? e.message : 'Error al conectar con MercadoPago')
      setCheckoutLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('¿Cancelar suscripción? Perderás el acceso al finalizar el período actual.')) return
    setCancelling(true)
    setError(null)
    try {
      await sub.cancel()
      setCancelled(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cancelar')
    } finally {
      setCancelling(false)
    }
  }

  if (sub.loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-gray-500" size={28} />
    </div>
  )

  // Si el status viene de un error de red, mostrar opción de reintentar
  const canRetry = sub.status === 'expired' || sub.status === 'none'

  const cfg = STATUS_CFG[sub.status] ?? STATUS_CFG.none
  const StatusIcon = cfg.icon
  const canSubscribe = ['expired', 'cancelled', 'pending_payment', 'none'].includes(sub.status)
  const canCancel    = sub.status === 'active' && !cancelled

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Suscripción</h1>
        <p className="text-gray-500 text-sm mt-0.5">Gestiona tu plan y acceso</p>
      </div>

      {/* Estado actual */}
      <div className={`border rounded-2xl p-5 mb-4 ${cfg.bg}`}>
        <div className="flex items-center gap-2.5 mb-1">
          <StatusIcon size={18} className={cfg.color} />
          <span className={`font-semibold ${cfg.color}`}>{cfg.label}</span>
          {canRetry && (
            <button onClick={() => sub.refresh()} className="ml-auto text-gray-500 hover:text-gray-300 transition-colors" title="Reintentar">
              <RefreshCw size={14} />
            </button>
          )}
        </div>
        <p className="text-gray-400 text-sm">
          {sub.status === 'trial'    && `${sub.daysLeft} día${sub.daysLeft === 1 ? '' : 's'} restante${sub.daysLeft === 1 ? '' : 's'} de prueba gratuita`}
          {sub.status === 'active'   && 'Tienes acceso completo a todas las funciones.'}
          {sub.status === 'expired'  && 'Tu período de prueba terminó. Suscríbete para continuar.'}
          {sub.status === 'cancelled'&& 'Tu suscripción está cancelada. Puedes volver cuando quieras.'}
          {sub.status === 'pending_payment' && 'Hay un pago pendiente. Si ya pagaste, espera unos minutos.'}
          {sub.status === 'none'     && 'Suscríbete para acceder a todas las funciones.'}
        </p>
      </div>

      {/* Plan */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Plan</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shrink-0">
              <Crown size={16} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Plan Mensual</p>
              <p className="text-xs text-gray-500">Cancela cuando quieras</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-white">$9.990</p>
            <p className="text-xs text-gray-500">CLP / mes</p>
          </div>
        </div>
      </div>

      {/* Errores */}
      {error && <p className="text-red-400 text-sm mb-3 px-1">{error}</p>}

      {/* Acciones */}
      {canSubscribe && (
        <button
          onClick={handleSubscribe}
          disabled={checkoutLoading}
          className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors mb-3"
        >
          {checkoutLoading ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
          Suscribirse — $9.990/mes con MercadoPago
        </button>
      )}

      {canCancel && (
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="w-full flex items-center justify-center gap-2 border border-red-900 text-red-400 hover:bg-red-950/40 disabled:opacity-60 text-sm font-medium py-2.5 rounded-xl transition-colors"
        >
          {cancelling && <Loader2 size={13} className="animate-spin" />}
          Cancelar suscripción
        </button>
      )}

      {cancelled && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center mt-2">
          <p className="text-gray-400 text-sm">Suscripción cancelada. Puedes volver a suscribirte cuando quieras.</p>
        </div>
      )}
    </div>
  )
}
