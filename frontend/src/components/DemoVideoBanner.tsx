import { useState } from 'react'
import { PlayCircle, X } from 'lucide-react'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { DEMO_POSTER_URL } from '../lib/demoVideo'
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
        <div className="relative overflow-hidden rounded-2xl border border-violet-500/40 bg-gradient-to-r from-indigo-900/70 via-violet-900/60 to-fuchsia-900/50 mb-4">
          {/* Halo decorativo, detrás del contenido y sin capturar clicks */}
          <div className="pointer-events-none absolute -top-16 -right-10 h-52 w-52 rounded-full bg-violet-500/25 blur-3xl" />

          <button
            onClick={dismiss}
            aria-label={t('demoVideo.dismiss')}
            className="absolute top-3 right-3 z-10 text-violet-300/60 hover:text-violet-100 transition-colors"
          >
            <X size={16} />
          </button>

          <div className="relative flex flex-col sm:flex-row items-center gap-5 p-5 sm:p-6">
            <button
              onClick={() => setShowVideo(true)}
              className="group relative shrink-0 rounded-xl overflow-hidden border border-violet-400/30 w-full sm:w-52"
              aria-label={t('demoVideo.bannerCta')}
            >
              <img
                src={DEMO_POSTER_URL}
                alt=""
                className="block w-full h-auto"
                style={{ aspectRatio: '17 / 9', objectFit: 'cover' }}
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/25 transition-colors">
                <PlayCircle size={40} className="text-white drop-shadow-lg" />
              </span>
            </button>

            <div className="flex-1 text-center sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-300 mb-1.5">
                {t('demoVideo.bannerKicker')}
              </p>
              <h3 className="text-lg sm:text-xl font-bold text-white leading-snug">
                {t('demoVideo.bannerText')}
              </h3>
              <p className="text-sm text-violet-200/80 mt-1.5">
                {t('demoVideo.bannerSubtext')}
              </p>
            </div>

            <button
              onClick={() => setShowVideo(true)}
              className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-violet-950 hover:bg-violet-50 transition-colors shadow-lg shadow-violet-900/40"
            >
              <PlayCircle size={18} />
              {t('demoVideo.bannerCta')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
