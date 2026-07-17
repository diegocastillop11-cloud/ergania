import { Crown, AlertTriangle, X, Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { SubscriptionState } from '../../hooks/useSubscription'
import { useTranslation } from '../../lib/i18n/LanguageContext'

interface Props {
  sub: SubscriptionState
}

export default function SubscriptionBanner({ sub }: Props) {
  const { t } = useTranslation()
  const [loadingProvider, setLoadingProvider] = useState<'mercadopago' | 'paypal' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  // MP es Checkout Pro (pago manual) — sí necesita recordatorio de renovación.
  // PayPal es Subscriptions (cobro automático) — no lo necesita.
  const renewalSoon = sub.status === 'active' && sub.daysLeft !== null && sub.daysLeft <= 3 && sub.paymentProvider !== 'paypal'
  const pendingInTrial = sub.status === 'pending_payment' && sub.daysLeft !== null && sub.daysLeft > 0
  if (sub.loading || (sub.status === 'active' && !renewalSoon)) return null
  if ((sub.status === 'trial' || renewalSoon || pendingInTrial) && dismissed) return null

  const loadingCheckout = loadingProvider !== null

  const handleSubscribe = async () => {
    setLoadingProvider('mercadopago')
    setError(null)
    try {
      await sub.openCheckout()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('subscriptionBanner.mercadoPagoError'))
      setLoadingProvider(null)
    }
  }

  const handleSubscribePayPal = async () => {
    setLoadingProvider('paypal')
    setError(null)
    try {
      await sub.openPayPalCheckout()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('subscriptionBanner.payPalError'))
      setLoadingProvider(null)
    }
  }

  // Plan activo por vencer (≤3 días, solo MP): recordatorio de renovación, descartable
  if (renewalSoon) {
    return (
      <div className="flex flex-col gap-1 mb-4">
        <div className="flex items-center gap-3 bg-amber-950/60 border border-amber-700/40 rounded-xl px-4 py-2.5">
          <AlertTriangle size={15} className="text-amber-400 shrink-0" />
          <p className="text-sm text-amber-200 flex-1">
            {t('subscriptionBanner.renewalNote', { when: sub.daysLeft === 0 ? t('subscriptionBanner.renewalToday') : sub.daysLeft === 1 ? t('subscriptionBanner.renewalTomorrow') : t('subscriptionBanner.renewalInDays', { days: sub.daysLeft ?? 0 }) })}
          </p>
          <button
            onClick={handleSubscribe}
            disabled={loadingCheckout}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] bg-amber-600 hover:bg-amber-500 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
          >
            {loadingCheckout && <Loader2 size={12} className="animate-spin" />}
            {t('subscriptionBanner.renewNow')}
          </button>
          <button onClick={() => setDismissed(true)} className="text-amber-600 hover:text-amber-300 transition-colors">
            <X size={14} />
          </button>
        </div>
        {error && <p className="text-xs text-red-400 px-1">{error}</p>}
      </div>
    )
  }

  // Trial activo: banner informativo, descartable
  if (sub.status === 'trial') {
    return (
      <div className="flex flex-col gap-1 mb-4">
        <div className="flex items-center gap-3 bg-blue-950/60 border border-blue-700/40 rounded-xl px-4 py-2.5">
          <Crown size={15} className="text-blue-400 shrink-0" />
          <p className="text-sm text-blue-300 flex-1">
            {t('subscriptionBanner.trialNote', { when: sub.daysLeft === 0 ? t('subscriptionBanner.trialToday') : `${sub.daysLeft} ${sub.daysLeft === 1 ? t('subscriptionBanner.trialDayLeft') : t('subscriptionBanner.trialDaysLeft')}` })}
          </p>
          <button
            onClick={handleSubscribe}
            disabled={loadingCheckout}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] bg-blue-600 hover:bg-blue-500 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
          >
            {loadingProvider === 'mercadopago' && <Loader2 size={12} className="animate-spin" />}
            {t('subscriptionBanner.subscribeMonthly')}
          </button>
          <button
            onClick={handleSubscribePayPal}
            disabled={loadingCheckout}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] bg-[#003087] hover:bg-[#00256b] disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
          >
            {loadingProvider === 'paypal' && <Loader2 size={12} className="animate-spin" />}
            {t('subscriptionBanner.payPalMonthly')}
          </button>
          <button onClick={() => setDismissed(true)} className="text-blue-600 hover:text-blue-300 transition-colors">
            <X size={14} />
          </button>
        </div>
        {error && <p className="text-xs text-red-400 px-1">{error}</p>}
      </div>
    )
  }

  // Pago pendiente pero todavía dentro del trial: informativo, no bloquea acceso
  if (pendingInTrial) {
    return (
      <div className="flex flex-col gap-1 mb-4">
        <div className="flex items-center gap-3 bg-yellow-950/60 border border-yellow-700/40 rounded-xl px-4 py-2.5">
          <AlertTriangle size={15} className="text-yellow-400 shrink-0" />
          <p className="text-sm text-yellow-200 flex-1">
            {t('subscriptionBanner.pendingNote', { when: sub.daysLeft === 0 ? t('subscriptionBanner.trialToday') : `${sub.daysLeft} ${sub.daysLeft === 1 ? t('subscriptionBanner.trialDayLeft') : t('subscriptionBanner.trialDaysLeft')}` })}
          </p>
          <button
            onClick={handleSubscribe}
            disabled={loadingCheckout}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] bg-yellow-600 hover:bg-yellow-500 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
          >
            {loadingProvider === 'mercadopago' && <Loader2 size={12} className="animate-spin" />}
            {t('subscriptionBanner.mercadoPagoLabel')}
          </button>
          <button
            onClick={handleSubscribePayPal}
            disabled={loadingCheckout}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] bg-[#003087] hover:bg-[#00256b] disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
          >
            {loadingProvider === 'paypal' && <Loader2 size={12} className="animate-spin" />}
            {t('subscriptionBanner.payPalLabel')}
          </button>
          <button onClick={() => setDismissed(true)} className="text-yellow-600 hover:text-yellow-300 transition-colors">
            <X size={14} />
          </button>
        </div>
        {error && <p className="text-xs text-red-400 px-1">{error}</p>}
      </div>
    )
  }

  // Trial vencido / cancelado / expirado: banner bloqueante, no descartable
  return (
    <div className="flex flex-col gap-1 mb-4">
      <div className="flex items-center gap-3 bg-orange-950/70 border border-orange-600/50 rounded-xl px-4 py-3">
        <AlertTriangle size={16} className="text-orange-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-orange-200">
            {sub.status === 'cancelled' ? t('subscriptionBanner.cancelled') : t('subscriptionBanner.expired')}
          </p>
          <p className="text-xs text-orange-400 mt-0.5">
            {t('subscriptionBanner.expiredNote')}
          </p>
        </div>
        <button
          onClick={handleSubscribe}
          disabled={loadingCheckout}
          className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-primary)] bg-orange-600 hover:bg-orange-500 disabled:opacity-60 px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          {loadingProvider === 'mercadopago'
            ? <Loader2 size={14} className="animate-spin" />
            : <Crown size={14} />
          }
          {t('subscriptionBanner.mercadoPagoShort')}
        </button>
        <button
          onClick={handleSubscribePayPal}
          disabled={loadingCheckout}
          className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-primary)] bg-[#003087] hover:bg-[#00256b] disabled:opacity-60 px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          {loadingProvider === 'paypal' && <Loader2 size={14} className="animate-spin" />}
          {t('subscriptionBanner.payPalShort')}
        </button>
      </div>
      {error && <p className="text-xs text-red-400 px-1">{error}</p>}
    </div>
  )
}
