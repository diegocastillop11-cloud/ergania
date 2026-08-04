import { Crown, AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { SubscriptionState } from '../../hooks/useSubscription'
import { useTranslation } from '../../lib/i18n/LanguageContext'

interface Props {
  sub: SubscriptionState
}

export default function SubscriptionBanner({ sub }: Props) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)

  // MP es Checkout Pro (pago manual) — sí necesita recordatorio de renovación.
  // PayPal es Subscriptions (cobro automático) — no lo necesita.
  const renewalSoon = sub.status === 'active' && sub.daysLeft !== null && sub.daysLeft <= 3 && sub.paymentProvider !== 'paypal'
  const pendingInTrial = sub.status === 'pending_payment' && sub.daysLeft !== null && sub.daysLeft > 0
  // loadError sin estado confirmado: no mostrar nada hasta saber el estado real
  if (sub.loading || (sub.loadError && sub.status === 'none') || (sub.status === 'active' && !renewalSoon)) return null
  if ((sub.status === 'trial' || renewalSoon || pendingInTrial) && dismissed) return null

  // El pago se elige y confirma en /subscription — ahí vive el checkbox de aceptación
  // de Términos y renuncia al derecho a retracto, requisito previo al pago (Ley 19.496,
  // art. 3° bis). Los botones de este banner solo llevan a esa página, nunca cobran directo.

  // Plan activo por vencer (≤3 días, solo MP): recordatorio de renovación, descartable
  if (renewalSoon) {
    return (
      <div className="flex items-center gap-3 bg-amber-950/60 border border-amber-700/40 rounded-xl px-4 py-2.5 mb-4">
        <AlertTriangle size={15} className="text-amber-400 shrink-0" />
        <p className="text-sm text-amber-200 flex-1">
          {t('subscriptionBanner.renewalNote', { when: sub.daysLeft === 0 ? t('subscriptionBanner.renewalToday') : sub.daysLeft === 1 ? t('subscriptionBanner.renewalTomorrow') : t('subscriptionBanner.renewalInDays', { days: sub.daysLeft ?? 0 }) })}
        </p>
        <Link
          to="/subscription"
          className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] bg-amber-600 hover:bg-amber-500 px-3 py-1.5 rounded-lg transition-colors"
        >
          {t('subscriptionBanner.renewNow')}
        </Link>
        <button onClick={() => setDismissed(true)} className="text-amber-600 hover:text-amber-300 transition-colors">
          <X size={14} />
        </button>
      </div>
    )
  }

  // Trial activo: banner informativo, descartable
  if (sub.status === 'trial') {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-blue-950/60 border border-blue-700/40 rounded-xl px-4 py-2.5 mb-4">
        <div className="flex items-center gap-3 flex-1">
          <Crown size={15} className="text-blue-400 shrink-0" />
          <p className="text-sm text-blue-300 flex-1">
            {t('subscriptionBanner.trialNote', { when: sub.daysLeft === 0 ? t('subscriptionBanner.trialToday') : `${sub.daysLeft} ${sub.daysLeft === 1 ? t('subscriptionBanner.trialDayLeft') : t('subscriptionBanner.trialDaysLeft')}` })}
          </p>
          <button onClick={() => setDismissed(true)} className="text-blue-600 hover:text-blue-300 transition-colors sm:hidden">
            <X size={14} />
          </button>
        </div>
        <Link
          to="/subscription"
          className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg transition-colors sm:shrink-0"
        >
          {t('subscriptionBanner.subscribeMonthly')}
        </Link>
        <button onClick={() => setDismissed(true)} className="hidden sm:block text-blue-600 hover:text-blue-300 transition-colors">
          <X size={14} />
        </button>
      </div>
    )
  }

  // Pago pendiente pero todavía dentro del trial: informativo, no bloquea acceso
  if (pendingInTrial) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-yellow-950/60 border border-yellow-700/40 rounded-xl px-4 py-2.5 mb-4">
        <div className="flex items-center gap-3 flex-1">
          <AlertTriangle size={15} className="text-yellow-400 shrink-0" />
          <p className="text-sm text-yellow-200 flex-1">
            {t('subscriptionBanner.pendingNote', { when: sub.daysLeft === 0 ? t('subscriptionBanner.trialToday') : `${sub.daysLeft} ${sub.daysLeft === 1 ? t('subscriptionBanner.trialDayLeft') : t('subscriptionBanner.trialDaysLeft')}` })}
          </p>
          <button onClick={() => setDismissed(true)} className="text-yellow-600 hover:text-yellow-300 transition-colors sm:hidden">
            <X size={14} />
          </button>
        </div>
        <Link
          to="/subscription"
          className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] bg-yellow-600 hover:bg-yellow-500 px-3 py-1.5 rounded-lg transition-colors sm:shrink-0"
        >
          {t('subscriptionBanner.mercadoPagoLabel')}
        </Link>
        <button onClick={() => setDismissed(true)} className="hidden sm:block text-yellow-600 hover:text-yellow-300 transition-colors">
          <X size={14} />
        </button>
      </div>
    )
  }

  // Trial vencido / cancelado / expirado: banner bloqueante, no descartable
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-orange-950/70 border border-orange-600/50 rounded-xl px-4 py-3 mb-4">
      <div className="flex items-start gap-3 flex-1">
        <AlertTriangle size={16} className="text-orange-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-orange-200">
            {sub.status === 'cancelled' ? t('subscriptionBanner.cancelled') : t('subscriptionBanner.expired')}
          </p>
          <p className="text-xs text-orange-400 mt-0.5">
            {t('subscriptionBanner.expiredNote')}
          </p>
        </div>
      </div>
      <Link
        to="/subscription"
        className="flex items-center justify-center gap-1.5 text-sm font-bold text-[var(--text-primary)] bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded-lg transition-colors whitespace-nowrap sm:shrink-0"
      >
        <Crown size={14} />
        {t('subscriptionBanner.subscribeCta')}
      </Link>
    </div>
  )
}
