import { Request, Response } from 'express'
import { sendContactEmail } from '../services/emailService'
import { supabaseAdmin } from '../config/supabase'

async function getAuthUser(req: Request) {
  const auth = req.headers['authorization']
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token || !supabaseAdmin) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function sendContact(req: Request, res: Response) {
  const { name, email, category, message } = req.body

  if (!name?.trim() || !email?.trim() || !category?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' })
  }

  if (message.trim().length < 10) {
    return res.status(400).json({ error: 'El mensaje debe tener al menos 10 caracteres' })
  }

  try {
    await sendContactEmail(name.trim(), email.trim(), category.trim(), message.trim())

    if (supabaseAdmin) {
      const authUser = await getAuthUser(req)
      const { error } = await supabaseAdmin.from('contact_messages').insert({
        name: name.trim(), email: email.trim(),
        category: category.trim(), message: message.trim(),
        user_id: authUser?.id ?? null,
      })
      if (error) console.error('[contact] Error guardando en DB:', error.message)
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('[contact] Error al enviar email:', err)
    res.status(500).json({ error: 'No se pudo enviar el mensaje' })
  }
}

// Chat en el mismo hilo — solo para usuarios con sesión, ver abogado del diablo:
// un visitante anónimo (ej. desde /login) no tiene identidad estable para reabrir
// un hilo, así que ese camino sigue siendo el formulario de una sola vía por correo.
export async function getMyThreads(req: Request, res: Response) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Sesión requerida' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { data: threads, error } = await supabaseAdmin
    .from('contact_messages')
    .select('*')
    .eq('user_id', user.id)
    .order('last_message_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })

  const ids = (threads ?? []).map(t => t.id)
  const { data: replies } = ids.length
    ? await supabaseAdmin.from('contact_replies').select('*').in('contact_message_id', ids).order('created_at', { ascending: true })
    : { data: [] as any[] }

  const repliesByThread = (replies ?? []).reduce((acc: Record<string, any[]>, r: any) => {
    (acc[r.contact_message_id] ??= []).push(r)
    return acc
  }, {})

  if (ids.length) {
    await supabaseAdmin.from('contact_messages').update({ user_unread: false }).in('id', ids)
  }

  res.json((threads ?? []).map(t => ({ ...t, replies: repliesByThread[t.id] ?? [] })))
}

export async function addMyMessage(req: Request, res: Response) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Sesión requerida' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { body } = req.body ?? {}
  if (!body?.trim()) return res.status(400).json({ error: 'El mensaje no puede estar vacío' })

  const { data: thread, error: fetchErr } = await supabaseAdmin
    .from('contact_messages')
    .select('id, user_id')
    .eq('id', req.params.id)
    .single()
  if (fetchErr || !thread || thread.user_id !== user.id) {
    return res.status(404).json({ error: 'Conversación no encontrada' })
  }

  const { error: insertErr } = await supabaseAdmin.from('contact_replies').insert({
    contact_message_id: thread.id, sender: 'user', body: body.trim(),
  })
  if (insertErr) return res.status(500).json({ error: insertErr.message })

  await supabaseAdmin
    .from('contact_messages')
    .update({ last_message_at: new Date().toISOString(), admin_unread: true, user_unread: false })
    .eq('id', thread.id)

  res.json({ ok: true })
}
