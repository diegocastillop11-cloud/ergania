import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Inbox, List, Globe, UserCircle,
  Radio, Send, Target, LogOut, Crown, X, MessageSquare, Settings,
} from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import type { SubscriptionState } from '../../hooks/useSubscription'
import ContactModal from '../ContactModal'
import SettingsModal from '../SettingsModal'
import PerfilSwitcher from '../careers/PerfilSwitcher'
import { useTranslation } from '../../lib/i18n/LanguageContext'

const nav = [
  { to: '/dashboard',     icon: LayoutDashboard, key: 'dashboard' },
  { to: '/profile',       icon: UserCircle,      key: 'profile' },
  { to: '/portals',       icon: Globe,           key: 'portals' },
  { to: '/busqueda',      icon: Target,          key: 'busqueda' },
  { to: '/scanner',       icon: Radio,           key: 'scanner' },
  { to: '/pipeline',      icon: Inbox,           key: 'pipeline' },
  { to: '/postulaciones', icon: Send,            key: 'postulaciones' },
  { to: '/tracker',       icon: List,            key: 'tracker' },
  { to: '/subscription',  icon: Crown,           key: 'subscription' },
] as const

interface Props { sub: SubscriptionState; onClose?: () => void }

export default function Sidebar({ sub, onClose }: Props) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [showContact,   setShowContact]   = useState(false)
  const [showSettings,  setShowSettings]  = useState(false)

  const handleCheckout = async () => {
    setCheckoutError(null)
    try {
      await sub.openCheckout()
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : 'Error al conectar con MercadoPago')
    }
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  // Iniciales del email para el avatar
  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : '?'

  return (
    <aside className="w-full lg:w-56 bg-[var(--bg-surface)] border-r border-[var(--border-default)] flex flex-col shrink-0 h-full">
      {/* Logo */}
      <div className="p-5 border-b border-[var(--border-default)]">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Ergania" className="w-8 h-8 rounded-lg object-contain shrink-0" />
          <div className="flex-1">
            <h1 className="text-sm font-bold text-[var(--text-primary)] leading-none">Ergania</h1>
            <p className="text-xs text-[var(--text-muted)] leading-none mt-0.5">{t('sidebar.tagline')}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1"
              aria-label="Cerrar menú"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <PerfilSwitcher />

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, icon: Icon, key }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-[var(--text-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]'
              }`
            }
          >
            <Icon size={16} />
            <span className="flex-1">{t(`sidebar.nav.${key}`)}</span>
          </NavLink>
        ))}

        <div className="pt-1 mt-1 border-t border-[var(--border-default)]">
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]"
          >
            <Settings size={16} />
            <span className="flex-1 text-left">{t('sidebar.settings')}</span>
          </button>
          <button
            onClick={() => setShowContact(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]"
          >
            <MessageSquare size={16} />
            <span className="flex-1 text-left">{t('sidebar.contact')}</span>
          </button>
        </div>
      </nav>

      {/* Subscription CTA — siempre visible cuando no está suscrito */}
      {!sub.loading && !sub.isActive && (
        <div className="px-3 pb-2 flex flex-col gap-1">
          <button
            onClick={handleCheckout}
            className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-[var(--text-primary)] text-xs font-bold py-2.5 rounded-lg transition-colors"
          >
            <Crown size={13} />
            {t('sidebar.subscribe')}
          </button>
          {checkoutError && <p className="text-[11px] text-red-400 text-center leading-tight">{checkoutError}</p>}
        </div>
      )}
      {!sub.loading && sub.status === 'trial' && (
        <div className="px-3 pb-2 flex flex-col gap-1">
          <button
            onClick={handleCheckout}
            className="w-full flex items-center justify-center gap-2 border border-blue-700 text-blue-400 hover:bg-blue-950 text-xs font-semibold py-2 rounded-lg transition-colors"
          >
            <Crown size={12} />
            {t('sidebar.trialSubscribe', { days: sub.daysLeft ?? 0 })}
          </button>
          {checkoutError && <p className="text-[11px] text-red-400 text-center leading-tight">{checkoutError}</p>}
        </div>
      )}

      {/* User footer */}
      {user && (
        <div className="p-3 border-t border-[var(--border-default)]">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold text-[var(--text-primary)] shrink-0">
              {initials}
            </div>
            {/* Email */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--text-secondary)] truncate">{user.email}</p>
            </div>
            {/* Logout */}
            <button
              onClick={handleLogout}
              title={t('sidebar.logout')}
              className="text-[var(--text-faint)] hover:text-red-400 transition-colors shrink-0"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      )}

      {showContact && <ContactModal onClose={() => setShowContact(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </aside>
  )
}
