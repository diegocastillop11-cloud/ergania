import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import * as svc from '../services/careerOpsService'

const ADMIN_EMAIL = 'ergania.ai@gmail.com'

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

export async function getStats(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Acceso denegado' })
  }

  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const [usersRes, subsRes, messagesRes, receiptsRes] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin.from('subscriptions').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('contact_messages').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('payment_receipts').select('*').order('fecha', { ascending: false }),
  ])

  const users = usersRes.data?.users ?? []
  const subs  = subsRes.data ?? []
  const msgs  = messagesRes.data ?? []
  const receipts = receiptsRes.data ?? []

  const subsByUserId = Object.fromEntries(subs.map((s: any) => [s.user_id, s]))

  const userList = users.map((u: any) => ({
    id:        u.id,
    email:     u.email,
    createdAt: u.created_at,
    sub:       subsByUserId[u.id] ?? null,
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

export async function downloadReportPdf(req: Request, res: Response) {
  const user = await getAdminUser(req)
  if (!user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acceso denegado' })
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
  if (!user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acceso denegado' })
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
  if (!user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acceso denegado' })
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

export async function setUserTestFlag(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || admin.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const { isTest } = req.body ?? {}
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({ is_test: !!isTest })
    .eq('user_id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}

export async function deleteUser(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || admin.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const targetId = req.params.id
  if (targetId === admin.id) return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de administrador' })

  await supabaseAdmin.from('subscriptions').delete().eq('user_id', targetId)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(targetId)
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
