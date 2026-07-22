import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Smartphone, X } from 'lucide-react'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { logApkDownload } from '../lib/logApkDownload'
import { ANDROID_APK_VERSION, ANDROID_APK_FILENAME } from '../lib/appVersion'

const DISMISS_KEY = 'ergania:androidBannerDismissed'

export default function AndroidAppBanner() {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')

  if (Capacitor.isNativePlatform() || dismissed) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="flex items-center gap-3 bg-emerald-950/60 border border-emerald-700/40 rounded-xl px-4 py-2.5 mb-4">
      <Smartphone size={16} className="text-emerald-400 shrink-0" />
      <p className="text-sm text-emerald-200 flex-1">{t('dashboard.androidBanner.text')}</p>
      <a
        href="/ergania.apk"
        download={ANDROID_APK_FILENAME}
        onClick={logApkDownload}
        className="text-xs font-semibold text-[var(--text-primary)] bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
      >
        {t('dashboard.androidBanner.cta', { version: ANDROID_APK_VERSION })}
      </a>
      <button onClick={dismiss} className="text-emerald-600 hover:text-emerald-300 transition-colors">
        <X size={14} />
      </button>
    </div>
  )
}
