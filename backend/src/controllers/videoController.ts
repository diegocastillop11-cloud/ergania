import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'

const SOURCES = ['landing', 'dashboard'] as const
type Source = (typeof SOURCES)[number]

export async function logVideoPlay(req: Request, res: Response) {
  if (supabaseAdmin) {
    // El body llega de un cliente público, así que la fuente se valida contra la lista
    // en vez de guardarse tal cual: si no calza, queda null y el contador total sigue bien.
    const raw = typeof req.body?.source === 'string' ? req.body.source : null
    const source: Source | null = SOURCES.includes(raw as Source) ? (raw as Source) : null

    const { error } = await supabaseAdmin.from('video_plays').insert({
      source,
      user_agent: req.headers['user-agent'] || null,
    })

    // Un SELECT sobre una tabla inexistente devuelve 204 sin error, así que el contador
    // del Admin mostraría 0 sin ninguna señal de que falta correr la migración 025. El
    // insert sí falla (PGRST205) — dejarlo en los logs es la única pista.
    if (error) console.error('[video_plays] no se pudo registrar la reproducción:', error.message)
  }
  res.status(204).end()
}
