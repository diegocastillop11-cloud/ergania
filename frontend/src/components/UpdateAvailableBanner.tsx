import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Download, X } from 'lucide-react'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { ANDROID_APK_VERSION } from '../lib/appVersion'
import { logApkDownload } from '../lib/logApkDownload'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
const dismissKey = (version: string) => `ergania:updateBannerDismissed:${version}`

export default function UpdateAvailableBanner() {
  const { t } = useTranslation()
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    fetch(`${API_BASE}/api/apk/version`)
      .then(res => res.json())
      .then((data: { version?: string }) => {
        if (data?.version && data.version !== ANDROID_APK_VERSION) {
          setLatestVersion(data.version)
          setDismissed(localStorage.getItem(dismissKey(data.version)) === '1')
        }
      })
      .catch(() => {})
  }, [])

  if (!latestVersion || dismissed) return null

  const dismiss = () => {
    localStorage.setItem(dismissKey(latestVersion), '1')
    setDismissed(true)
  }

  return (
    <div className="flex items-center gap-3 bg-blue-950/60 border border-blue-700/40 rounded-xl px-4 py-2.5 mb-4">
      <Download size={16} className="text-blue-400 shrink-0" />
      <p className="text-sm text-blue-200 flex-1">{t('layout.updateBanner.text')}</p>
      <a
        href="https://ergania.com/ergania.apk"
        target="_blank"
        rel="noopener noreferrer"
        onClick={logApkDownload}
        className="text-xs font-semibold text-[var(--text-primary)] bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
      >
        {t('layout.updateBanner.cta', { version: latestVersion })}
      </a>
      <button onClick={dismiss} className="text-blue-600 hover:text-blue-300 transition-colors">
        <X size={14} />
      </button>
    </div>
  )
}
