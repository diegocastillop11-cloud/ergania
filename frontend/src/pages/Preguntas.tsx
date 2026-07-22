import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, MessageSquare } from 'lucide-react'
import ContactModal from '../components/ContactModal'
import { useTranslation } from '../lib/i18n/LanguageContext'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

interface Faq { id: string; question: string; answer: string }

export default function Preguntas() {
  const { t } = useTranslation()
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [showContact, setShowContact] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/api/faqs`)
      .then(r => r.json())
      .then(d => setFaqs(d.faqs || []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center p-4 py-10">
      <div className="w-full max-w-lg">

        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Ergania" className="w-14 h-14 rounded-2xl mb-4 shadow-lg object-contain" />
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('preguntas.title')}</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1 text-center">{t('preguntas.subtitle')}</p>
        </div>

        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] shadow-xl overflow-hidden">
          {loading ? (
            <p className="text-center text-sm text-[var(--text-muted)] py-10">{t('preguntas.loading')}</p>
          ) : faqs.length === 0 ? (
            <p className="text-center text-sm text-[var(--text-muted)] py-10">{t('preguntas.empty')}</p>
          ) : (
            faqs.map((f, i) => {
              const open = openId === f.id
              return (
                <div key={f.id} className={i > 0 ? 'border-t border-[var(--border-default)]' : ''}>
                  <button
                    onClick={() => setOpenId(open ? null : f.id)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-medium text-[var(--text-primary)]">{f.question}</span>
                    <ChevronDown size={16} className={`shrink-0 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <p className="px-5 pb-4 text-sm text-[var(--text-tertiary)] whitespace-pre-wrap leading-relaxed">
                      {f.answer}
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] shadow-xl p-5 mt-4 text-center">
          <p className="text-sm text-[var(--text-secondary)] mb-3">{t('preguntas.notFound')}</p>
          <button
            onClick={() => setShowContact(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] rounded-xl text-sm font-semibold transition-colors"
          >
            <MessageSquare size={14} /> {t('preguntas.askOwn')}
          </button>
        </div>

        <div className="flex justify-center mt-6">
          <Link to="/login" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
            {t('preguntas.backToLogin')}
          </Link>
        </div>
      </div>

      {showContact && <ContactModal onClose={() => setShowContact(false)} />}
    </div>
  )
}
