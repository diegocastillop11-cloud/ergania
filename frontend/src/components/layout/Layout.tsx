import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import ApiKeySettingsModal from '../careers/ApiKeySettingsModal'
import { loadApiKeys } from '../../lib/userApiKeys'
import { Key } from 'lucide-react'

export default function Layout() {
  const [showApiModal, setShowApiModal] = useState(false)
  const [hasKeys, setHasKeys] = useState(true)

  useEffect(() => {
    const keys = loadApiKeys()
    const anyKey = Object.values(keys).some(v => v && v.trim())
    if (!anyKey) {
      setHasKeys(false)
      setShowApiModal(true)
    }
  }, [])

  function handleModalClose() {
    const keys = loadApiKeys()
    const anyKey = Object.values(keys).some(v => v && v.trim())
    setHasKeys(anyKey)
    setShowApiModal(false)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        {!hasKeys && !showApiModal && (
          <div className="mb-4 flex items-center gap-3 bg-yellow-950/60 border border-yellow-700/50 rounded-xl px-4 py-3">
            <Key size={16} className="text-yellow-400 shrink-0" />
            <p className="text-sm text-yellow-300 flex-1">
              Necesitás configurar tu API key para usar las funciones de IA.
            </p>
            <button
              onClick={() => setShowApiModal(true)}
              className="text-sm font-semibold text-yellow-300 hover:text-white border border-yellow-600 px-3 py-1 rounded-lg transition-colors"
            >
              Configurar
            </button>
          </div>
        )}
        <Outlet />
      </main>
      {showApiModal && <ApiKeySettingsModal onClose={handleModalClose} />}
    </div>
  )
}
