import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { X, Settings, Sun, Moon, AlertTriangle, Loader2 } from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'
import { useTranslation, Language } from '../lib/i18n/LanguageContext'
import { useAuth } from '../lib/AuthContext'
import { deleteAccount } from '../lib/subscriptionApi'

const DELETE_CONFIRM_WORD = 'ELIMINAR'

interface Props {
  onClose: () => void
}

export default function SettingsModal({ onClose }: Props) {
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, t } = useTranslation()
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const [showDelete, setShowDelete] = useState(false)
  const [reason, setReason]         = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting]     = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleDelete = async () => {
    setDeleteError('')
    if (!reason.trim()) { setDeleteError(t('settingsModal.deleteAccountReasonRequired')); return }
    if (confirmText !== DELETE_CONFIRM_WORD) { setDeleteError(t('settingsModal.deleteAccountConfirmRequired')); return }
    setDeleting(true)
    try {
      await deleteAccount(reason.trim())
      await signOut()
      navigate('/')
    } catch {
      setDeleteError(t('settingsModal.deleteAccountError'))
      setDeleting(false)
    }
  }

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

          {/* Zona de peligro */}
          <div className="border-t border-[var(--border-default)] pt-5">
            <label className="text-xs text-red-400 mb-2 flex items-center gap-1.5 font-medium">
              <AlertTriangle size={13} /> {t('settingsModal.dangerZone')}
            </label>

            {!showDelete ? (
              <button
                onClick={() => setShowDelete(true)}
                className="w-full py-2 rounded-lg text-sm font-medium border border-red-900/50 text-red-400 hover:bg-red-950/30 transition-colors"
              >
                {t('settingsModal.deleteAccount')}
              </button>
            ) : (
              <div className="space-y-3 bg-red-950/10 border border-red-900/40 rounded-xl p-4">
                <p className="text-xs text-[var(--text-tertiary)]">{t('settingsModal.deleteAccountDesc')}</p>

                <p className="text-xs text-[var(--text-tertiary)]">
                  {t('settingsModal.deleteAccountPrivacyLinkPre')}{' '}
                  <Link to="/privacidad" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                    {t('settingsModal.deleteAccountPrivacyLinkText')}
                  </Link>
                </p>

                <div>
                  <label className="text-xs text-[var(--text-tertiary)] mb-1.5 block">
                    {t('settingsModal.deleteAccountReasonLabel')}
                  </label>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder={t('settingsModal.deleteAccountReasonPlaceholder')}
                    rows={3}
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border-alt)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-red-500 resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-[var(--text-tertiary)] mb-1.5 block">
                    {t('settingsModal.deleteAccountConfirmLabel')}
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value)}
                    placeholder={DELETE_CONFIRM_WORD}
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border-alt)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-red-500 font-mono"
                  />
                </div>

                {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}

                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white transition-colors"
                  >
                    {deleting
                      ? <><Loader2 size={13} className="animate-spin" /> {t('settingsModal.deleteAccountDeleting')}</>
                      : t('settingsModal.deleteAccountButton')}
                  </button>
                  <button
                    onClick={() => { setShowDelete(false); setReason(''); setConfirmText(''); setDeleteError('') }}
                    disabled={deleting}
                    className="px-3 py-2 rounded-lg text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {t('settingsModal.deleteAccountCancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
