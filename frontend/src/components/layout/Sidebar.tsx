import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Inbox, List, Globe, UserCircle,
  Briefcase, Radio, Send, Target, LogOut, Crown,
} from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import type { SubscriptionState } from '../../hooks/useSubscription'

const nav = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/profile',       icon: UserCircle,      label: 'Perfil & CV' },
  { to: '/busqueda',      icon: Target,          label: 'Mi Búsqueda' },
  { to: '/scanner',       icon: Radio,           label: 'Escáner' },
  { to: '/pipeline',      icon: Inbox,           label: 'Evaluar Oferta' },
  { to: '/postulaciones', icon: Send,            label: 'Postulaciones' },
  { to: '/tracker',       icon: List,            label: 'Tracker' },
  { to: '/portals',       icon: Globe,           label: 'Portales Chile' },
  { to: '/subscription',  icon: Crown,           label: 'Suscripción' },
]

interface Props { sub: SubscriptionState }

export default function Sidebar({ sub }: Props) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

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
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
            <Briefcase size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">Ergania</h1>
            <p className="text-xs text-gray-500 leading-none mt-0.5">Búsqueda con IA · Chile</p>
          </div>
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
    </aside>
  )
}
