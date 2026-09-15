import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, X, Send, Crown } from 'lucide-react'
import { useAiChat } from '../../hooks/useAiChat'
import type { ChatMessage } from '../../lib/chatApi'

function Bubble({ msg, onConfirm, onCancel, busy }: {
  msg: ChatMessage
  onConfirm: (id: string) => void
  onCancel: (id: string) => void
  busy: boolean
}) {
  const isUser = msg.sender === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
        isUser
          ? 'bg-blue-600 text-white rounded-br-sm'
          : 'bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-bl-sm'
      }`}>
        <p className="whitespace-pre-wrap">{msg.body}</p>
        {msg.pending_action && (
          <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-[var(--border-default)]/60">
            <button
              onClick={() => onConfirm(msg.id)}
              disabled={busy}
              className="text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Confirmar
            </button>
            <button
              onClick={() => onCancel(msg.id)}
              disabled={busy}
              className="text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] px-3 py-1.5 transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AiChatWidget() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const navigate = useNavigate()
  const { messages, usage, loading, error, send, confirm, cancel } = useAiChat()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim() || loading) return
    send(draft)
    setDraft('')
  }

  const blocked = usage?.trial && usage.consultasUsed >= usage.consultasLimit

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open && (
        <div className="mb-3 w-[min(92vw,380px)] h-[min(70vh,560px)] flex flex-col bg-[var(--bg-app)] border border-[var(--border-default)] rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
            <div className="flex items-center gap-2">
              <MessageCircle size={16} className="text-blue-400" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">Asistente Ergania</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
              <X size={16} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {messages.length === 0 && (
              <p className="text-xs text-[var(--text-tertiary)] text-center mt-6">
                Pídeme que evalúe una oferta, prepare una postulación, o pregúntame cómo usar Ergania.
              </p>
            )}
            {messages.map(m => (
              <Bubble key={m.id} msg={m} onConfirm={confirm} onCancel={cancel} busy={loading} />
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] animate-bounce" />
                  </span>
                </div>
              </div>
            )}
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
          </div>

          {(usage?.showUpgradeCta || blocked) && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-950/60 border-t border-amber-700/40">
              <Crown size={14} className="text-amber-400 shrink-0" />
              <p className="text-xs text-amber-200 flex-1">
                {blocked
                  ? 'Llegaste al límite de consultas de la versión gratuita.'
                  : 'Te quedan pocas consultas gratis.'}
              </p>
              <button
                onClick={() => navigate('/subscription')}
                className="text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
              >
                Pagar ahora
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 border-t border-[var(--border-default)] bg-[var(--bg-surface)]">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              disabled={loading || !!blocked}
              placeholder={blocked ? 'Suscríbete para seguir chateando' : 'Escribe tu mensaje...'}
              className="flex-1 bg-[var(--bg-app)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !draft.trim() || !!blocked}
              className="shrink-0 w-9 h-9 flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg transition-colors"
              aria-label="Enviar"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xl flex items-center justify-center transition-colors"
        aria-label="Abrir asistente de Ergania"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  )
}
