import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'

export async function listPublicFaqs(_req: Request, res: Response) {
  if (!supabaseAdmin) return res.json({ faqs: [] })

  const { data, error } = await supabaseAdmin
    .from('faqs')
    .select('id, question, answer')
    .eq('published', true)
    .order('order_index', { ascending: true })

  if (error) { console.error('[faq] Error listando FAQ pública:', error.message); return res.json({ faqs: [] }) }
  res.json({ faqs: data ?? [] })
}
