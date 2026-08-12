import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { DEMO_VIDEO_URL, DEMO_POSTER_URL, DEMO_ASPECT_RATIO } from '../lib/demoVideo'
import { useLogFirstPlay } from '../lib/useLogFirstPlay'

interface Props { onClose: () => void }

export default function DemoVideoModal({ onClose }: Props) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const onFirstPlay = useLogFirstPlay('dashboard')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      // Sin esto el audio sigue sonando después de cerrar: React desmonta el nodo pero el
      // navegador no siempre detiene la reproducción antes de soltarlo.
      videoRef.current?.pause()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[var(--bg-app)] border border-[var(--border-default)] rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
          <div>
            <h2 className="text-[var(--text-primary)] font-bold text-base">{t('demoVideo.modalTitle')}</h2>
            <p className="text-[var(--text-tertiary)] text-xs mt-0.5">{t('demoVideo.modalSubtitle')}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('demoVideo.close')}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* El modal solo se monta al hacer click, así que acá sí conviene autoPlay: el
            usuario ya expresó la intención de ver el video. */}
        <video
          ref={videoRef}
          controls
          autoPlay
          playsInline
          onPlay={onFirstPlay}
          poster={DEMO_POSTER_URL}
          className="w-full bg-black"
          style={{ aspectRatio: DEMO_ASPECT_RATIO, objectFit: 'contain' }}
        >
          <source src={DEMO_VIDEO_URL} type="video/mp4" />
        </video>
      </div>
    </div>
  )
}
