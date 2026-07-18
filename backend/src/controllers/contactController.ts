import { Request, Response } from 'express'
import { sendContactEmail } from '../services/emailService'
import { supabaseAdmin } from '../config/supabase'

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
      const { error } = await supabaseAdmin.from('contact_messages').insert({
        name: name.trim(), email: email.trim(),
        category: category.trim(), message: message.trim(),
      })
      if (error) console.error('[contact] Error guardando en DB:', error.message)
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('[contact] Error al enviar email:', err)
    res.status(500).json({ error: 'No se pudo enviar el mensaje' })
  }
}
