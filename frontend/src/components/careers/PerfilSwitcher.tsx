import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, UserCircle2 } from 'lucide-react'
import { api } from '../../lib/api'

interface Perfil {
  id: string
  nombre: string
  isActive: boolean
}

export default function PerfilSwitcher() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const { data } = useQuery<{ perfiles: Perfil[] }>({
    queryKey: ['perfiles'],
    queryFn: () => api.get('/perfiles').then(r => r.data),
  })
  const perfiles = data?.perfiles || []
  const active = perfiles.find(p => p.isActive)

  // Con un solo perfil no hay nada que cambiar — no mostrar el selector
  if (perfiles.length <= 1) return null

  const switchTo = async (p: Perfil) => {
    if (p.isActive || busy) return
    setBusy(true)
    setOpen(false)
    try {
      await api.post(`/perfiles/${p.id}/activate`)
      qc.invalidateQueries({ queryKey: ['perfiles'] })
      qc.invalidateQueries({ queryKey: ['careers-profile'] })
      qc.invalidateQueries({ queryKey: ['careers-cv'] })
      qc.invalidateQueries({ queryKey: ['portals'] })
      qc.invalidateQueries({ queryKey: ['careers-portals'] })
      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: ['careers-pipeline'] })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative px-3 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        className="w-full flex items-center gap-2 px-2.5 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-white disabled:opacity-60 transition-colors"
        title="Cambiar perfil activo"
      >
        <UserCircle2 size={14} className="text-blue-400 shrink-0" />
        <span className="flex-1 text-left truncate font-medium">{active?.nombre || 'Perfil'}</span>
        <ChevronDown size={13} className="text-gray-500 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-3 right-3 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden">
            {perfiles.map(p => (
              <button
                key={p.id}
                onClick={() => switchTo(p)}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                  p.isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                {p.nombre}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
