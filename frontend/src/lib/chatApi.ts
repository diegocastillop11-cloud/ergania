import axios from 'axios'
import { supabase } from './supabase'
import { handleUnauthorized } from './api'

export const chatApi = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/chat`,
})

chatApi.interceptors.request.use(async config => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

chatApi.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401 && await handleUnauthorized()) {
      return new Promise(() => {})
    }
    return Promise.reject(err)
  }
)

export interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  body: string
  pending_action: { tool: string; input: Record<string, unknown> } | null
  tool_result: Record<string, unknown> | null
  created_at: string
}

export interface ChatUsage {
  trial: boolean
  consultasUsed: number
  consultasLimit: number
  showUpgradeCta?: boolean
}

export async function fetchHistory(): Promise<ChatMessage[]> {
  const { data } = await chatApi.get('/history')
  return data.messages
}

export async function sendChatMessage(message: string): Promise<{ message: ChatMessage; usage: ChatUsage }> {
  const { data } = await chatApi.post('/message', { message })
  return data
}

export async function confirmChatAction(messageId: string): Promise<{ message: ChatMessage; usage: ChatUsage }> {
  const { data } = await chatApi.post('/confirm-action', { messageId })
  return data
}

export async function cancelChatAction(messageId: string): Promise<void> {
  await chatApi.post('/cancel-action', { messageId })
}

export async function proposeChatAction(tool: string, input: Record<string, unknown>): Promise<{ message: ChatMessage }> {
  const { data } = await chatApi.post('/quick-action', { tool, input })
  return data
}

export async function fetchChatUsage(): Promise<ChatUsage> {
  const { data } = await chatApi.get('/usage')
  return data
}
