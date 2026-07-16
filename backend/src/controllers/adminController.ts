import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import * as svc from '../services/careerOpsService'

const ADMIN_EMAILS = ['ergania.ai@gmail.com', 'diego.castillop11@gmail.com', 'emesmediacontact@gmail.com']
function isAdmin(email: string | undefined | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email)
}

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
  if (!user || !isAdmin(user.email)) {
    return res.status(403).json({ error: 'Acceso denegado' })
  }

  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const [usersRes, subsRes, messagesRes, receiptsRes, trackerRes] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin.from('subscriptions').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('contact_messages').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('payment_receipts').select('*').order('fecha', { ascending: false }),
    supabaseAdmin.from('tracker_entries').select('user_email'),
  ])

  const users = usersRes.data?.users ?? []
  const subs  = subsRes.data ?? []
  const msgs  = messagesRes.data ?? []
  const receipts = receiptsRes.data ?? []

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

  try {
    const { sendContactReply } = await import('../services/emailService')
    await sendContactReply(msg.email, msg.name, reply.trim())
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message || 'No se pudo enviar el correo' })
  }

  const { error } = await supabaseAdmin
    .from('contact_messages')
    .update({ replied_at: new Date().toISOString(), reply_text: reply.trim() })
    .eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })

  res.json({ ok: true })
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

export async function deleteUser(req: Request, res: Response) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdmin(admin.email)) return res.status(403).json({ error: 'Acceso denegado' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Sin conexión a base de datos' })

  const targetId = req.params.id
  if (targetId === admin.id) return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de administrador' })

  await supabaseAdmin.from('subscriptions').delete().eq('user_id', targetId)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(targetId)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}

function escBulk(s: string | null | undefined) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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
  titulo: string; cuerpo: string
  cta1_texto: string | null; cta1_url: string | null
  cta2_texto: string | null; cta2_url: string | null
}): string {
  // Estilo deliberadamente "plano" (sin botón con fondo de color, sin header
  // con línea de marca) — un botón tipo marketing es una de las señales que
  // más pesa para que Gmail clasifique el correo como Promociones en vez de
  // Principal. La frase de darte de baja se mantiene: protege ante reportes
  // de spam aunque reste algo de chance de caer en Principal.
  const cta1 = email.cta1_texto && email.cta1_url ? `
      <p style="margin:20px 0;">
        <a href="${escBulk(email.cta1_url)}" style="color:#C4633A;text-decoration:underline;font-weight:bold;">
          ${escBulk(email.cta1_texto)}
        </a>
      </p>` : ''
  const cta2 = email.cta2_texto && email.cta2_url ? `
      <p style="margin:0 0 20px;">
        <a href="${escBulk(email.cta2_url)}" style="color:#C4633A;text-decoration:underline;">
          ${escBulk(email.cta2_texto)}
        </a>
      </p>` : ''
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
      <p style="font-weight:bold;font-size:16px;margin:0 0 16px;">${escBulk(email.titulo)}</p>
      ${renderBulkEmailBody(email.cuerpo)}
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

  const { titulo, asunto, cuerpo, cta1_texto, cta1_url, cta2_texto, cta2_url } = req.body ?? {}
  if (!titulo?.trim() || !asunto?.trim()) return res.status(400).json({ error: 'Título y asunto son requeridos' })

  const { data, error } = await supabaseAdmin
    .from('bulk_emails')
    .insert({
      titulo: titulo.trim(), asunto: asunto.trim(), cuerpo: cuerpo || '',
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

  const { titulo, asunto, cuerpo, cta1_texto, cta1_url, cta2_texto, cta2_url } = req.body ?? {}
  if (!titulo?.trim() || !asunto?.trim()) return res.status(400).json({ error: 'Título y asunto son requeridos' })

  const { error } = await supabaseAdmin
    .from('bulk_emails')
    .update({
      titulo: titulo.trim(), asunto: asunto.trim(), cuerpo: cuerpo || '',
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
  res.json({ subject: data.asunto, html: buildBulkEmailHtml(data) })
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
async function sendBulkEmailBatch(bulkEmailId: string, subject: string, html: string, emails: string[]) {
  if (!supabaseAdmin) throw new Error('Sin conexión a base de datos')

  const { data: already } = await supabaseAdmin
    .from('bulk_email_log')
    .select('email')
    .eq('campaign', bulkEmailId)
    .in('email', emails)
  const alreadySent = new Set((already ?? []).map((r: any) => r.email))

  const { sendEmail } = await import('../services/emailService')
  const sent: string[] = []
  const skipped: string[] = []
  const failed: { email: string; error: string }[] = []

  for (const email of emails) {
    if (alreadySent.has(email)) { skipped.push(email); continue }
    try {
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

  const result = await sendBulkEmailBatch(bulkEmail.id, bulkEmail.asunto, buildBulkEmailHtml(bulkEmail), emails)
  res.json(result)
}

// ── Audiencia: usuarios en trial con pocas ofertas evaluadas ───────────────

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
  return users
    .filter((u: any) => {
      const sub = subsByUserId[u.id]
      if (!sub || sub.status !== 'trial' || sub.is_test) return false
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
      const result = await sendBulkEmailBatch(bulkEmail.id, bulkEmail.asunto, buildBulkEmailHtml(bulkEmail), emails)
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
