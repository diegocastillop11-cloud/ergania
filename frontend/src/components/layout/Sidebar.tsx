import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Inbox, List, Globe, UserCircle,
  Radio, Send, Target, LogOut, Crown, X, MessageSquare,
} from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import type { SubscriptionState } from '../../hooks/useSubscription'
import ContactModal from '../ContactModal'

const nav = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/profile',       icon: UserCircle,      label: 'Perfil & CV' },
  { to: '/busqueda',      icon: Target,          label: 'Mi Búsqueda' },
  { to: '/scanner',       icon: Radio,           label: 'Escáner' },
  { to: '/pipeline',      icon: Inbox,           label: 'Evaluar Oferta' },
  { to: '/postulaciones', icon: Send,            label: 'Postulaciones' },
  { to: '/tracker',       icon: List,            label: 'Tracker' },
  { to: '/portals',       icon: Globe,           label: 'Portales' },
  { to: '/subscription',  icon: Crown,           label: 'Suscripción' },
]

interface Props { sub: SubscriptionState; onClose?: () => void }

export default function Sidebar({ sub, onClose }: Props) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [showContact,   setShowContact]   = useState(false)

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
    <aside className="w-full lg:w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 h-full">
      {/* Logo */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Ergania" className="w-8 h-8 rounded-lg object-contain shrink-0" />
          <div className="flex-1">
            <h1 className="text-sm font-bold text-white leading-none">Ergania</h1>
            <p className="text-xs text-gray-500 leading-none mt-0.5">Búsqueda con IA · Chile</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden text-gray-500 hover:text-white transition-colors p-1"
              aria-label="Cerrar menú"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            <Icon size={16} />
            <span className="flex-1">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Subscription CTA — siempre visible cuando no está suscrito */}
      {!sub.loading && !sub.isActive && (
        <div className="px-3 pb-2 flex flex-col gap-1">
          <button
            onClick={handleCheckout}
            className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold py-2.5 rounded-lg transition-colors"
          >
            <Crown size={13} />
            Suscribirse — $9.990/mes
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
            {sub.daysLeft}d gratis · Suscribirse
          </button>
          {checkoutError && <p className="text-[11px] text-red-400 text-center leading-tight">{checkoutError}</p>}
        </div>
      )}

      {/* User footer */}
      {user && (
        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {initials}
            </div>
            {/* Email */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-300 truncate">{user.email}</p>
            </div>
            {/* Contacto */}
            <button
              onClick={() => setShowContact(true)}
              title="Contacto"
              className="text-gray-600 hover:text-blue-400 transition-colors shrink-0"
            >
              <MessageSquare size={14} />
            </button>
            {/* Logout */}
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      )}

      {showContact && <ContactModal onClose={() => setShowContact(false)} />}
    </aside>
  )
}
