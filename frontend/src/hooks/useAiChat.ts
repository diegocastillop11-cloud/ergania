import { useState, useCallback, useEffect } from 'react'
import {
  ChatMessage, ChatUsage, fetchHistory, sendChatMessage, confirmChatAction, cancelChatAction, fetchChatUsage, proposeChatAction,
} from '../lib/chatApi'

export function useAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [usage, setUsage] = useState<ChatUsage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadedOnce, setLoadedOnce] = useState(false)

  const load = useCallback(async () => {
    try {
      const [history, usageData] = await Promise.all([fetchHistory(), fetchChatUsage()])
      setMessages(history)
      setUsage(usageData)
    } catch {
      // silencioso — el widget arranca vacío si falla, no bloquea el resto de la app
    } finally {
      setLoadedOnce(true)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setError('')
    setLoading(true)
    // Optimista: muestra el mensaje del usuario de inmediato
    setMessages(prev => [...prev, {
      id: `local-${Date.now()}`, sender: 'user', body: trimmed,
      pending_action: null, tool_result: null, created_at: new Date().toISOString(),
    }])
    try {
      const { message, usage: nextUsage } = await sendChatMessage(trimmed)
      setMessages(prev => [...prev, message])
      setUsage(prev => ({ ...(prev ?? { trial: false, consultasUsed: 0, consultasLimit: 10 }), ...nextUsage }))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'No se pudo enviar el mensaje. Intenta de nuevo.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  const confirm = useCallback(async (messageId: string) => {
    setLoading(true)
    setError('')
    try {
      const { message, usage: nextUsage } = await confirmChatAction(messageId)
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, pending_action: null } : m).concat(message))
      setUsage(prev => prev ? { ...prev, showUpgradeCta: nextUsage.showUpgradeCta ?? prev.showUpgradeCta } : prev)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'No se pudo confirmar la acción.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  const cancel = useCallback(async (messageId: string) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, pending_action: null } : m))
    try { await cancelChatAction(messageId) } catch { /* ya se actualizó localmente */ }
  }, [])

  const propose = useCallback(async (tool: string, input: Record<string, unknown>) => {
    setError('')
    try {
      const { message } = await proposeChatAction(tool, input)
      setMessages(prev => [...prev, message])
    } catch {
      setError('No se pudo preparar esa acción. Intenta de nuevo.')
    }
  }, [])

  return { messages, usage, loading, error, loadedOnce, send, confirm, cancel, propose }
}
