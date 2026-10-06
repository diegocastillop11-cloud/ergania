import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { api } from '../../lib/api'
import { useTranslation } from '../../lib/i18n/LanguageContext'

export default function JobAlertsToggle() {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<{ enabled: boolean }>('/alerts')
      .then(({ data }) => setEnabled(data.enabled))
      .catch(() => setEnabled(null)) // sin la tabla/migración, el interruptor simplemente no aparece
  }, [])

  if (enabled === null) return null

  const toggle = async () => {
    setSaving(true)
    setError('')
    try {
      const { data } = await api.put<{ enabled: boolean }>('/alerts', { enabled: !enabled })
      setEnabled(data.enabled)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('jobAlerts.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
          {enabled ? <Bell size={15} className="text-green-400" /> : <BellOff size={15} className="text-[var(--text-muted)]" />}
          {t('jobAlerts.title')}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{t('jobAlerts.desc')}</p>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 ${enabled
          ? 'bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] border border-[var(--border-alt)]'
          : 'bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)]'}`}
      >
        {saving && <Loader2 size={12} className="animate-spin" />}
        {enabled ? t('jobAlerts.disable') : t('jobAlerts.enable')}
      </button>
    </div>
  )
}
