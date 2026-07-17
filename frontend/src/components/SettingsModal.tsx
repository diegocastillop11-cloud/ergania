import { X, Settings, Sun, Moon } from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'
import { useTranslation, Language } from '../lib/i18n/LanguageContext'

interface Props {
  onClose: () => void
}

export default function SettingsModal({ onClose }: Props) {
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, t } = useTranslation()

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-[var(--bg-surface)] border-l border-[var(--border-default)] flex flex-col shadow-2xl animate-slide-in-right">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0">
              <Settings size={16} className="text-blue-400" />
            </div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('settingsModal.title')}</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Tema */}
          <div>
            <label className="text-xs text-[var(--text-tertiary)] mb-2 block">{t('settingsModal.theme')}</label>
            <div className="flex gap-2 bg-[var(--bg-surface-alt)] rounded-xl p-1">
              <button
                onClick={() => setTheme('dark')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                  theme === 'dark' ? 'bg-blue-600 text-[var(--text-primary)] shadow' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Moon size={14} /> {t('settingsModal.themeDark')}
              </button>
              <button
                onClick={() => setTheme('light')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                  theme === 'light' ? 'bg-blue-600 text-[var(--text-primary)] shadow' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Sun size={14} /> {t('settingsModal.themeLight')}
              </button>
            </div>
          </div>

          {/* Idioma */}
          <div>
            <label className="text-xs text-[var(--text-tertiary)] mb-2 block">{t('settingsModal.language')}</label>
            <div className="flex gap-2 bg-[var(--bg-surface-alt)] rounded-xl p-1">
              {(['es', 'en'] as Language[]).map(lang => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    language === lang ? 'bg-blue-600 text-[var(--text-primary)] shadow' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {lang === 'es' ? 'Español' : 'English'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
