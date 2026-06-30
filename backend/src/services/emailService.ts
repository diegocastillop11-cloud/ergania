const RESEND_API = 'https://api.resend.com/emails'
const FROM_EMAIL = 'Ergania <onboarding@resend.dev>'
const ADMIN_EMAIL = 'ergania.ai@gmail.com'

async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[email] RESEND_API_KEY no configurada — email no enviado')
    return
  }
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error('[email] Resend error:', res.status, text)
  }
}

export async function sendContactEmail(name: string, email: string, category: string, message: string) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#1a1a1a;border-bottom:2px solid #C4633A;padding-bottom:8px;">
        Nuevo contacto — ${category}
      </h2>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 0;color:#666;width:120px;"><strong>Nombre</strong></td><td style="padding:8px 0;">${name}</td></tr>
        <tr><td style="padding:8px 0;color:#666;"><strong>Email</strong></td><td style="padding:8px 0;"><a href="mailto:${email}">${email}</a></td></tr>
        <tr><td style="padding:8px 0;color:#666;"><strong>Categoría</strong></td><td style="padding:8px 0;">${category}</td></tr>
      </table>
      <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin-top:8px;">
        <p style="margin:0;white-space:pre-wrap;color:#333;">${message}</p>
      </div>
      <p style="font-size:12px;color:#999;margin-top:24px;">Ergania · ${new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</p>
    </div>
  `
  await sendEmail(ADMIN_EMAIL, `[Ergania Contacto] ${category} — ${name}`, html)
}

export async function sendPaymentNotification(
  userId: string,
  paymentId: string,
  amount: number,
  payerEmail: string,
) {
  const date = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#16a34a;border-bottom:2px solid #16a34a;padding-bottom:8px;">
        ✅ Nuevo pago recibido
      </h2>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 0;color:#666;width:140px;"><strong>Fecha</strong></td><td style="padding:8px 0;">${date}</td></tr>
        <tr><td style="padding:8px 0;color:#666;"><strong>Monto</strong></td><td style="padding:8px 0;font-size:20px;font-weight:bold;color:#16a34a;">$${amount.toLocaleString('es-CL')} CLP</td></tr>
        <tr><td style="padding:8px 0;color:#666;"><strong>Email pagador</strong></td><td style="padding:8px 0;">${payerEmail}</td></tr>
        <tr><td style="padding:8px 0;color:#666;"><strong>User ID</strong></td><td style="padding:8px 0;font-family:monospace;font-size:12px;">${userId}</td></tr>
        <tr><td style="padding:8px 0;color:#666;"><strong>Payment ID</strong></td><td style="padding:8px 0;font-family:monospace;font-size:12px;">${paymentId}</td></tr>
      </table>
      <p style="font-size:12px;color:#999;margin-top:24px;">Ergania · Notificación automática de pago</p>
    </div>
  `
  await sendEmail(ADMIN_EMAIL, `[Ergania] Pago recibido — $${amount.toLocaleString('es-CL')} CLP`, html)
}
