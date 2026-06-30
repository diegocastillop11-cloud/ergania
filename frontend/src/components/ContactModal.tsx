import { useState, FormEvent } from 'react'
import { X, MessageSquare, Loader, CheckCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

const CATEGORIES = [
  'Consulta general',
  'Problema técnico',
  'Sugerencia',
  'Reclamo',
  'Felicitación',
  'Otro',
]

interface Props {
  onClose: () => void
}

export default function ContactModal({ onClose }: Props) {
  const { user } = useAuth()
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState(user?.email ?? '')
  const [category, setCategory] = useState('')
  const [message,  setMessage]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [sent,     setSent]     = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, category, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al enviar')
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Panel derecho */}
      <div className="relative w-full max-w-sm bg-gray-900 border-l border-gray-800 flex flex-col shadow-2xl animate-slide-in-right">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0">
              <MessageSquare size={16} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Contáctanos</h2>
              <p className="text-xs text-gray-500">Responderemos a la brevedad</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-5">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CheckCircle size={48} className="text-green-400" />
              <p className="text-white font-semibold text-base">¡Mensaje enviado!</p>
              <p className="text-sm text-gray-400">Lo revisaremos pronto y te responderemos por correo.</p>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Nombre */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Nombre</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Correo electrónico</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@correo.cl"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Categoría</label>
                <select
                  required
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecciona una opción</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Mensaje */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Mensaje</label>
                <textarea
                  required
                  rows={5}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Cuéntanos en qué podemos ayudarte..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 bg-red-950 border border-red-800 rounded-xl px-3 py-2.5 text-sm text-red-300">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors"
              >
                {loading
                  ? <><Loader size={14} className="animate-spin" /> Enviando...</>
                  : <><MessageSquare size={14} /> Enviar mensaje</>
                }
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
