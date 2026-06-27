import { api } from '../../lib/api'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Globe, Plus, Trash2, Save, ExternalLink, Flag,
  Loader2, Search, Check, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { PortalsConfig, Portal } from '../../types/careers'


// Portales chilenos preconfigurados
const CHILE_PORTALS: Omit<Portal, 'enabled'>[] = [
  {
    name: 'GetOnBoard Chile',
    careers_url: 'https://www.getonbrd.com/jobs',
    country: 'Chile',
  },
  {
    name: 'Laborum Chile',
    careers_url: 'https://www.laborum.cl',
    country: 'Chile',
  },
  {
    name: 'Trabajando Chile',
    careers_url: 'https://www.trabajando.cl',
    country: 'Chile',
  },
  {
    name: 'Bumeran Chile',
    careers_url: 'https://www.bumeran.cl',
    country: 'Chile',
  },
  {
    name: 'Computrabajo Chile',
    careers_url: 'https://cl.computrabajo.com',
    country: 'Chile',
  },
  {
    name: 'Indeed Chile',
    careers_url: 'https://cl.indeed.com',
    country: 'Chile',
  },
  {
    name: 'LinkedIn Jobs Chile',
    careers_url: 'https://www.linkedin.com/jobs/search/?location=Chile',
    country: 'Chile',
  },
  {
    name: 'YWork Chile',
    careers_url: 'https://www.yw.cl',
    country: 'Chile',
  },
]

function PortalCard({
  portal,
  onToggle,
  onDelete,
}: {
  portal: Portal
  onToggle: () => void
  onDelete: () => void
}) {
  const isChile = portal.country === 'Chile'
  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
      portal.enabled
        ? 'bg-gray-800/50 border-gray-700'
        : 'bg-gray-900/30 border-gray-800 opacity-60'
    }`}>
      <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
        {isChile ? (
          <Flag size={16} className="text-red-400" />
        ) : (
          <Globe size={16} className="text-blue-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-medium truncate">{portal.name}</p>
          {isChile && (
            <span className="text-xs bg-red-900/30 text-red-400 border border-red-800/50 px-1.5 py-0.5 rounded">
              Chile
            </span>
          )}
          {portal.api && (
            <span className="text-xs bg-green-900/30 text-green-400 border border-green-800/50 px-1.5 py-0.5 rounded">
              API
            </span>
          )}
        </div>
        <a
          href={portal.careers_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-blue-400 transition-colors flex items-center gap-1 truncate"
        >
          <ExternalLink size={10} />
          {portal.careers_url}
        </a>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onToggle}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            portal.enabled ? 'bg-blue-600' : 'bg-gray-700'
          }`}
        >
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
            portal.enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-600 hover:text-red-400 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

export default function CareersPortals() {
  const qc = useQueryClient()
  const [newPortal, setNewPortal] = useState({ name: '', careers_url: '', country: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [saved, setSaved] = useState(false)
  const [filterCountry, setFilterCountry] = useState<'all' | 'Chile' | 'other'>('all')

  const { data: config, isLoading } = useQuery<PortalsConfig>({
    queryKey: ['careers-portals'],
    queryFn: () => api.get('/portals').then(r => r.data),
  })

  const saveMut = useMutation({
    mutationFn: (data: PortalsConfig) => api.put('/portals', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['careers-portals'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-blue-400" />
      </div>
    )
  }

  const companies = config.tracked_companies || []

  const togglePortal = (idx: number) => {
    const updated = [...companies]
    updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled }
    saveMut.mutate({ ...config, tracked_companies: updated })
  }

  const deletePortal = (idx: number) => {
    const updated = companies.filter((_, i) => i !== idx)
    saveMut.mutate({ ...config, tracked_companies: updated })
  }

  const addChilePortal = (portal: Omit<Portal, 'enabled'>) => {
    if (companies.some(c => c.careers_url === portal.careers_url)) return
    const updated = [...companies, { ...portal, enabled: true }]
    saveMut.mutate({ ...config, tracked_companies: updated })
  }

  const addCustomPortal = () => {
    if (!newPortal.name || !newPortal.careers_url) return
    const updated = [...companies, { ...newPortal, enabled: true }]
    saveMut.mutate({ ...config, tracked_companies: updated })
    setNewPortal({ name: '', careers_url: '', country: '' })
    setShowAdd(false)
  }

  const filtered = companies.filter(c => {
    if (filterCountry === 'Chile') return c.country === 'Chile'
    if (filterCountry === 'other') return c.country !== 'Chile'
    return true
  })

  const chileCount   = companies.filter(c => c.country === 'Chile').length
  const enabledCount = companies.filter(c => c.enabled).length

  const bulkToggle = (mode: 'all-on' | 'all-off' | 'chile-only') => {
    const updated = companies.map(c => ({
      ...c,
      enabled: mode === 'all-on' ? true
              : mode === 'all-off' ? false
              : c.country === 'Chile',
    }))
    saveMut.mutate({ ...config, tracked_companies: updated })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Portales de Empleo</h2>
          <p className="text-gray-400 mt-1">
            {enabledCount} activos de {companies.length} · {chileCount} portales chilenos
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {saved && (
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <Check size={14} /> Guardado
            </span>
          )}
          {saveMut.isPending && (
            <Loader2 size={16} className="animate-spin text-blue-400" />
          )}
          {/* Acciones masivas */}
          {companies.length > 0 && (
            <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
              <button
                onClick={() => bulkToggle('all-on')}
                disabled={saveMut.isPending}
                title="Activar todos"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-green-400 hover:bg-green-900/30 transition-colors disabled:opacity-40"
              >
                <ToggleRight size={14} /> Todos
              </button>
              <button
                onClick={() => bulkToggle('chile-only')}
                disabled={saveMut.isPending}
                title="Activar solo portales de Chile"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-red-400 hover:bg-red-900/30 transition-colors disabled:opacity-40"
              >
                🇨🇱 Solo Chile
              </button>
              <button
                onClick={() => bulkToggle('all-off')}
                disabled={saveMut.isPending}
                title="Desactivar todos"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:bg-gray-700 transition-colors disabled:opacity-40"
              >
                <ToggleLeft size={14} /> Ninguno
              </button>
            </div>
          )}
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={15} />
            Agregar Portal
          </button>
        </div>
      </div>

      {/* Portales chilenos sugeridos */}
      <div className="bg-gradient-to-r from-red-950/30 to-gray-900 border border-red-900/30 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Flag size={16} className="text-red-400" />
          <h3 className="text-white font-semibold">Portales Chilenos Recomendados</h3>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          Haz click para agregar los principales portales de empleo en Chile. Se priorizarán roles híbridos y remotos.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CHILE_PORTALS.map(portal => {
            const alreadyAdded = companies.some(c => c.careers_url === portal.careers_url)
            return (
              <button
                key={portal.careers_url}
                onClick={() => !alreadyAdded && addChilePortal(portal)}
                disabled={alreadyAdded}
                className={`flex items-center justify-between gap-2 p-2.5 rounded-lg text-sm font-medium transition-all border ${
                  alreadyAdded
                    ? 'bg-green-900/20 border-green-800/40 text-green-400 cursor-default'
                    : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className="truncate">{portal.name.replace(' Chile', '')}</span>
                {alreadyAdded
                  ? <Check size={13} className="shrink-0" />
                  : <Plus size={13} className="shrink-0" />
                }
              </button>
            )
          })}
        </div>
      </div>

      {/* Add custom portal */}
      {showAdd && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Agregar Portal Personalizado</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              value={newPortal.name}
              onChange={e => setNewPortal(p => ({ ...p, name: e.target.value }))}
              placeholder="Nombre (ej: Empresa XYZ)"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <input
              value={newPortal.careers_url}
              onChange={e => setNewPortal(p => ({ ...p, careers_url: e.target.value }))}
              placeholder="URL de empleos (https://...)"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <input
              value={newPortal.country}
              onChange={e => setNewPortal(p => ({ ...p, country: e.target.value }))}
              placeholder="País (ej: Chile)"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={addCustomPortal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Save size={14} /> Agregar
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-gray-800 text-gray-400 hover:text-white rounded-lg text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'Chile', 'other'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterCountry(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterCountry === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {f === 'all' ? 'Todos' : f === 'Chile' ? '🇨🇱 Chile' : 'Internacional'}
          </button>
        ))}
      </div>

      {/* Portal list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
            <Globe size={32} className="mx-auto mb-3 text-gray-700" />
            <p>No hay portales en esta categoría.</p>
            <p className="text-sm mt-1">Agrega portales chilenos usando los botones de arriba.</p>
          </div>
        ) : (
          filtered.map((portal) => {
            const realIdx = companies.findIndex(c => c.careers_url === portal.careers_url)
            return (
              <PortalCard
                key={portal.careers_url}
                portal={portal}
                onToggle={() => togglePortal(realIdx)}
                onDelete={() => deletePortal(realIdx)}
              />
            )
          })
        )}
      </div>

      {/* Filtros de keywords */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Search size={16} className="text-blue-400" />
          Filtros de Búsqueda
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          Estas palabras clave determinan qué ofertas son relevantes. Solo se muestran ofertas que contienen al menos 1 positiva y ninguna negativa.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-green-400 font-medium uppercase tracking-wider mb-2 block">
              Keywords Positivas ({config.title_filter?.positive?.length ?? 0})
            </label>
            <div className="flex flex-wrap gap-1.5 p-3 bg-gray-800/50 rounded-lg min-h-[60px]">
              {(config.title_filter?.positive ?? []).slice(0, 20).map(kw => (
                <span key={kw} className="text-xs bg-green-900/30 text-green-400 border border-green-800/40 px-2 py-0.5 rounded-full">
                  {kw}
                </span>
              ))}
              {(config.title_filter?.positive?.length ?? 0) > 20 && (
                <span className="text-xs text-gray-500">+{(config.title_filter?.positive?.length ?? 0) - 20} más</span>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-red-400 font-medium uppercase tracking-wider mb-2 block">
              Keywords Excluidas ({config.title_filter?.negative?.length ?? 0})
            </label>
            <div className="flex flex-wrap gap-1.5 p-3 bg-gray-800/50 rounded-lg min-h-[60px]">
              {(config.title_filter?.negative ?? []).slice(0, 20).map(kw => (
                <span key={kw} className="text-xs bg-red-900/30 text-red-400 border border-red-800/40 px-2 py-0.5 rounded-full">
                  {kw}
                </span>
              ))}
              {(config.title_filter?.negative?.length ?? 0) > 20 && (
                <span className="text-xs text-gray-500">+{(config.title_filter?.negative?.length ?? 0) - 20} más</span>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-3">
          Para editar los filtros, modifica directamente el archivo <code className="text-gray-400">portals.yml</code> en career-ops.
        </p>
      </div>
    </div>
  )
}
