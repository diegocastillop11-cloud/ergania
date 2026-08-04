import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { useTranslation } from '../../lib/i18n/LanguageContext'

interface Props {
  children: React.ReactNode
}

// Solo aplica a cuentas creadas desde que existe esta funcionalidad — usuarios
// de antes de esa fecha quedan afuera del gate para no interrumpir su uso
// normal de la app (no dan un consentimiento explícito retroactivo, pero
// tampoco se les bloquea el acceso). Cubre registro por formulario (ya pide
// el checkbox ahí mismo, esto solo actúa de red por si el flujo de
// confirmación de correo lo salteó) y por Google OAuth, donde no hay paso de
// formulario previo al redirect para poner un checkbox.
const TERMS_GATE_LAUNCH = new Date('2026-08-04T00:00:00Z')

export default function TermsGate({ children }: Props) {
  const { user, acceptTerms } = useAuth()
  const { t } = useTranslation()
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [justAccepted, setJustAccepted] = useState(false)

  const isNewAccount = !!user?.created_at && new Date(user.created_at) >= TERMS_GATE_LAUNCH
  const alreadyAccepted = !!user?.user_metadata?.terms_accepted_at

  if (!user || !isNewAccount || alreadyAccepted || justAccepted) return <>{children}</>

  const handleContinue = async () => {
    setLoading(true)
    setError('')
    const { error } = await acceptTerms()
    if (error) { setError(error); setLoading(false) }
    else setJustAccepted(true)
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">{t('termsGate.title')}</h2>
        <p className="text-sm text-[var(--text-muted)] mb-4">{t('termsGate.description')}</p>

        <label className="flex items-start gap-2.5 text-sm text-[var(--text-tertiary)] leading-relaxed cursor-pointer select-none mb-4">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 shrink-0"
          />
          <span>
            {t('termsGate.checkboxPrefix')}{' '}
            <Link to="/terminos" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-semibold">
              {t('termsGate.termsLink')}
            </Link>{' '}
            {t('termsGate.checkboxMiddle')}{' '}
            <Link to="/privacidad" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-semibold">
              {t('termsGate.privacyLink')}
            </Link>.
          </span>
        </label>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        <button
          onClick={handleContinue}
          disabled={!checked || loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-[var(--text-primary)] rounded-xl text-sm font-semibold transition-colors"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {t('termsGate.continueButton')}
        </button>
      </div>
    </div>
  )
}
