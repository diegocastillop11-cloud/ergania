import { useState, useEffect } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import ApiKeySettingsModal from '../careers/ApiKeySettingsModal'
import SubscriptionBanner from '../subscription/SubscriptionBanner'
import { useSubscription } from '../../hooks/useSubscription'

export default function Layout() {
  const [showApiModal, setShowApiModal] = useState(false)
  const sub = useSubscription()
  const location = useLocation()

  useEffect(() => {
    // No abrir el modal automáticamente — el servidor provee la key de IA
  }, [])

  function handleModalClose() {
    setShowApiModal(false)
  }

  // Bloquear acceso a todo excepto /subscription cuando no está activo
  const isSubscriptionPage = location.pathname === '/subscription'
  const blocked = !sub.loading && !sub.isActive && !isSubscriptionPage

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar sub={sub} />
      <main className="flex-1 overflow-y-auto p-6">
        {blocked
          ? <Navigate to="/subscription" replace />
          : <>
              <SubscriptionBanner sub={sub} />
              {/* Banner de API key oculto — servidor provee key de Claude */}
              <Outlet />
            </>
        }
      </main>
      {showApiModal && <ApiKeySettingsModal onClose={handleModalClose} />}
    </div>
  )
}
