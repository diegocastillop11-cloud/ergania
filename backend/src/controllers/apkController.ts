import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { CURRENT_APK_VERSION } from '../config/apkVersion'

export async function logApkDownload(req: Request, res: Response) {
  if (supabaseAdmin) {
    await supabaseAdmin.from('apk_downloads').insert({ user_agent: req.headers['user-agent'] || null })
  }
  res.status(204).end()
}

export function getApkVersion(_req: Request, res: Response) {
  res.json({ version: CURRENT_APK_VERSION })
}
