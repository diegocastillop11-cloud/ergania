import { Crown, CheckCircle, Clock, XCircle, AlertTriangle, Loader2, CreditCard, RefreshCw } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useSubscription } from '../hooks/useSubscription'
import { useTranslation } from '../lib/i18n/LanguageContext'

const STATUS_ICONS = {
  trial: Clock, active: CheckCircle, expired: AlertTriangle,
  cancelled: XCircle, pending_payment: Clock, none: AlertTriangle,
}
const STATUS_STYLES = {
  trial:           { color: 'text-blue-400',   bg: 'bg-blue-950/50 border-blue-700/40' },
  active:          { color: 'text-green-400',  bg: 'bg-green-950/50 border-green-700/40' },
  expired:         { color: 'text-orange-400', bg: 'bg-orange-950/50 border-orange-700/40' },
  cancelled:       { color: 'text-red-400',    bg: 'bg-red-950/50 border-red-700/40' },
  pending_payment: { color: 'text-yellow-400', bg: 'bg-yellow-950/50 border-yellow-700/40' },
  none:            { color: 'text-[var(--text-tertiary)]',   bg: 'bg-[var(--bg-surface)] border-[var(--border-alt)]' },
}

export default function Subscription() {
  const { t } = useTranslation()
  const sub = useSubscription()
  const [cancelling, setCancelling]       = useState(false)
  const [checkoutProvider, setCheckoutProvider] = useState<'mercadopago' | 'paypal' | null>(null)
  const [error, setError]                 = useState<string | null>(null)
  const [cancelled, setCancelled]         = useState(false)

  const checkoutLoading = checkoutProvider !== null

  // window.location.href a MercadoPago/PayPal navega fuera del SPA sin que la promesa
  // resuelva nunca — si el usuario presiona "atrás" sin pagar, el navegador restaura la
  // página desde bfcache con el estado de loading tal cual quedó, dejando los botones
  // bloqueados para siempre. `pageshow` con `persisted: true` detecta esa restauración.
  const checkoutProviderRef = useRef(checkoutProvider)
  useEffect(() => { checkoutProviderRef.current = checkoutProvider }, [checkoutProvider])

  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted && checkoutProviderRef.current !== null) {
        setCheckoutProvider(null)
        setError(t('subscription.checkoutIncomplete'))
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [t])

  const handleSubscribe = async () => {
    setCheckoutProvider('mercadopago')
    setError(null)
    try { await sub.openCheckout() }
    catch (e) {
      setError(e instanceof Error ? e.message : t('subscription.mercadoPagoError'))
      setCheckoutProvider(null)
    }
  }

  const handleSubscribePayPal = async () => {
    setCheckoutProvider('paypal')
    setError(null)
    try { await sub.openPayPalCheckout() }
    catch (e) {
      setError(e instanceof Error ? e.message : t('subscription.payPalError'))
      setCheckoutProvider(null)
    }
  }

  const handleCancel = async () => {
    if (!confirm(t('subscription.cancelConfirm'))) return
    setCancelling(true)
    setError(null)
    try {
      await sub.cancel()
      setCancelled(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('subscription.cancelError'))
    } finally {
      setCancelling(false)
    }
  }

  if (sub.loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-[var(--text-muted)]" size={28} />
    </div>
  )

  // Si el status viene de un error de red, mostrar opción de reintentar
  const canRetry = sub.status === 'expired' || sub.status === 'none'

  const style = STATUS_STYLES[sub.status] ?? STATUS_STYLES.none
  const StatusIcon = STATUS_ICONS[sub.status] ?? STATUS_ICONS.none
  const canSubscribe = ['expired', 'cancelled', 'pending_payment', 'none'].includes(sub.status)
  const canCancel    = sub.status === 'active' && !cancelled

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">{t('subscription.title')}</h1>
        <p className="text-[var(--text-muted)] text-sm mt-0.5">{t('subscription.subtitle')}</p>
      </div>

      {/* Estado actual */}
      <div className={`border rounded-2xl p-5 mb-4 ${style.bg}`}>
        <div className="flex items-center gap-2.5 mb-1">
          <StatusIcon size={18} className={style.color} />
          <span className={`font-semibold ${style.color}`}>{t(`subscription.status.${sub.status}`)}</span>
          {canRetry && (
            <button onClick={() => sub.refresh()} className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors" title={t('subscription.retryTitle')}>
              <RefreshCw size={14} />
            </button>
          )}
        </div>
        <p className="text-[var(--text-tertiary)] text-sm">
          {sub.status === 'trial'    && (sub.daysLeft === 0 ? t('subscription.statusMessages.trialToday') : t('subscription.statusMessages.trialDays', { days: sub.daysLeft ?? 0, plural: sub.daysLeft === 1 ? '' : 's' }))}
          {sub.status === 'active'   && t('subscription.statusMessages.active')}
          {sub.status === 'expired'  && t('subscription.statusMessages.expired')}
          {sub.status === 'cancelled'&& t('subscription.statusMessages.cancelled')}
          {sub.status === 'pending_payment' && t('subscription.statusMessages.pending_payment')}
          {sub.status === 'none'     && t('subscription.statusMessages.none')}
        </p>
      </div>

      {/* Plan */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl p-5 mb-4">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">{t('subscription.planLabel')}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shrink-0">
              <Crown size={16} className="text-[var(--text-primary)]" />
            </div>
            <div>
              <p className="font-semibold text-[var(--text-primary)] text-sm">{t('subscription.planName')}</p>
              <p className="text-xs text-[var(--text-muted)]">{t('subscription.planCancelNote')}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-[var(--text-primary)]">$9.990</p>
            <p className="text-xs text-[var(--text-muted)]">{t('subscription.priceClp')}</p>
            <p className="text-sm font-semibold text-[var(--text-secondary)] mt-1">{t('subscription.priceUsd')}</p>
          </div>
        </div>
      </div>

      {/* Errores */}
      {error && <p className="text-red-400 text-sm mb-3 px-1">{error}</p>}

      {/* Acciones */}
      {canSubscribe && (
        <div className="flex flex-col gap-2 mb-3">
          <button
            onClick={handleSubscribe}
            disabled={checkoutLoading}
            className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-[var(--text-primary)] font-bold py-3 rounded-xl transition-colors"
          >
            {checkoutProvider === 'mercadopago' ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
            {t('subscription.subscribeMercadoPago')}
          </button>
          <button
            onClick={handleSubscribePayPal}
            disabled={checkoutLoading}
            className="w-full flex items-center justify-center gap-2 bg-[#003087] hover:bg-[#00256b] disabled:opacity-60 text-[var(--text-primary)] font-bold py-3 rounded-xl transition-colors"
          >
            {checkoutProvider === 'paypal' && <Loader2 size={15} className="animate-spin" />}
            {t('subscription.subscribePayPal')}
          </button>
        </div>
      )}

      {canCancel && (
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="w-full flex items-center justify-center gap-2 border border-red-900 text-red-400 hover:bg-red-950/40 disabled:opacity-60 text-sm font-medium py-2.5 rounded-xl transition-colors"
        >
          {cancelling && <Loader2 size={13} className="animate-spin" />}
          {t('subscription.cancelSubscription')}
        </button>
      )}

      {cancelled && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4 text-center mt-2">
          <p className="text-[var(--text-tertiary)] text-sm">{t('subscription.cancelledNote')}</p>
        </div>
      )}
    </div>
  )
}
