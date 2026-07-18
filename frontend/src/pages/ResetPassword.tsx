import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Lock, Loader, AlertCircle, Eye, EyeOff, KeyRound } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useTranslation } from '../lib/i18n/LanguageContext'

type Status = 'verifying' | 'ready' | 'expired' | 'done'

export default function ResetPassword() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [status,   setStatus]   = useState<Status>('verifying')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    let settled = false

    // El link del correo trae el token de recuperación en el hash de la URL.
    // Supabase lo procesa al cargar el cliente y dispara PASSWORD_RECOVERY.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        settled = true
        setStatus('ready')
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (!settled && data.session) {
        settled = true
        setStatus('ready')
      }
    })

    const timeout = setTimeout(() => {
      if (!settled) setStatus('expired')
    }, 5000)

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) return setError(t('login.passwordMismatch'))
    if (password.length < 6)  return setError(t('login.passwordTooShort'))

    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)

    if (error) setError(error)
    else {
      setStatus('done')
      setTimeout(() => navigate('/dashboard'), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Ergania" className="w-14 h-14 rounded-2xl mb-4 shadow-lg object-contain" />
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('resetPassword.title')}</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">{t('resetPassword.tagline')}</p>
        </div>

        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-6 shadow-xl">

          {status === 'verifying' && (
            <div className="flex items-center justify-center gap-2 py-6 text-[var(--text-muted)] text-sm">
              <Loader size={16} className="animate-spin" /> {t('resetPassword.verifying')}
            </div>
          )}

          {status === 'expired' && (
            <div className="text-center py-2">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{t('resetPassword.expiredTitle')}</p>
              <p className="text-sm text-[var(--text-muted)] mt-2">{t('resetPassword.expiredHint')}</p>
              <Link to="/login" className="inline-block mt-4 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                {t('resetPassword.backToLogin')}
              </Link>
            </div>
          )}

          {status === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-[var(--text-tertiary)] mb-1.5 block">{t('resetPassword.newPassword')}</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={t('login.passwordPlaceholder')}
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl pl-9 pr-10 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-[var(--text-tertiary)] mb-1.5 block">{t('login.confirmPassword')}</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder={t('login.confirmPasswordPlaceholder')}
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-950 border border-red-800 rounded-xl px-3 py-2.5 text-sm text-red-300">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-[var(--text-primary)] rounded-xl text-sm font-semibold transition-colors"
              >
                {loading
                  ? <><Loader size={14} className="animate-spin" /> {t('login.processing')}</>
                  : <><KeyRound size={14} /> {t('resetPassword.submit')}</>
                }
              </button>
            </form>
          )}

          {status === 'done' && (
            <div className="bg-green-950 border border-green-800 rounded-xl px-3 py-2.5 text-sm text-green-300 text-center">
              {t('resetPassword.successInfo')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
