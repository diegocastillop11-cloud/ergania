import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'

export async function logApkDownload(req: Request, res: Response) {
  if (supabaseAdmin) {
    await supabaseAdmin.from('apk_downloads').insert({ user_agent: req.headers['user-agent'] || null })
  }
  res.status(204).end()
}
