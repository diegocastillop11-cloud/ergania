import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { Users, Crown, CreditCard, MessageSquare, TrendingUp, LogOut } from 'lucide-react'

const ADMIN_EMAIL = 'ergania.ai@gmail.com'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  trial:           { label: 'Trial',     color: 'text-blue-400'   },
  active:          { label: 'Activo',    color: 'text-green-400'  },
  expired:         { label: 'Expirado',  color: 'text-red-400'    },
  cancelled:       { label: 'Cancelado', color: 'text-gray-400'   },
  pending_payment: { label: 'Pendiente', color: 'text-yellow-400' },
}

interface Stats {
  totalUsers:      number
  statusCount:     Record<string, number>
  payments:        { userId: string; paymentId: string; amount: number; date: string }[]
  userList:        { id: string; email: string; createdAt: string; sub: any }[]
  contactMessages: { id: string; name: string; email: string; category: string; message: string; created_at: string }[]
}

export default function Admin() {
  const { user, session, signOut } = useAuth()
  const navigate  = useNavigate()
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<'users' | 'payments' | 'messages'>('users')

  useEffect(() => {
    if (!session) return
    if (user?.email !== ADMIN_EMAIL) { navigate('/dashboard'); return }

    fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [session, user])

  const handleLogout = async () => { await signOut(); navigate('/login') }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!stats) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-red-400">
      Error cargando datos
    </div>
  )

  const revenue = (stats.statusCount['active'] ?? 0) * 9990

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Ergania" className="w-8 h-8 rounded-lg object-contain" />
          <div>
            <h1 className="text-sm font-bold text-white">Ergania Admin</h1>
            <p className="text-xs text-gray-500">Panel de administración</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-gray-400 hover:text-red-400 transition-colors">
          <LogOut size={14} /> Cerrar sesión
        </button>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Users,      label: 'Usuarios totales', value: stats.totalUsers,                      color: 'text-blue-400',   bg: 'bg-blue-600/10'   },
            { icon: Crown,      label: 'Suscritos activos', value: stats.statusCount['active'] ?? 0,     color: 'text-green-400',  bg: 'bg-green-600/10'  },
            { icon: TrendingUp, label: 'Ingresos/mes',      value: `$${revenue.toLocaleString('es-CL')}`, color: 'text-orange-400', bg: 'bg-orange-600/10' },
            { icon: MessageSquare, label: 'Mensajes recibidos', value: stats.contactMessages.length,     color: 'text-purple-400', bg: 'bg-purple-600/10' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center mb-3`}>
                <Icon size={18} className={color} />
              </div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Estado suscripciones */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Estado de suscripciones</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(STATUS_LABEL).map(([key, { label, color }]) => (
              <div key={key} className="bg-gray-800 rounded-lg px-4 py-2 flex items-center gap-2">
                <span className={`text-lg font-bold ${color}`}>{stats.statusCount[key] ?? 0}</span>
                <span className="text-xs text-gray-400">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex border-b border-gray-800">
            {([
              { key: 'users',    label: 'Usuarios',          icon: Users        },
              { key: 'payments', label: 'Pagos',             icon: CreditCard   },
              { key: 'messages', label: 'Mensajes contacto', icon: MessageSquare },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                  tab === key
                    ? 'border-blue-500 text-blue-400 bg-blue-600/5'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">

            {/* Tabla usuarios */}
            {tab === 'users' && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                    <th className="text-left px-5 py-3">Email</th>
                    <th className="text-left px-5 py-3">Registro</th>
                    <th className="text-left px-5 py-3">Suscripción</th>
                    <th className="text-left px-5 py-3">Vence</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.userList.map(u => {
                    const s = STATUS_LABEL[u.sub?.status] ?? { label: '—', color: 'text-gray-600' }
                    return (
                      <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="px-5 py-3 text-white font-medium">{u.email}</td>
                        <td className="px-5 py-3 text-gray-400">{new Date(u.createdAt).toLocaleDateString('es-CL')}</td>
                        <td className="px-5 py-3"><span className={`font-semibold ${s.color}`}>{s.label}</span></td>
                        <td className="px-5 py-3 text-gray-400">
                          {u.sub?.current_period_end ? new Date(u.sub.current_period_end).toLocaleDateString('es-CL') : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {/* Tabla pagos */}
            {tab === 'payments' && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                    <th className="text-left px-5 py-3">Fecha</th>
                    <th className="text-left px-5 py-3">Monto</th>
                    <th className="text-left px-5 py-3">Payment ID</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.payments.length === 0 && (
                    <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-600">Sin pagos registrados aún</td></tr>
                  )}
                  {stats.payments.map(p => (
                    <tr key={p.paymentId} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-3 text-gray-400">{new Date(p.date).toLocaleDateString('es-CL')}</td>
                      <td className="px-5 py-3 text-green-400 font-bold">${p.amount.toLocaleString('es-CL')} CLP</td>
                      <td className="px-5 py-3 text-gray-500 font-mono text-xs">{p.paymentId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Mensajes de contacto */}
            {tab === 'messages' && (
              <div className="divide-y divide-gray-800">
                {stats.contactMessages.length === 0 && (
                  <p className="px-5 py-8 text-center text-gray-600">Sin mensajes de contacto aún</p>
                )}
                {stats.contactMessages.map(m => (
                  <div key={m.id} className="px-5 py-4 hover:bg-gray-800/30 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{m.name}</span>
                        <span className="text-gray-500 text-xs">{m.email}</span>
                        <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full">{m.category}</span>
                      </div>
                      <span className="text-xs text-gray-600">{new Date(m.created_at).toLocaleDateString('es-CL')}</span>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">{m.message}</p>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
