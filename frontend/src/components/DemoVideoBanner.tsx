import { useState } from 'react'
import { PlayCircle, X } from 'lucide-react'
import { useTranslation } from '../lib/i18n/LanguageContext'
import DemoVideoModal from './DemoVideoModal'

const DISMISS_KEY = 'ergania:demoVideoBannerDismissed'

export default function DemoVideoBanner() {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')
  const [showVideo, setShowVideo] = useState(false)

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  // El modal sobrevive al descarte del banner: si lo cierran con la X mientras ven el
  // video, no tiene sentido cortarles la reproducción.
  return (
    <>
      {showVideo && <DemoVideoModal onClose={() => setShowVideo(false)} />}

      {!dismissed && (
        <div className="flex items-center gap-3 bg-indigo-950/60 border border-indigo-700/40 rounded-xl px-4 py-2.5 mb-4">
          <PlayCircle size={16} className="text-indigo-300 shrink-0" />
          <p className="text-sm text-indigo-200 flex-1">{t('demoVideo.bannerText')}</p>
          <button
            onClick={() => setShowVideo(true)}
            className="text-xs font-semibold text-[var(--text-primary)] bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            {t('demoVideo.bannerCta')}
          </button>
          <button onClick={dismiss} aria-label={t('demoVideo.dismiss')} className="text-indigo-600 hover:text-indigo-300 transition-colors">
            <X size={14} />
          </button>
        </div>
      )}
    </>
  )
}
