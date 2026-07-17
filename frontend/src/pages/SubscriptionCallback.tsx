import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react'
import { useTranslation } from '../lib/i18n/LanguageContext'

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

  const type = (pathname.split('/').pop() ?? 'failure') as CallbackType
  const cfg = CONFIG[type] ?? CONFIG.failure
  const Icon = cfg.icon

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
