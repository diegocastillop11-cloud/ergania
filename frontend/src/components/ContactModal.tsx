import { useState, useEffect, useRef, FormEvent } from 'react'
import { X, MessageSquare, Loader, CheckCircle, AlertCircle, Send, Plus } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useTranslation } from '../lib/i18n/LanguageContext'

// Los value= se envían al backend en español — solo la etiqueta visible se traduce.
const CATEGORIES: Array<{ value: string; key: string }> = [
  { value: 'Consulta general',  key: 'general' },
  { value: 'Problema técnico',  key: 'technical' },
  { value: 'Sugerencia',        key: 'suggestion' },
  { value: 'Reclamo',           key: 'complaint' },
  { value: 'Felicitación',      key: 'compliment' },
  { value: 'Otro',              key: 'other' },
]

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
const POLL_MS = 8000

interface Thread {
  id: string; category: string; message: string; created_at: string
  replies: { id: string; sender: 'user' | 'admin'; body: string; created_at: string }[]
}

interface Props {
  onClose: () => void
}

export default function ContactModal({ onClose }: Props) {
  const { t } = useTranslation()
  const { user, session } = useAuth()
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState(user?.email ?? '')
  const [category, setCategory] = useState('')
  const [message,  setMessage]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [sent,     setSent]     = useState(false)

  // Chat en hilo — solo aplica a usuarios con sesión (ver CLAUDE.md: un visitante
  // anónimo no tiene identidad estable para reabrir un hilo más tarde).
  const [threads,      setThreads]      = useState<Thread[] | null>(null)
  const [showNewForm,  setShowNewForm]  = useState(false)
  const [chatDraft,    setChatDraft]    = useState('')
  const [chatSending,  setChatSending]  = useState(false)
  const [chatError,    setChatError]    = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const activeThread = threads && threads.length > 0 ? threads[0] : null

  const loadThreads = async () => {
    if (!session) return
    try {
      const res = await fetch(`${API_BASE}/api/contact/mine`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      setThreads(await res.json())
    } catch { /* silencioso — no bloquear el modal por un poll fallido */ }
  }

  useEffect(() => {
    if (!user || !session) return
    loadThreads()
    const interval = setInterval(loadThreads, POLL_MS)
    return () => clearInterval(interval)
  }, [user, session])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeThread?.replies.length])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ name, email, category, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('contactModal.genericError'))
      if (user && session) {
        setShowNewForm(false)
        setMessage('')
        setCategory('')
        await loadThreads()
      } else {
        setSent(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('contactModal.sendFailed'))
    } finally {
      setLoading(false)
    }
  }

  const sendChatMessage = async () => {
    if (!activeThread || !session || !chatDraft.trim()) return
    setChatSending(true)
    setChatError('')
    try {
      const res = await fetch(`${API_BASE}/api/contact/${activeThread.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ body: chatDraft.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('contactModal.sendFailed'))
      setChatDraft('')
      await loadThreads()
    } catch (err) {
      setChatError(err instanceof Error ? err.message : t('contactModal.sendFailed'))
    } finally {
      setChatSending(false)
    }
  }

  const showChat = !!(user && session && activeThread && !showNewForm)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Panel derecho */}
      <div className="relative w-full max-w-sm bg-[var(--bg-surface)] border-l border-[var(--border-default)] flex flex-col shadow-2xl animate-slide-in-right">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0">
              <MessageSquare size={16} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('contactModal.title')}</h2>
              <p className="text-xs text-[var(--text-muted)]">{t('contactModal.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {showChat && (
              <button
                onClick={() => setShowNewForm(true)}
                title={t('contactModal.newThread')}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1"
              >
                <Plus size={18} />
              </button>
            )}
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        {showChat && activeThread ? (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl px-3 py-2.5 text-xs text-[var(--text-tertiary)]">
                {activeThread.category}
              </div>
              <ChatBubble sender="user" body={activeThread.message} createdAt={activeThread.created_at} />
              {activeThread.replies.map(r => (
                <ChatBubble key={r.id} sender={r.sender} body={r.body} createdAt={r.created_at} />
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-[var(--border-default)] p-3 shrink-0">
              {chatError && (
                <div className="flex items-start gap-2 bg-red-950 border border-red-800 rounded-xl px-3 py-2 mb-2 text-xs text-red-300">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  {chatError}
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={chatDraft}
                  onChange={e => setChatDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage() }
                  }}
                  rows={2}
                  placeholder={t('contactModal.chatPlaceholder')}
                  className="flex-1 bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatDraft.trim() || chatSending}
                  className="shrink-0 p-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-[var(--text-primary)] rounded-xl transition-colors"
                >
                  {chatSending ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-5">
            {sent ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <CheckCircle size={48} className="text-green-400" />
                <p className="text-[var(--text-primary)] font-semibold text-base">{t('contactModal.sentTitle')}</p>
                <p className="text-sm text-[var(--text-tertiary)]">{t('contactModal.sentDesc')}</p>
                <button
                  onClick={onClose}
                  className="mt-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] text-sm font-medium rounded-xl transition-colors"
                >
                  {t('contactModal.close')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {user && session && activeThread && (
                  <button
                    type="button"
                    onClick={() => setShowNewForm(false)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    ← {t('contactModal.backToChat')}
                  </button>
                )}

                {/* Nombre */}
                <div>
                  <label className="text-xs text-[var(--text-tertiary)] mb-1.5 block">{t('contactModal.nameLabel')}</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('contactModal.namePlaceholder')}
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs text-[var(--text-tertiary)] mb-1.5 block">{t('contactModal.emailLabel')}</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t('contactModal.emailPlaceholder')}
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Categoría */}
                <div>
                  <label className="text-xs text-[var(--text-tertiary)] mb-1.5 block">{t('contactModal.categoryLabel')}</label>
                  <select
                    required
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">{t('contactModal.categorySelect')}</option>
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{t(`contactModal.categories.${c.key}`)}</option>
                    ))}
                  </select>
                </div>

                {/* Mensaje */}
                <div>
                  <label className="text-xs text-[var(--text-tertiary)] mb-1.5 block">{t('contactModal.messageLabel')}</label>
                  <textarea
                    required
                    rows={5}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder={t('contactModal.messagePlaceholder')}
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-[var(--text-primary)] rounded-xl text-sm font-semibold transition-colors"
                >
                  {loading
                    ? <><Loader size={14} className="animate-spin" /> {t('contactModal.sending')}</>
                    : <><MessageSquare size={14} /> {t('contactModal.send')}</>
                  }
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ChatBubble({ sender, body, createdAt }: { sender: 'user' | 'admin'; body: string; createdAt: string }) {
  const isAdmin = sender === 'admin'
  return (
    <div className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[85%] rounded-xl px-3 py-2 ${isAdmin ? 'bg-[var(--bg-surface-alt)] border border-[var(--border-alt)]' : 'bg-blue-600'}`}>
        <p className={`text-sm whitespace-pre-wrap break-words ${isAdmin ? 'text-[var(--text-primary)]' : 'text-white'}`}>{body}</p>
        <p className={`text-[10px] mt-1 ${isAdmin ? 'text-[var(--text-muted)]' : 'text-blue-200'}`}>
          {new Date(createdAt).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
