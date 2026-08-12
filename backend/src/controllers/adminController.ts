import { Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../config/supabase'
import * as svc from '../services/careerOpsService'
import * as subscriptionSvc from '../services/subscriptionService'
import { isAdminEmail } from '../config/adminEmails'

const multer = require('multer') as typeof import('multer')
export const uploadGastoArchivoMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }).single('archivo')

const isAdmin = isAdminEmail

const TIPO_LABEL: Record<string, string> = {
  correccion: 'Corrección',
  implementacion: 'Implementación',
  plan: 'Plan futuro',
}

function buildReportHtml(report: {
  tipo: string; titulo: string; fecha: string; contenido: string
  checklist: Array<{ texto: string; marcado: boolean; nota: string }>; observaciones: string
}): string {
  const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const checklistHtml = (report.checklist || []).map(item => `
    <div style="display:flex;gap:8px;margin:6px 0;align-items:flex-start;">
      <span style="font-size:14px;">${item.marcado ? '☑' : '☐'}</span>
      <div>
        <div style="${item.marcado ? 'text-decoration:line-through;color:#888;' : ''}">${esc(item.texto)}</div>
        ${item.nota ? `<div style="font-size:11px;color:#666;margin-top:2px;">${esc(item.nota)}</div>` : ''}
      </div>
    </div>`).join('')

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(report.titulo)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;padding:32px;line-height:1.6;}
  .header{display:flex;align-items:center;gap:12px;border-bottom:2px solid #1d4ed8;padding-bottom:16px;margin-bottom:20px;}
  .header img{width:40px;height:40px;object-fit:contain;}
  .header h1{font-size:14px;color:#1d4ed8;margin:0;letter-spacing:1px;}
  .badge{display:inline-block;font-size:11px;font-weight:bold;padding:3px 10px;border-radius:12px;background:#eef2ff;color:#1d4ed8;margin-bottom:8px;}
  h2{font-size:20px;margin:4px 0 4px;}
  .fecha{color:#666;font-size:12px;margin-bottom:16px;}
  .contenido{margin-bottom:20px;white-space:pre-wrap;}
  .section-title{font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#444;border-bottom:1px solid #ddd;padding-bottom:4px;margin:20px 0 10px;}
  .observaciones{white-space:pre-wrap;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:12px;font-size:13px;}
</style></head><body>
  <div class="header"><img src="https://ergania.com/logo.png" /><h1>ERGANIA</h1></div>
  <span class="badge">${esc(TIPO_LABEL[report.tipo] || report.tipo)}</span>
  <h2>${esc(report.titulo)}</h2>
  <div class="fecha">${esc(report.fecha)}</div>
  ${report.contenido ? `<div class="contenido">${esc(report.contenido)}</div>` : ''}
  ${checklistHtml ? `<div class="section-title">Checklist</div>${checklistHtml}` : ''}
  ${report.observaciones ? `<div class="section-title">Observaciones</div><div class="observaciones">${esc(report.observaciones)}</div>` : ''}
</body></html>`
}

function buildReceiptHtml(receipt: {
  user_email: string; monto: number; moneda: string; plan: string; fecha: string; mp_payment_id: string
}): string {
  const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante de pago</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;padding:32px;line-height:1.6;}
  .header{display:flex;align-items:center;gap:12px;border-bottom:2px solid #16a34a;padding-bottom:16px;margin-bottom:20px;}
  .header img{width:40px;height:40px;object-fit:contain;}
  .header h1{font-size:14px;color:#16a34a;margin:0;letter-spacing:1px;}
  h2{font-size:20px;margin:4px 0 16px;}
  table{width:100%;border-collapse:collapse;margin:16px 0;}
  td{padding:8px 0;}
  td:first-child{color:#666;width:160px;}
  .monto{font-size:20px;font-weight:bold;color:#16a34a;}
  .nota{font-size:12px;color:#999;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-top:20px;}
</style></head><body>
  <div class="header"><img src="https://ergania.com/logo.png" /><h1>ERGANIA</h1></div>
  <h2>Comprobante de pago</h2>
  <table>
    <tr><td>Cliente</td><td>${esc(receipt.user_email)}</td></tr>
    <tr><td>Plan</td><td>${esc(receipt.plan)}</td></tr>
    <tr><td>Monto</td><td class="monto">$${Number(receipt.monto).toLocaleString('es-CL')} ${esc(receipt.moneda)}</td></tr>
    <tr><td>Fecha</td><td>${esc(receipt.fecha)}</td></tr>
    <tr><td>ID de pago (MercadoPago)</td><td style="font-family:monospace;font-size:12px;">${esc(receipt.mp_payment_id)}</td></tr>
  </table>
  <p class="nota">
    Este comprobante no tiene validez tributaria. Ergania está en trámite de habilitación como
    emisor electrónico ante el SII — cuando esté lista, se emitirá la boleta electrónica oficial
    por cada pago, incluidos los ya realizados.
  </p>
</body></html>`
}

async function getAdminUser(req: Request) {
  const auth = req.headers['authorization']
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token || !supabaseAdmin) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

/** Gate de defensa en profundidad para todas las rutas admin — cada handler
 * ya valida isAdmin() por su cuenta, pero esto evita que un handler nuevo
 * quede expuesto si alguien olvida copiar el chequeo. */
export async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const user = await getAdminUser(req)
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
  next()
}

export async function getStats(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || !isAdmin(user.email)) {
    return res.status(403).json({ error: 'Acceso denegado' })
  }

  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const [usersRes, subsRes, messagesRes, receiptsRes, trackerRes, profilesRes, apkDownloadsRes, videoPlaysRes, deletionsRes] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin.from('subscriptions').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('contact_messages').select('*').order('last_message_at', { ascending: false }),
    supabaseAdmin.from('payment_receipts').select('*').order('fecha', { ascending: false }),
    supabaseAdmin.from('tracker_entries').select('user_email'),
    supabaseAdmin.from('perfil_profiles').select('user_email, data'),
    supabaseAdmin.from('apk_downloads').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('video_plays').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('account_deletion_requests').select('*').order('created_at', { ascending: false }),
  ])

  const users = usersRes.data?.users ?? []
  // Status "real" (respeta current_period_end/trial_ends_at), no el crudo
  // guardado en la fila — evita que el panel muestre "Cancelado"/"Trial" para
  // cuentas que en verdad siguen con acceso (ver computeEffectiveStatus).
  const subs  = (subsRes.data ?? []).map((s: any) => ({ ...s, status: subscriptionSvc.computeEffectiveStatus(s) }))
  const msgs  = messagesRes.data ?? []
  const receipts = receiptsRes.data ?? []
  const deletionRequests = (deletionsRes.data ?? []).map((d: any) => ({
    id: d.id, userId: d.user_id, email: d.email, motivo: d.motivo, createdAt: d.created_at,
  }))

  // Nombre completo declarado en el perfil de Postulante (config/profile.yml en Supabase,
  // tabla perfil_profiles). No viene de auth.users porque el registro con email/password no
  // pide nombre — solo login con Google lo trae, y no todos los usuarios entran por ahí.
  const nameByEmail: Record<string, string> = {}
  for (const row of profilesRes.data ?? []) {
    const fullName = (row as any).data?.candidate?.full_name?.trim()
    if (fullName && !nameByEmail[(row as any).user_email]) nameByEmail[(row as any).user_email] = fullName
  }

  const subsByUserId = Object.fromEntries(subs.map((s: any) => [s.user_id, s]))

  // Conteo de ofertas evaluadas por usuario (tracker_entries se llena tanto por
  // Evaluar Oferta como por Postulaciones, así que es "ofertas trackeadas", no
  // solo evaluaciones estrictas de renta).
  const evalCountByEmail = (trackerRes.data ?? []).reduce((acc: Record<string, number>, r: any) => {
    acc[r.user_email] = (acc[r.user_email] ?? 0) + 1
    return acc
  }, {})

  const userList = users.map((u: any) => ({
    id:              u.id,
    email:           u.email,
    fullName:        nameByEmail[u.email] ?? u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
    createdAt:       u.created_at,
    sub:             subsByUserId[u.id] ?? null,
    evaluationsCount: evalCountByEmail[u.email] ?? 0,
  }))

  // Cuentas marcadas is_test (correos de prueba internos) no cuentan en las
  // métricas de negocio — sí siguen apareciendo en userList para poder gestionarlas.
  const testUserIds = new Set(subs.filter((s: any) => s.is_test).map((s: any) => s.user_id))
  const realSubs = subs.filter((s: any) => !testUserIds.has(s.user_id))

  const statusCount = realSubs.reduce((acc: any, s: any) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1
    return acc
  }, {})

  // Monto real por pago (antes venía hardcodeado a 9990) — un comprobante por cada
  // pago aprobado, no solo el más reciente por usuario (ver payment_receipts).
  const payments = receipts
    .filter((r: any) => !testUserIds.has(r.user_id))
    .map((r: any) => ({
      userId:    r.user_id,
      userEmail: r.user_email,
      paymentId: r.mp_payment_id,
      receiptId: r.id,
      amount:    Number(r.monto),
      date:      r.fecha,
    }))

  res.json({
    totalUsers:    users.length,
    statusCount,
    testCount:     testUserIds.size,
    payments,
    userList,
    contactMessages: msgs,
    apkDownloadsCount: apkDownloadsRes.count ?? 0,
    // Si la migración 025 aún no corre en este entorno, count viene null y el panel
    // muestra 0 en vez de romperse.
    videoPlaysCount: videoPlaysRes.count ?? 0,
    deletionRequests,
  })
}

export async function listSalaryAnchors(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
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
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
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
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
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
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { error } = await supabaseAdmin.from('salary_anchors').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}

export async function listFaqs(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { data, error } = await supabaseAdmin
    .from('faqs')
    .select('*')
    .order('order_index', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ faqs: data ?? [] })
}

export async function createFaq(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { question, answer, order_index, published } = req.body ?? {}
  if (!question?.trim() || !answer?.trim()) {
    return res.status(400).json({ error: 'Pregunta y respuesta son requeridas' })
  }

  const { data, error } = await supabaseAdmin
    .from('faqs')
    .insert({
      question: question.trim(), answer: answer.trim(),
      order_index: Number.isFinite(order_index) ? order_index : 0,
      published: published ?? true,
    })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
}

export async function updateFaq(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { question, answer, order_index, published } = req.body ?? {}
  const { error } = await supabaseAdmin
    .from('faqs')
    .update({ question, answer, order_index, published })
    .eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}

export async function deleteFaq(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { error } = await supabaseAdmin.from('faqs').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}

export async function listReports(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
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
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
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
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
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
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { error } = await supabaseAdmin.from('internal_reports').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}

export async function downloadReportPdf(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { data: report, error } = await supabaseAdmin
    .from('internal_reports')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error || !report) return res.status(404).json({ error: 'Reporte no encontrado' })

  try {
    const html = buildReportHtml(report)
    const { buffer } = await svc.generatePDFFromHtml(html, 'Ergania', report.titulo, '', 'Reporte')
    const filename = `Reporte_${String(report.titulo).replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message || 'Error al generar el PDF' })
  }
}

export async function listReceipts(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { data, error } = await supabaseAdmin
    .from('payment_receipts')
    .select('*')
    .order('fecha', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ receipts: data ?? [] })
}

export async function downloadReceiptPdf(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { data: receipt, error } = await supabaseAdmin
    .from('payment_receipts')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error || !receipt) return res.status(404).json({ error: 'Comprobante no encontrado' })

  try {
    const html = buildReceiptHtml(receipt)
    const { buffer } = await svc.generatePDFFromHtml(html, 'Ergania', receipt.user_email, '', 'Comprobante')
    const filename = `Comprobante_${String(receipt.user_email).replace(/[^a-zA-Z0-9]+/g, '_')}_${receipt.fecha}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message || 'Error al generar el PDF' })
  }
}

export async function replyToMessage(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { reply } = req.body ?? {}
  if (!reply?.trim()) return res.status(400).json({ error: 'La respuesta no puede estar vacía' })

  const { data: msg, error: fetchErr } = await supabaseAdmin
    .from('contact_messages')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (fetchErr || !msg) return res.status(404).json({ error: 'Mensaje no encontrado' })

  // Con user_id: la respuesta queda en el chat in-app (evita depender del correo).
  // Sin user_id (visitante anónimo, ej. desde /login): único canal sigue siendo el correo.
  if (!msg.user_id) {
    try {
      const { sendContactReply } = await import('../services/emailService')
      await sendContactReply(msg.email, msg.name, reply.trim())
    } catch (err: unknown) {
      return res.status(500).json({ error: (err as Error).message || 'No se pudo enviar el correo' })
    }
  }

  const { error: replyErr } = await supabaseAdmin.from('contact_replies').insert({
    contact_message_id: msg.id, sender: 'admin', body: reply.trim(),
  })
  if (replyErr) return res.status(500).json({ error: replyErr.message })

  const { error } = await supabaseAdmin
    .from('contact_messages')
    .update({
      replied_at: new Date().toISOString(), reply_text: reply.trim(),
      last_message_at: new Date().toISOString(), admin_unread: false, user_unread: true,
    })
    .eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })

  res.json({ ok: true })
}

export async function getMessageThread(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { data: replies, error } = await supabaseAdmin
    .from('contact_replies')
    .select('*')
    .eq('contact_message_id', req.params.id)
    .order('created_at', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })

  await supabaseAdmin.from('contact_messages').update({ admin_unread: false }).eq('id', req.params.id)

  res.json(replies ?? [])
}

export async function setUserTestFlag(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { isTest } = req.body ?? {}
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({ is_test: !!isTest })
    .eq('user_id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}

// Cuenta exenta: acceso activo permanente sin pago (getSubscriptionStatus la
// devuelve siempre 'active'). Distinto de is_test, que solo excluye de métricas
// pero sigue exigiendo pago — usar esto para cuentas internas/de prueba que sí
// deben tener acceso siempre.
export async function setUserExemptFlag(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { isExempt } = req.body ?? {}
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({ is_exempt: !!isExempt })
    .eq('user_id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}

export async function deleteUser(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const targetId = req.params.id
  if (targetId === admin.id) return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de administrador' })

  const { data: targetData } = await supabaseAdmin.auth.admin.getUserById(targetId)
  const targetEmail = targetData?.user?.email
  if (!targetEmail) return res.status(404).json({ error: 'Usuario no encontrado' })

  const motivo = (req.body?.motivo || '').trim() || 'Eliminado por admin'
  try {
    await subscriptionSvc.requestAccountDeletion(targetId, targetEmail, motivo)
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Error' })
  }
  res.json({ ok: true })
}

// ── Planilla de gastos ──────────────────────────────────────────────────────

export async function listGastos(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const [gastosRes, archivosRes] = await Promise.all([
    supabaseAdmin.from('gastos').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false }),
    supabaseAdmin.from('gasto_archivos').select('id, gasto_id, nombre_original, mime_type, size_bytes, created_at').order('created_at', { ascending: true }),
  ])
  if (gastosRes.error) return res.status(500).json({ error: gastosRes.error.message })

  const archivosByGasto: Record<string, any[]> = {}
  for (const a of archivosRes.data ?? []) {
    (archivosByGasto[a.gasto_id] ??= []).push(a)
  }
  const gastos = (gastosRes.data ?? []).map(g => ({ ...g, archivos: archivosByGasto[g.id] ?? [] }))
  res.json({ gastos })
}

const GASTO_CATEGORIAS = ['hosting_infra', 'apis_ia', 'pagos_suscripciones', 'marketing', 'legal_contable', 'otro']
const GASTO_ARCHIVO_BUCKET = 'gastos-comprobantes'
const GASTO_ARCHIVO_MIME_ALLOWLIST = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']

export async function createGasto(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { monto, moneda, categoria, descripcion, fecha, comprobante_url } = req.body ?? {}
  if (!Number.isFinite(monto) || monto <= 0) return res.status(400).json({ error: 'monto debe ser un número mayor a 0' })
  if (!GASTO_CATEGORIAS.includes(categoria)) return res.status(400).json({ error: 'categoria inválida' })

  const { data, error } = await supabaseAdmin
    .from('gastos')
    .insert({
      monto, moneda: moneda || 'CLP', categoria,
      descripcion: descripcion || '',
      fecha: fecha || new Date().toISOString().slice(0, 10),
      comprobante_url: comprobante_url || null,
    })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json({ gasto: data })
}

export async function updateGasto(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { monto, moneda, categoria, descripcion, fecha, comprobante_url } = req.body ?? {}
  if (!Number.isFinite(monto) || monto <= 0) return res.status(400).json({ error: 'monto debe ser un número mayor a 0' })
  if (!GASTO_CATEGORIAS.includes(categoria)) return res.status(400).json({ error: 'categoria inválida' })

  const { error } = await supabaseAdmin
    .from('gastos')
    .update({ monto, moneda: moneda || 'CLP', categoria, descripcion: descripcion || '', fecha, comprobante_url: comprobante_url || null })
    .eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}

export async function deleteGasto(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  // El FK con ON DELETE CASCADE limpia las filas de gasto_archivos, pero no
  // los archivos reales en Storage — hay que borrarlos a mano antes.
  const { data: archivos } = await supabaseAdmin.from('gasto_archivos').select('storage_path').eq('gasto_id', req.params.id)
  if (archivos && archivos.length > 0) {
    await supabaseAdmin.storage.from(GASTO_ARCHIVO_BUCKET).remove(archivos.map(a => a.storage_path))
  }

  const { error } = await supabaseAdmin.from('gastos').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}

export async function uploadGastoArchivo(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const file = (req as Request & { file?: { buffer: Buffer; mimetype: string; originalname: string; size: number } }).file
  if (!file) return res.status(400).json({ error: 'Falta el archivo' })
  if (!GASTO_ARCHIVO_MIME_ALLOWLIST.includes(file.mimetype)) {
    return res.status(400).json({ error: 'Tipo de archivo no permitido — solo PDF o imágenes (JPG, PNG, WebP, HEIC)' })
  }

  const { data: gasto } = await supabaseAdmin.from('gastos').select('id').eq('id', req.params.id).single()
  if (!gasto) return res.status(404).json({ error: 'Gasto no encontrado' })

  const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]+/g, '_')
  const storagePath = `${req.params.id}/${Date.now()}_${safeName}`

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(GASTO_ARCHIVO_BUCKET)
    .upload(storagePath, file.buffer, { contentType: file.mimetype })
  if (uploadErr) return res.status(500).json({ error: uploadErr.message })

  const { data, error } = await supabaseAdmin
    .from('gasto_archivos')
    .insert({
      gasto_id: req.params.id, storage_path: storagePath,
      nombre_original: file.originalname, mime_type: file.mimetype, size_bytes: file.size,
    })
    .select('id, gasto_id, nombre_original, mime_type, size_bytes, created_at')
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json({ archivo: data })
}

export async function downloadGastoArchivo(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { data: archivo, error } = await supabaseAdmin
    .from('gasto_archivos')
    .select('*')
    .eq('id', req.params.archivoId)
    .eq('gasto_id', req.params.gastoId)
    .single()
  if (error || !archivo) return res.status(404).json({ error: 'Archivo no encontrado' })

  const { data: blob, error: downloadErr } = await supabaseAdmin.storage.from(GASTO_ARCHIVO_BUCKET).download(archivo.storage_path)
  if (downloadErr || !blob) return res.status(500).json({ error: downloadErr?.message || 'No se pudo descargar el archivo' })

  const buffer = Buffer.from(await blob.arrayBuffer())
  res.setHeader('Content-Type', archivo.mime_type || 'application/octet-stream')
  res.setHeader('Content-Disposition', `inline; filename="${archivo.nombre_original.replace(/"/g, '')}"`)
  res.send(buffer)
}

export async function deleteGastoArchivo(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { data: archivo, error } = await supabaseAdmin
    .from('gasto_archivos')
    .select('storage_path')
    .eq('id', req.params.archivoId)
    .eq('gasto_id', req.params.gastoId)
    .single()
  if (error || !archivo) return res.status(404).json({ error: 'Archivo no encontrado' })

  await supabaseAdmin.storage.from(GASTO_ARCHIVO_BUCKET).remove([archivo.storage_path])
  const { error: delErr } = await supabaseAdmin.from('gasto_archivos').delete().eq('id', req.params.archivoId)
  if (delErr) return res.status(500).json({ error: delErr.message })
  res.json({ ok: true })
}

function escBulk(s: string | null | undefined) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Un tag sin dato disponible para ese destinatario (ej. {{monto}} para alguien
// sin pagos registrados) se borra en vez de mandarse literal — más limpio para
// el usuario final que ver "{{monto}}" en el correo.
function renderMergeFields(text: string | null | undefined, vars: Record<string, string>): string {
  return (text || '').replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_, key: string) => vars[key.toLowerCase()] ?? '')
}

// Registro único de los merge fields calculados. Es también lo que alimenta el
// módulo Variables del panel y la ayuda del editor de correos, así que agregar
// uno acá lo documenta solo en la UI — antes la lista estaba escrita a mano en
// el frontend y se desincronizaba.
interface MergeFieldSpec { clave: string; descripcion: string; origen: string; ejemplo: string }

const fmtFecha = (d: Date) => d.toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })

function builtinMergeFields(): MergeFieldSpec[] {
  return [
    { clave: 'nombre', descripcion: 'Nombre de pila del destinatario, para saludarlo.',
      origen: 'Nombre completo declarado en el perfil de Postulante; si no lo llenó, el nombre de su cuenta de Google; si tampoco, se deduce de su correo.',
      ejemplo: 'Diego' },
    { clave: 'nombre_completo', descripcion: 'Nombre y apellidos del destinatario.',
      origen: 'Mismo origen que {{nombre}}, sin recortar al primer nombre.',
      ejemplo: 'Diego Castillo' },
    { clave: 'producto', descripcion: 'Nombre del producto.', origen: 'Fijo en código.', ejemplo: 'Ergania' },
    { clave: 'plan', descripcion: 'Plan que contrató el destinatario.',
      origen: 'Último pago registrado en Pagos; si no tiene pagos, "Ergania — Plan mensual".', ejemplo: 'Ergania — Plan mensual' },
    { clave: 'monto', descripcion: 'Monto de su último pago.',
      origen: 'Último pago registrado en Pagos. Vacío si nunca pagó.', ejemplo: '$9.990 CLP' },
    { clave: 'fecha', descripcion: 'Fecha de su último pago.',
      origen: 'Último pago registrado en Pagos; si nunca pagó, la fecha de hoy.', ejemplo: fmtFecha(new Date()) },
    { clave: 'proxima_renovacion', descripcion: 'Cuándo se le vuelve a cobrar.',
      origen: 'Fin del período actual de su suscripción. Vacío si no tiene suscripción activa.',
      ejemplo: fmtFecha(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) },
    { clave: 'dias_trial', descripcion: 'Días que le quedan de prueba gratis.',
      origen: 'Fin del trial de su suscripción. Vacío si no está en trial.', ejemplo: '2' },
  ]
}

// Variables de valor fijo definidas por el admin (tabla email_variables). No
// pueden pisar un merge field calculado: la validación de createEmailVariable
// rechaza esas claves.
async function loadCustomVariables(): Promise<Record<string, string>> {
  if (!supabaseAdmin) return {}
  const { data } = await supabaseAdmin.from('email_variables').select('clave, valor')
  return Object.fromEntries((data ?? []).map((v: any) => [v.clave, v.valor ?? '']))
}

async function mergeFieldSample(): Promise<Record<string, string>> {
  const custom = await loadCustomVariables()
  return { ...custom, ...Object.fromEntries(builtinMergeFields().map(f => [f.clave, f.ejemplo])) }
}

// Última red si el usuario nunca declaró su nombre: la parte del correo antes
// del @, recortada en el primer separador o número ("diego.castillop11" →
// "Diego"). Feo, pero menos que un "Hola ," vacío.
function nombreDesdeEmail(email: string): string {
  const local = email.split('@')[0]
  const base = local.split(/[._+\-0-9]/).filter(Boolean)[0] || local
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : ''
}

// Carga en batch (no un query por destinatario, un envío puede llegar a 300)
// los datos reales para reemplazar los merge fields de arriba por persona.
async function loadMergeDataForEmails(emails: string[]): Promise<Record<string, Record<string, string>>> {
  if (!supabaseAdmin || emails.length === 0) return {}

  const [usersRes, perfilesRes, subsRes, receiptsRes, customVars] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin.from('perfil_profiles').select('user_email, data').in('user_email', emails),
    supabaseAdmin.from('subscriptions').select('user_id, current_period_end, trial_ends_at'),
    supabaseAdmin.from('payment_receipts').select('user_email, monto, moneda, plan, fecha').in('user_email', emails).order('fecha', { ascending: false }),
    loadCustomVariables(),
  ])

  const emailSet = new Set(emails)
  const userIdByEmail: Record<string, string> = {}
  const metaNombreByEmail: Record<string, string> = {}
  for (const u of usersRes.data?.users ?? []) {
    if (!u.email || !emailSet.has(u.email)) continue
    userIdByEmail[u.email] = u.id
    // Solo el login con Google trae nombre; el registro con correo/contraseña no lo pide.
    const meta = (u.user_metadata?.full_name || u.user_metadata?.name || '').trim()
    if (meta) metaNombreByEmail[u.email] = meta
  }
  // Nombre real de la persona, del perfil de Postulante (perfil_profiles.data.candidate).
  // NO de `perfiles.nombre`: esa tabla guarda el nombre del perfil de búsqueda, que
  // por defecto es "Principal" — de ahí salía el "Hola Principal," de los envíos.
  const nombreByEmail: Record<string, string> = {}
  for (const p of perfilesRes.data ?? []) {
    const fullName = ((p as any).data?.candidate?.full_name || '').trim()
    if (fullName && !nombreByEmail[(p as any).user_email]) nombreByEmail[(p as any).user_email] = fullName
  }

  const subByUserId: Record<string, any> = {}
  for (const s of subsRes.data ?? []) subByUserId[s.user_id] = s

  // Ordenado por fecha desc arriba, así que la primera fila por email es la más reciente.
  const latestReceiptByEmail: Record<string, any> = {}
  for (const r of receiptsRes.data ?? []) {
    if (!latestReceiptByEmail[r.user_email]) latestReceiptByEmail[r.user_email] = r
  }

  const fmtDate = (iso: string) => fmtFecha(new Date(iso))

  const result: Record<string, Record<string, string>> = {}
  for (const email of emails) {
    const sub = subByUserId[userIdByEmail[email]]
    const receipt = latestReceiptByEmail[email]
    const daysLeft = sub?.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000))
      : undefined
    const nombreCompleto = nombreByEmail[email] || metaNombreByEmail[email] || nombreDesdeEmail(email)

    result[email] = {
      ...customVars,
      nombre: nombreCompleto.split(/\s+/)[0],
      nombre_completo: nombreCompleto,
      producto: 'Ergania',
      plan: receipt?.plan || 'Ergania — Plan mensual',
      monto: receipt ? `$${Number(receipt.monto).toLocaleString('es-CL')} ${receipt.moneda}` : '',
      fecha: receipt?.fecha ? fmtDate(receipt.fecha) : fmtDate(new Date().toISOString()),
      proxima_renovacion: sub?.current_period_end ? fmtDate(sub.current_period_end) : '',
      dias_trial: daysLeft !== undefined ? String(daysLeft) : '',
    }
  }
  return result
}

function renderBulkEmailBody(cuerpo: string): string {
  const blocks = (cuerpo || '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
  return blocks.map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    const isList = lines.length > 0 && lines.every(l => l.startsWith('- '))
    if (isList) {
      return `<ul style="color:#333;line-height:1.8;padding-left:20px;">${lines.map(l => `<li>${escBulk(l.slice(2))}</li>`).join('')}</ul>`
    }
    return `<p style="color:#333;line-height:1.6;">${lines.map(escBulk).join('<br/>')}</p>`
  }).join('\n')
}

function buildBulkEmailHtml(email: {
  encabezado?: string | null; cuerpo: string
  cta1_texto: string | null; cta1_url: string | null
  cta2_texto: string | null; cta2_url: string | null
}, vars: Record<string, string> = {}): string {
  // Estilo deliberadamente "plano" (sin botón con fondo de color, sin header
  // con línea de marca) — un botón tipo marketing es una de las señales que
  // más pesa para que Gmail clasifique el correo como Promociones en vez de
  // Principal. La frase de darte de baja se mantiene: protege ante reportes
  // de spam aunque reste algo de chance de caer en Principal.
  // `titulo` (el nombre interno de la campaña) NO se imprime acá: se coló como
  // primera línea del correo hasta 2026-08-10 y los destinatarios veían cosas
  // como "Win-back (reconquista)". El encabezado visible es un campo aparte y
  // opcional.
  const encabezado = renderMergeFields(email.encabezado, vars).trim()
  const cuerpo = renderMergeFields(email.cuerpo, vars)
  const cta1Texto = email.cta1_texto ? renderMergeFields(email.cta1_texto, vars) : email.cta1_texto
  const cta2Texto = email.cta2_texto ? renderMergeFields(email.cta2_texto, vars) : email.cta2_texto
  const cta1 = cta1Texto && email.cta1_url ? `
      <p style="margin:20px 0;">
        <a href="${escBulk(email.cta1_url)}" style="color:#C4633A;text-decoration:underline;font-weight:bold;">
          ${escBulk(cta1Texto)}
        </a>
      </p>` : ''
  const cta2 = cta2Texto && email.cta2_url ? `
      <p style="margin:0 0 20px;">
        <a href="${escBulk(email.cta2_url)}" style="color:#C4633A;text-decoration:underline;">
          ${escBulk(cta2Texto)}
        </a>
      </p>` : ''
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
      ${encabezado ? `<p style="font-weight:bold;font-size:16px;margin:0 0 16px;">${escBulk(encabezado)}</p>` : ''}
      ${renderBulkEmailBody(cuerpo)}
      ${cta1}
      ${cta2}
      <p style="font-size:12px;color:#999;margin-top:24px;">
        Ergania · Si ya no quieres recibir estos correos, respóndenos y te sacamos de la lista.
      </p>
    </div>
  `
}

// ── CRUD de correos guardados ──────────────────────────────────────────────

export async function listBulkEmails(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { data, error } = await supabaseAdmin.from('bulk_emails').select('*').order('created_at', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ emails: data ?? [] })
}

export async function createBulkEmail(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { titulo, asunto, encabezado, cuerpo, cta1_texto, cta1_url, cta2_texto, cta2_url } = req.body ?? {}
  if (!titulo?.trim() || !asunto?.trim()) return res.status(400).json({ error: 'Título y asunto son requeridos' })

  const { data, error } = await supabaseAdmin
    .from('bulk_emails')
    .insert({
      titulo: titulo.trim(), asunto: asunto.trim(), encabezado: encabezado?.trim() || null, cuerpo: cuerpo || '',
      cta1_texto: cta1_texto || null, cta1_url: cta1_url || null,
      cta2_texto: cta2_texto || null, cta2_url: cta2_url || null,
    })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json({ email: data })
}

export async function updateBulkEmail(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { titulo, asunto, encabezado, cuerpo, cta1_texto, cta1_url, cta2_texto, cta2_url } = req.body ?? {}
  if (!titulo?.trim() || !asunto?.trim()) return res.status(400).json({ error: 'Título y asunto son requeridos' })

  const { error } = await supabaseAdmin
    .from('bulk_emails')
    .update({
      titulo: titulo.trim(), asunto: asunto.trim(), encabezado: encabezado?.trim() || null, cuerpo: cuerpo || '',
      cta1_texto: cta1_texto || null, cta1_url: cta1_url || null,
      cta2_texto: cta2_texto || null, cta2_url: cta2_url || null,
    })
    .eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}

export async function deleteBulkEmail(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { error } = await supabaseAdmin.from('bulk_emails').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}

export async function getBulkEmailPreview(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { data, error } = await supabaseAdmin.from('bulk_emails').select('*').eq('id', req.params.id).single()
  if (error || !data) return res.status(404).json({ error: 'Correo no encontrado' })
  const sample = await mergeFieldSample()
  res.json({
    subject: renderMergeFields(data.asunto, sample),
    html: buildBulkEmailHtml(data, sample),
  })
}

// ── Variables de correos ───────────────────────────────────────────────────

const CLAVE_VARIABLE_RE = /^[a-z][a-z0-9_]*$/

export async function listEmailVariables(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { data, error } = await supabaseAdmin.from('email_variables').select('*').order('clave', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ builtin: builtinMergeFields(), custom: data ?? [] })
}

function validarVariable(body: any): { clave: string; valor: string; descripcion: string | null } | string {
  const clave = (body?.clave || '').trim().toLowerCase()
  if (!clave) return 'La clave es requerida'
  if (!CLAVE_VARIABLE_RE.test(clave)) return 'La clave solo puede tener minúsculas, números y guion bajo, y debe empezar con una letra'
  if (builtinMergeFields().some(f => f.clave === clave)) return `"${clave}" ya existe como variable automática — elige otro nombre`
  return { clave, valor: (body?.valor ?? '').toString(), descripcion: body?.descripcion?.trim() || null }
}

export async function createEmailVariable(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const parsed = validarVariable(req.body)
  if (typeof parsed === 'string') return res.status(400).json({ error: parsed })

  const { data, error } = await supabaseAdmin.from('email_variables').insert(parsed).select().single()
  if (error) {
    if (error.code === '23505') return res.status(400).json({ error: `Ya existe una variable con la clave "${parsed.clave}"` })
    return res.status(500).json({ error: error.message })
  }
  res.json({ variable: data })
}

export async function updateEmailVariable(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const parsed = validarVariable(req.body)
  if (typeof parsed === 'string') return res.status(400).json({ error: parsed })

  const { error } = await supabaseAdmin.from('email_variables').update(parsed).eq('id', req.params.id)
  if (error) {
    if (error.code === '23505') return res.status(400).json({ error: `Ya existe una variable con la clave "${parsed.clave}"` })
    return res.status(500).json({ error: error.message })
  }
  res.json({ ok: true })
}

export async function deleteEmailVariable(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { error } = await supabaseAdmin.from('email_variables').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}

export async function listBulkEmailSent(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { data, error } = await supabaseAdmin
    .from('bulk_email_log')
    .select('email, sent_at')
    .eq('campaign', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ sent: data ?? [] })
}

// Envío secuencial con pausa entre correos para no pasarse del rate limit de
// Resend — no hay colas/workers en este proyecto (serverless function única),
// así que un envío manual corre dentro de la misma request del botón
// "Enviar correo", y uno programado corre dentro de la misma request del cron.
async function sendBulkEmailBatch(bulkEmailId: string, bulkEmail: {
  asunto: string; encabezado?: string | null; cuerpo: string
  cta1_texto: string | null; cta1_url: string | null
  cta2_texto: string | null; cta2_url: string | null
}, emails: string[]) {
  if (!supabaseAdmin) throw new Error('Sin conexión a base de datos')

  const { data: already } = await supabaseAdmin
    .from('bulk_email_log')
    .select('email')
    .eq('campaign', bulkEmailId)
    .in('email', emails)
  const alreadySent = new Set((already ?? []).map((r: any) => r.email))

  const mergeDataByEmail = await loadMergeDataForEmails(emails.filter(e => !alreadySent.has(e)))

  const { sendEmail } = await import('../services/emailService')
  const sent: string[] = []
  const skipped: string[] = []
  const failed: { email: string; error: string }[] = []

  for (const email of emails) {
    if (alreadySent.has(email)) { skipped.push(email); continue }
    try {
      const vars = mergeDataByEmail[email] || {}
      const subject = renderMergeFields(bulkEmail.asunto, vars)
      const html = buildBulkEmailHtml(bulkEmail, vars)
      await sendEmail(email, subject, html)
      await supabaseAdmin.from('bulk_email_log').insert({ campaign: bulkEmailId, email })
      sent.push(email)
    } catch (err: unknown) {
      failed.push({ email, error: (err as Error).message || 'Error desconocido' })
    }
    await new Promise(r => setTimeout(r, 400))
  }

  return { sent, skipped, failed }
}

export async function sendBulkEmail(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { emails } = req.body ?? {}
  if (!Array.isArray(emails) || emails.length === 0) return res.status(400).json({ error: 'Sin destinatarios' })
  if (emails.length > 300) return res.status(400).json({ error: 'Máximo 300 destinatarios por envío' })

  const { data: bulkEmail, error: fetchErr } = await supabaseAdmin.from('bulk_emails').select('*').eq('id', req.params.id).single()
  if (fetchErr || !bulkEmail) return res.status(404).json({ error: 'Correo no encontrado' })

  const result = await sendBulkEmailBatch(bulkEmail.id, bulkEmail, emails)
  res.json(result)
}

// ── Audiencia: usuarios en trial con pocas ofertas evaluadas ───────────────
// Excluye cuentas recién creadas: sin este piso, un usuario que se registra
// el mismo día que se dispara la campaña también tiene 0 evaluaciones y cae
// en el filtro, recibiendo el correo de "poco uso" como primer contacto con
// Ergania en vez de la confirmación de cuenta.
const MIN_ACCOUNT_AGE_MS = 24 * 60 * 60 * 1000

async function loadTrialCandidates(maxEvals: number): Promise<string[]> {
  if (!supabaseAdmin) return []
  const [usersRes, subsRes, trackerRes] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin.from('subscriptions').select('user_id, status, is_test'),
    supabaseAdmin.from('tracker_entries').select('user_email'),
  ])
  const users = usersRes.data?.users ?? []
  const subs = subsRes.data ?? []
  const subsByUserId = Object.fromEntries(subs.map((s: any) => [s.user_id, s]))
  const evalCountByEmail = (trackerRes.data ?? []).reduce((acc: Record<string, number>, r: any) => {
    acc[r.user_email] = (acc[r.user_email] ?? 0) + 1
    return acc
  }, {})
  const ageCutoff = Date.now() - MIN_ACCOUNT_AGE_MS
  return users
    .filter((u: any) => {
      const sub = subsByUserId[u.id]
      if (!sub || sub.status !== 'trial' || sub.is_test) return false
      if (new Date(u.created_at).getTime() > ageCutoff) return false
      return (evalCountByEmail[u.email] ?? 0) <= maxEvals
    })
    .map((u: any) => u.email)
}

// ── Programación por día ────────────────────────────────────────────────
// Vercel Hobby corre crons una vez al día, a hora fija — no se puede elegir
// hora exacta. Se guarda solo el día; el cron diario (runScheduledBulkEmails)
// decide la hora real de envío y recalcula la audiencia al momento de
// disparar, no al momento de programar, para no mandarle el correo a alguien
// que ya pagó o dejó de calificar el filtro entre medio.

export async function listScheduledEmails(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { data, error } = await supabaseAdmin
    .from('scheduled_emails')
    .select('*')
    .eq('bulk_email_id', req.params.id)
    .order('send_date', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ scheduled: data ?? [] })
}

export async function createScheduledEmail(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { send_date, max_evals } = req.body ?? {}
  if (!send_date || !/^\d{4}-\d{2}-\d{2}$/.test(send_date)) return res.status(400).json({ error: 'Fecha inválida' })
  const maxEvals = Number.isFinite(max_evals) ? Number(max_evals) : 1

  const { data, error } = await supabaseAdmin
    .from('scheduled_emails')
    .insert({ bulk_email_id: req.params.id, send_date, max_evals: maxEvals })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json({ scheduled: data })
}

export async function deleteScheduledEmail(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { error } = await supabaseAdmin.from('scheduled_emails').delete().eq('id', req.params.id).eq('status', 'pending')
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}

// Vercel Cron (diario) — mismo mecanismo de auth que los crons de subscriptionController
export async function runScheduledBulkEmails(req: Request, res: Response) {
  const secret = process.env.CRON_SECRET
  const authorized = secret && (req.headers['authorization'] === `Bearer ${secret}` || req.query.key === secret)
  if (!authorized) return res.status(401).json({ error: 'No autorizado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const today = new Date().toISOString().slice(0, 10)
  const { data: due, error } = await supabaseAdmin
    .from('scheduled_emails')
    .select('*')
    .eq('status', 'pending')
    .lte('send_date', today)
  if (error) return res.status(500).json({ error: error.message })

  const results: any[] = []
  for (const row of due ?? []) {
    try {
      const { data: bulkEmail } = await supabaseAdmin.from('bulk_emails').select('*').eq('id', row.bulk_email_id).single()
      if (!bulkEmail) throw new Error('Correo asociado no existe')
      const emails = await loadTrialCandidates(row.max_evals)
      const result = await sendBulkEmailBatch(bulkEmail.id, bulkEmail, emails)
      await supabaseAdmin.from('scheduled_emails').update({ status: 'sent', sent_at: new Date().toISOString(), result }).eq('id', row.id)
      results.push({ id: row.id, ...result })
    } catch (err: unknown) {
      const message = (err as Error).message || 'Error desconocido'
      await supabaseAdmin.from('scheduled_emails').update({ status: 'failed', sent_at: new Date().toISOString(), result: { error: message } }).eq('id', row.id)
      results.push({ id: row.id, error: message })
    }
  }

  console.log('[bulk-email run-scheduled]', JSON.stringify(results))
  res.json({ processed: results.length, results })
}
