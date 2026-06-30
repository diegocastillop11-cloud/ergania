import { useState, useEffect } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import ApiKeySettingsModal from '../careers/ApiKeySettingsModal'
import SubscriptionBanner from '../subscription/SubscriptionBanner'
import { useSubscription } from '../../hooks/useSubscription'

export default function Layout() {
  const [showApiModal, setShowApiModal] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const sub = useSubscription()
  const location = useLocation()

  // Cerrar sidebar al navegar en mobile
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const isSubscriptionPage = location.pathname === '/subscription'
  const blocked = !sub.loading && !sub.isActive && !isSubscriptionPage

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — drawer en mobile, fijo en desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-30 transition-transform duration-200 ease-in-out
        lg:relative lg:translate-x-0 lg:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar sub={sub} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Contenido principal */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Header mobile */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900 lg:hidden shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
          <img src="/logo.png" alt="Ergania" className="w-6 h-6 rounded-md object-contain" />
          <span className="text-sm font-semibold text-white">Ergania</span>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6">
          {blocked
            ? <Navigate to="/subscription" replace />
            : <>
                <SubscriptionBanner sub={sub} />
                <Outlet />
              </>
          }
        </main>
      </div>

      {showApiModal && <ApiKeySettingsModal onClose={() => setShowApiModal(false)} />}
    </div>
  )
}
