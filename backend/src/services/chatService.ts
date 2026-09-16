import { supabaseAdmin } from '../config/supabase'

export interface ChatMessageRow {
  id: string
  user_id: string
  sender: 'user' | 'assistant'
  body: string
  pending_action: Record<string, unknown> | null
  tool_result: Record<string, unknown> | null
  created_at: string
}

const HISTORY_LIMIT = 30

export async function getHistory(userId: string): Promise<ChatMessageRow[]> {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(HISTORY_LIMIT)
  if (error) throw new Error(`DB error: ${error.message}`)
  return data ?? []
}

export async function saveMessage(
  userId: string,
  sender: 'user' | 'assistant',
  body: string,
  extra?: { pendingAction?: Record<string, unknown> | null; toolResult?: Record<string, unknown> | null }
): Promise<ChatMessageRow> {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      user_id: userId,
      sender,
      body,
      pending_action: extra?.pendingAction ?? null,
      tool_result: extra?.toolResult ?? null,
    })
    .select('*')
    .single()
  if (error) throw new Error(`DB error: ${error.message}`)
  return data
}

export async function getPendingAction(messageId: string, userId: string): Promise<Record<string, unknown> | null> {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('pending_action')
    .eq('id', messageId)
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data?.pending_action ?? null
}

export async function resolvePendingAction(messageId: string, userId: string, toolResult: Record<string, unknown>): Promise<void> {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  await supabaseAdmin
    .from('chat_messages')
    .update({ pending_action: null, tool_result: toolResult })
    .eq('id', messageId)
    .eq('user_id', userId)
}

export async function logChatError(userId: string | null, userEmail: string | null, userMessage: string, errorMessage: string): Promise<void> {
  if (!supabaseAdmin) return
  try {
    await supabaseAdmin.from('chat_errors').insert({
      user_id: userId,
      user_email: userEmail,
      user_message: userMessage.slice(0, 2000),
      error_message: errorMessage.slice(0, 2000),
    })
  } catch (err) {
    console.error('[chatService] no se pudo loggear chat_error:', err)
  }
}

// ── Consultas del trial (10 en total) ────────────────────────────────────────
// Independiente del límite de evaluaciones (que ya existe en careersController
// y se reusa tal cual) — este contador cubre CUALQUIER mensaje del usuario al
// chat, para no dejar una vía gratis de spamear preguntas sin tocar el límite
// de evaluaciones.

export const TRIAL_CONSULTAS_LIMIT = 10

export async function getConsultasUsed(userId: string): Promise<number> {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('chat_consultas_used')
    .eq('user_id', userId)
    .single()
  if (error) return 0
  return data?.chat_consultas_used ?? 0
}

export async function incrementConsultasUsed(userId: string): Promise<number> {
  if (!supabaseAdmin) throw new Error('supabaseAdmin no inicializado')
  const used = await getConsultasUsed(userId)
  const next = used + 1
  await supabaseAdmin.from('subscriptions').update({ chat_consultas_used: next }).eq('user_id', userId)
  return next
}
