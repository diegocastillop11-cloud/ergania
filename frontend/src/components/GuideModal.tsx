import { X, UserCircle, Target, Globe, Radio, Zap, Send } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../lib/i18n/LanguageContext'

const STEPS = [
  { num: 1, key: '1', icon: UserCircle, color: 'from-blue-600 to-blue-800', iconColor: 'text-blue-200', route: '/profile' },
  { num: 2, key: '2', icon: Target,     color: 'from-amber-600 to-amber-800', iconColor: 'text-amber-200', route: '/busqueda' },
  { num: 3, key: '3', icon: Globe,      color: 'from-teal-600 to-teal-800', iconColor: 'text-teal-200', route: '/portals' },
  { num: 4, key: '4', icon: Radio,      color: 'from-purple-600 to-purple-800', iconColor: 'text-purple-200', route: '/scanner' },
  { num: 5, key: '5', icon: Zap,        color: 'from-yellow-600 to-yellow-800', iconColor: 'text-yellow-200', route: '/pipeline' },
  { num: 6, key: '6', icon: Send,       color: 'from-green-600 to-green-800', iconColor: 'text-green-200', route: '/postulaciones' },
]

interface Props { onClose: () => void }

export default function GuideModal({ onClose }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const go = (route: string) => {
    onClose()
    navigate(route)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-6 px-4">
      <div className="w-full max-w-xl bg-[var(--bg-app)] border border-[var(--border-default)] rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-default)]">
          <div>
            <h2 className="text-[var(--text-primary)] font-bold text-lg">{t('guideModal.title')}</h2>
            <p className="text-[var(--text-tertiary)] text-sm mt-0.5">{t('guideModal.subtitle')}</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {/* Steps */}
        <div className="p-5 space-y-3">
          {STEPS.map(step => {
            const Icon = step.icon
            return (
              <div key={step.num} className="flex gap-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl overflow-hidden">
                {/* Visual strip */}
                <div className={`bg-gradient-to-b ${step.color} flex flex-col items-center justify-center px-4 py-4 shrink-0 gap-2`}>
                  <span className="text-white/60 text-xs font-bold">{step.num}</span>
                  <Icon size={22} className={step.iconColor} />
                </div>
                {/* Content */}
                <div className="py-4 pr-4 flex-1 min-w-0">
                  <p className="text-[var(--text-primary)] font-semibold text-sm mb-1">{t(`guideModal.steps.${step.key}.title`)}</p>
                  <p className="text-[var(--text-tertiary)] text-xs leading-relaxed mb-3">{t(`guideModal.steps.${step.key}.desc`)}</p>
                  <button
                    onClick={() => go(step.route)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                  >
                    {t(`guideModal.steps.${step.key}.cta`)} →
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] text-sm font-semibold rounded-xl transition-colors"
          >
            {t('guideModal.gotIt')}
          </button>
        </div>
      </div>
    </div>
  )
}
