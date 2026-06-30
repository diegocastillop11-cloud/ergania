import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react'

type CallbackType = 'success' | 'failure' | 'pending'

const CONFIG = {
  success: {
    icon: CheckCircle2,
    color: 'text-green-400',
    bg: 'from-green-950 to-gray-950',
    border: 'border-green-800',
    title: '¡Pago recibido!',
    msg: 'Tu suscripción quedó activa. Redirigiendo al dashboard...',
    redirect: '/dashboard',
    delay: 3000,
  },
  failure: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'from-red-950 to-gray-950',
    border: 'border-red-800',
    title: 'El pago no se completó',
    msg: 'Hubo un problema con tu pago. Puedes intentarlo de nuevo desde tu cuenta.',
    redirect: '/subscription',
    delay: 4000,
  },
  pending: {
    icon: Clock,
    color: 'text-yellow-400',
    bg: 'from-yellow-950 to-gray-950',
    border: 'border-yellow-800',
    title: 'Pago en proceso',
    msg: 'Tu pago está siendo procesado. Te avisaremos cuando se confirme. Redirigiendo...',
    redirect: '/dashboard',
    delay: 4000,
  },
}

export default function SubscriptionCallback() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const type = (pathname.split('/').pop() ?? 'failure') as CallbackType
  const cfg = CONFIG[type] ?? CONFIG.failure
  const Icon = cfg.icon

  useEffect(() => {
    const t = setTimeout(() => navigate(cfg.redirect, { replace: true }), cfg.delay)
    return () => clearTimeout(t)
  }, [navigate, cfg.redirect, cfg.delay])

  return (
    <div className={`min-h-screen bg-gradient-to-b ${cfg.bg} flex items-center justify-center p-4`}>
      <div className={`max-w-sm w-full bg-gray-900 border ${cfg.border} rounded-2xl p-8 text-center shadow-2xl`}>
        <Icon size={48} className={`${cfg.color} mx-auto mb-4`} />
        <h1 className="text-xl font-bold text-white mb-2">{cfg.title}</h1>
        <p className="text-gray-400 text-sm">{cfg.msg}</p>
        <div className="mt-6 flex items-center justify-center gap-2 text-gray-500 text-xs">
          <Loader2 size={12} className="animate-spin" />
          Redirigiendo...
        </div>
      </div>
    </div>
  )
}
