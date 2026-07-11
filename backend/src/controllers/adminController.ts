import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'

const ADMIN_EMAIL = 'ergania.ai@gmail.com'

async function getAdminUser(req: Request) {
  const auth = req.headers['authorization']
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token || !supabaseAdmin) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function getStats(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Acceso denegado' })
  }

  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const [usersRes, subsRes, messagesRes] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin.from('subscriptions').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('contact_messages').select('*').order('created_at', { ascending: false }),
  ])

  const users = usersRes.data?.users ?? []
  const subs  = subsRes.data ?? []
  const msgs  = messagesRes.data ?? []

  const subsByUserId = Object.fromEntries(subs.map((s: any) => [s.user_id, s]))

  const userList = users.map((u: any) => ({
    id:        u.id,
    email:     u.email,
    createdAt: u.created_at,
    sub:       subsByUserId[u.id] ?? null,
  }))

  const statusCount = subs.reduce((acc: any, s: any) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1
    return acc
  }, {})

  const payments = subs
    .filter((s: any) => s.status === 'active' && s.mp_payment_id)
    .map((s: any) => ({
      userId:    s.user_id,
      paymentId: s.mp_payment_id,
      amount:    9990,
      date:      s.updated_at,
    }))

  res.json({
    totalUsers:    users.length,
    statusCount,
    payments,
    userList,
    contactMessages: msgs,
  })
}

export async function listSalaryAnchors(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { data, error } = await supabaseAdmin
    .from('salary_anchors')
    .select('*')
    .order('carrera', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ anchors: data ?? [] })
}

export async function createSalaryAnchor(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { carrera, pais, rango_min, rango_max, moneda, nota } = req.body ?? {}
  if (!carrera || !pais || !Number.isFinite(rango_min) || !Number.isFinite(rango_max)) {
    return res.status(400).json({ error: 'carrera, pais, rango_min y rango_max son requeridos' })
  }

  const { data, error } = await supabaseAdmin
    .from('salary_anchors')
    .insert({ carrera, pais, rango_min, rango_max, moneda: moneda || 'CLP', nota: nota || null })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json({ anchor: data })
}

export async function updateSalaryAnchor(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { carrera, pais, rango_min, rango_max, moneda, nota } = req.body ?? {}
  const { error } = await supabaseAdmin
    .from('salary_anchors')
    .update({ carrera, pais, rango_min, rango_max, moneda, nota })
    .eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}

export async function deleteSalaryAnchor(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { error } = await supabaseAdmin.from('salary_anchors').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}

export async function listReports(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { data, error } = await supabaseAdmin
    .from('internal_reports')
    .select('*')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ reports: data ?? [] })
}

export async function createReport(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { tipo, titulo, fecha, contenido, checklist, observaciones } = req.body ?? {}
  if (!tipo || !titulo) return res.status(400).json({ error: 'tipo y titulo son requeridos' })

  const { data, error } = await supabaseAdmin
    .from('internal_reports')
    .insert({
      tipo, titulo,
      fecha: fecha || new Date().toISOString().slice(0, 10),
      contenido: contenido || '',
      checklist: checklist || [],
      observaciones: observaciones || '',
    })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json({ report: data })
}

export async function updateReport(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { tipo, titulo, fecha, contenido, checklist, observaciones } = req.body ?? {}
  const { error } = await supabaseAdmin
    .from('internal_reports')
    .update({ tipo, titulo, fecha, contenido, checklist, observaciones })
    .eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}

export async function deleteReport(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { error } = await supabaseAdmin.from('internal_reports').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}

export async function notifySignup(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user) return res.status(401).json({ error: 'No autorizado' })

  const { sendNewUserNotification } = await import('../services/emailService')
  sendNewUserNotification(user.email ?? 'desconocido')
    .catch(err => console.error('[admin] Error notificación signup:', err))

  res.json({ ok: true })
}
