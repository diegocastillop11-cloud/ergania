import { useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { linkPreapproval } from '../lib/subscriptionApi'

type CallbackType = 'success' | 'failure' | 'pending'

const CONFIG = {
  success: {
    icon: CheckCircle2,
    color: 'text-green-400',
    bg: 'from-green-950 to-gray-950',
    border: 'border-green-800',
    redirect: '/dashboard',
    delay: 3000,
  },
  failure: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'from-red-950 to-gray-950',
    border: 'border-red-800',
    redirect: '/subscription',
    delay: 4000,
  },
  pending: {
    icon: Clock,
    color: 'text-yellow-400',
    bg: 'from-yellow-950 to-gray-950',
    border: 'border-yellow-800',
    redirect: '/dashboard',
    delay: 4000,
  },
}

export default function SubscriptionCallback() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()

  const type = (pathname.split('/').pop() ?? 'failure') as CallbackType
  const cfg = CONFIG[type] ?? CONFIG.failure
  const Icon = cfg.icon

  // El checkout de suscripción de MP no acepta external_reference, así que
  // esta vuelta es donde se une el pago con la cuenta: acá sabemos quién es
  // el usuario (sesión propia) y MP nos pasa su preapproval_id en la URL.
  // MP no es consistente con el nombre: en una vuelta real (2026-08-10) mandó
  // el id de la suscripción en `external_reference`, y mezcla guion con guion
  // bajo entre parámetros. Se aceptan todas las variantes porque perder la
  // asociación por el nombre de un parámetro deja a alguien que pagó sin
  // acceso. El backend valida que el id sea una suscripción de nuestro plan,
  // así que aceptar de más no abre ningún hueco.
  const preapprovalId = params.get('preapproval_id')
    || params.get('preapproval-id')
    || params.get('external_reference')

  useEffect(() => {
    if (!preapprovalId) return
    linkPreapproval(preapprovalId).catch(err => {
      // No se le muestra al usuario: el webhook y el reconciliador son la red
      // de atrás. Pero tiene que quedar en consola para poder diagnosticarlo.
      console.error('[subscription-callback] no se pudo asociar la suscripción:', err)
    })
  }, [preapprovalId])

  useEffect(() => {
    const timer = setTimeout(() => navigate(cfg.redirect, { replace: true }), cfg.delay)
    return () => clearTimeout(timer)
  }, [navigate, cfg.redirect, cfg.delay])

  return (
    <div className={`min-h-screen bg-gradient-to-b ${cfg.bg} flex items-center justify-center p-4`}>
      <div className={`max-w-sm w-full bg-[var(--bg-surface)] border ${cfg.border} rounded-2xl p-8 text-center shadow-2xl`}>
        <Icon size={48} className={`${cfg.color} mx-auto mb-4`} />
        <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">{t(`subscriptionCallback.${type in CONFIG ? type : 'failure'}.title`)}</h1>
        <p className="text-[var(--text-tertiary)] text-sm">{t(`subscriptionCallback.${type in CONFIG ? type : 'failure'}.msg`)}</p>
        <div className="mt-6 flex items-center justify-center gap-2 text-[var(--text-muted)] text-xs">
          <Loader2 size={12} className="animate-spin" />
          {t('subscriptionCallback.redirecting')}
        </div>
      </div>
    </div>
  )
}
