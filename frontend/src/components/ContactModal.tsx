import { useState, FormEvent } from 'react'
import { X, MessageSquare, Loader, CheckCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useTranslation } from '../lib/i18n/LanguageContext'

// Los value= se envían al backend en español — solo la etiqueta visible se traduce.
const CATEGORIES: Array<{ value: string; key: string }> = [
  { value: 'Consulta general',  key: 'general' },
  { value: 'Problema técnico',  key: 'technical' },
  { value: 'Sugerencia',        key: 'suggestion' },
  { value: 'Reclamo',           key: 'complaint' },
  { value: 'Felicitación',      key: 'compliment' },
  { value: 'Otro',              key: 'other' },
]

interface Props {
  onClose: () => void
}

export default function ContactModal({ onClose }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState(user?.email ?? '')
  const [category, setCategory] = useState('')
  const [message,  setMessage]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [sent,     setSent]     = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, category, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('contactModal.genericError'))
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('contactModal.sendFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Panel derecho */}
      <div className="relative w-full max-w-sm bg-[var(--bg-surface)] border-l border-[var(--border-default)] flex flex-col shadow-2xl animate-slide-in-right">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0">
              <MessageSquare size={16} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('contactModal.title')}</h2>
              <p className="text-xs text-[var(--text-muted)]">{t('contactModal.subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-5">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CheckCircle size={48} className="text-green-400" />
              <p className="text-[var(--text-primary)] font-semibold text-base">{t('contactModal.sentTitle')}</p>
              <p className="text-sm text-[var(--text-tertiary)]">{t('contactModal.sentDesc')}</p>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] text-sm font-medium rounded-xl transition-colors"
              >
                {t('contactModal.close')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Nombre */}
              <div>
                <label className="text-xs text-[var(--text-tertiary)] mb-1.5 block">{t('contactModal.nameLabel')}</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('contactModal.namePlaceholder')}
                  className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-xs text-[var(--text-tertiary)] mb-1.5 block">{t('contactModal.emailLabel')}</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('contactModal.emailPlaceholder')}
                  className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="text-xs text-[var(--text-tertiary)] mb-1.5 block">{t('contactModal.categoryLabel')}</label>
                <select
                  required
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t('contactModal.categorySelect')}</option>
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{t(`contactModal.categories.${c.key}`)}</option>
                  ))}
                </select>
              </div>

              {/* Mensaje */}
              <div>
                <label className="text-xs text-[var(--text-tertiary)] mb-1.5 block">{t('contactModal.messageLabel')}</label>
                <textarea
                  required
                  rows={5}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={t('contactModal.messagePlaceholder')}
                  className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 bg-red-950 border border-red-800 rounded-xl px-3 py-2.5 text-sm text-red-300">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-[var(--text-primary)] rounded-xl text-sm font-semibold transition-colors"
              >
                {loading
                  ? <><Loader size={14} className="animate-spin" /> {t('contactModal.sending')}</>
                  : <><MessageSquare size={14} /> {t('contactModal.send')}</>
                }
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
