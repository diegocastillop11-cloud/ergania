import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Loader2, Plus, X, Pencil } from 'lucide-react'
import { api } from '../../lib/api'

interface Perfil {
  id: string
  nombre: string
  isActive: boolean
}

export default function PerfilTabs() {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { data, isLoading, isError, refetch } = useQuery<{ perfiles: Perfil[] }>({
    queryKey: ['perfiles'],
    queryFn: () => api.get('/perfiles').then(r => r.data),
  })
  const perfiles = data?.perfiles || []

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['perfiles'] })
    qc.invalidateQueries({ queryKey: ['careers-profile'] })
    qc.invalidateQueries({ queryKey: ['careers-cv'] })
    qc.invalidateQueries({ queryKey: ['portals'] })
    qc.invalidateQueries({ queryKey: ['profile'] })
    qc.invalidateQueries({ queryKey: ['careers-pipeline'] })
  }

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await fn()
      refreshAll()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al actualizar perfiles')
    } finally {
      setBusy(false)
    }
  }

  const activate = (p: Perfil) => {
    if (p.isActive) return
    run(() => api.post(`/perfiles/${p.id}/activate`))
  }

  const create = () => {
    const nombre = window.prompt('Nombre del nuevo perfil (ej: "Contador", "Abogado"):')
    if (!nombre?.trim()) return
    run(() => api.post('/perfiles', { nombre: nombre.trim() }))
  }

  const rename = (p: Perfil) => {
    const nombre = window.prompt('Nuevo nombre del perfil:', p.nombre)
    if (!nombre?.trim() || nombre.trim() === p.nombre) return
    run(() => api.patch(`/perfiles/${p.id}`, { nombre: nombre.trim() }))
  }

  const remove = (p: Perfil) => {
    if (!window.confirm(`¿Eliminar el perfil "${p.nombre}"? Se borrarán sus datos, su CV y su configuración de búsqueda. Esta acción no se puede deshacer.`)) return
    run(() => api.delete(`/perfiles/${p.id}`))
  }

  if (isLoading) return null

  if (isError) {
    return (
      <div className="flex items-center gap-3 p-3 bg-amber-900/20 border border-amber-800/50 rounded-xl text-amber-300 text-sm">
        <AlertCircle size={16} className="shrink-0" />
        <span>No se pudieron cargar tus perfiles. Tu perfil Principal sigue intacto — reintenta en unos segundos.</span>
        <button
          onClick={() => refetch()}
          className="ml-auto px-3 py-1 bg-amber-800/50 hover:bg-amber-800 rounded-lg text-xs font-medium shrink-0"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {perfiles.map(p => (
          <div
            key={p.id}
            className={`flex items-center rounded-t-lg border border-b-0 text-sm transition-colors ${
              p.isActive
                ? 'bg-gray-800 border-gray-700 text-white'
                : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white cursor-pointer'
            }`}
          >
            <button
              onClick={() => activate(p)}
              disabled={busy}
              className="px-3.5 py-2 font-medium disabled:opacity-60"
              title={p.isActive ? 'Perfil activo' : `Cambiar al perfil ${p.nombre}`}
            >
              {p.nombre}
            </button>
            {p.isActive && (
              <div className="flex items-center gap-0.5 pr-2">
                <button onClick={() => rename(p)} disabled={busy} className="p-1 text-gray-500 hover:text-white" title="Renombrar perfil">
                  <Pencil size={12} />
                </button>
                {perfiles.length > 1 && (
                  <button onClick={() => remove(p)} disabled={busy} className="p-1 text-gray-500 hover:text-red-400" title="Eliminar perfil">
                    <X size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        <button
          onClick={create}
          disabled={busy}
          className="flex items-center gap-1 px-3 py-2 text-sm text-gray-400 hover:text-white border border-dashed border-gray-700 rounded-t-lg disabled:opacity-60"
          title="Crear nuevo perfil (ej: otro rubro profesional)"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Nuevo perfil
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}
