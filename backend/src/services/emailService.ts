const RESEND_API = 'https://api.resend.com/emails'
// EMAIL_FROM requiere dominio verificado en Resend; el fallback resend.dev solo envía al dueño de la cuenta
const FROM_EMAIL = () => process.env.EMAIL_FROM || 'Ergania <onboarding@resend.dev>'
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
    body: JSON.stringify({ from: FROM_EMAIL(), to: [to], reply_to: ADMIN_EMAIL, subject, html }),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error('[email] Resend error:', res.status, text)
    throw new Error(`Resend error ${res.status}: ${text}`)
  }
}


export async function sendNewUsersDigest(users: { email: string; createdAt: string }[]) {
  const rows = users.map(u => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #eee;"><a href="mailto:${u.email}">${u.email}</a></td>
      <td style="padding:6px 0;border-bottom:1px solid #eee;color:#666;font-size:12px;">${new Date(u.createdAt).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</td>
    </tr>`).join('')
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#2563eb;border-bottom:2px solid #2563eb;padding-bottom:8px;">
        🎉 ${users.length} usuario${users.length === 1 ? '' : 's'} nuevo${users.length === 1 ? '' : 's'} registrado${users.length === 1 ? '' : 's'}
      </h2>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><th style="text-align:left;font-size:11px;color:#999;text-transform:uppercase;padding-bottom:6px;">Email</th><th style="text-align:left;font-size:11px;color:#999;text-transform:uppercase;padding-bottom:6px;">Registro</th></tr>
        ${rows}
      </table>
      <p style="font-size:12px;color:#999;margin-top:24px;">Ergania · Resumen diario de registros</p>
    </div>
  `
  await sendEmail(ADMIN_EMAIL, `[Ergania] ${users.length} usuario${users.length === 1 ? '' : 's'} nuevo${users.length === 1 ? '' : 's'} registrado${users.length === 1 ? '' : 's'}`, html)
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

export async function sendContactReply(to: string, name: string, replyText: string) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#1a1a1a;border-bottom:2px solid #C4633A;padding-bottom:8px;">
        Respuesta a tu mensaje — Ergania
      </h2>
      <p style="color:#333;">Hola ${name},</p>
      <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin-top:8px;">
        <p style="margin:0;white-space:pre-wrap;color:#333;">${replyText}</p>
      </div>
      <p style="font-size:12px;color:#999;margin-top:24px;">
        Ergania · Si tienes más dudas, responde directamente a este correo.
      </p>
    </div>
  `
  await sendEmail(to, 'Respuesta a tu mensaje — Ergania', html)
}

export async function sendSubscriptionConfirmation(
  to: string,
  opts: { monto: number; moneda: string; plan: string; fecha: string; paymentId: string },
) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#16a34a;border-bottom:2px solid #16a34a;padding-bottom:8px;">
        🎉 ¡Felicitaciones, estás suscrito a Ergania!
      </h2>
      <p style="color:#333;line-height:1.6;">
        Tu pago fue confirmado y tu cuenta ya tiene acceso completo por 30 días.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 0;color:#666;width:140px;"><strong>Plan</strong></td><td style="padding:8px 0;">${opts.plan}</td></tr>
        <tr><td style="padding:8px 0;color:#666;"><strong>Monto</strong></td><td style="padding:8px 0;font-size:18px;font-weight:bold;color:#16a34a;">$${opts.monto.toLocaleString('es-CL')} ${opts.moneda}</td></tr>
        <tr><td style="padding:8px 0;color:#666;"><strong>Fecha</strong></td><td style="padding:8px 0;">${opts.fecha}</td></tr>
        <tr><td style="padding:8px 0;color:#666;"><strong>ID de pago</strong></td><td style="padding:8px 0;font-family:monospace;font-size:12px;">${opts.paymentId}</td></tr>
      </table>
      <p style="font-size:12px;color:#999;">
        Este correo es tu comprobante de pago (sin validez tributaria). Ergania está en trámite de
        habilitación como emisor electrónico ante el SII — cuando esté lista, recibirás tu boleta
        electrónica oficial por cada pago, incluidos los ya realizados.
      </p>
      <p style="font-size:12px;color:#999;margin-top:24px;">Ergania · Confirmación de suscripción</p>
    </div>
  `
  await sendEmail(to, '🎉 ¡Felicitaciones, estás suscrito a Ergania!', html)
}

export async function sendPaymentNotification(
  userId: string,
  paymentId: string,
  amount: number,
  payerEmail: string,
  moneda: string = 'CLP',
) {
  const date = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })
  const montoFmt = moneda === 'CLP' ? amount.toLocaleString('es-CL') : amount.toLocaleString('en-US')
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#16a34a;border-bottom:2px solid #16a34a;padding-bottom:8px;">
        ✅ Nuevo pago recibido
      </h2>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 0;color:#666;width:140px;"><strong>Fecha</strong></td><td style="padding:8px 0;">${date}</td></tr>
        <tr><td style="padding:8px 0;color:#666;"><strong>Monto</strong></td><td style="padding:8px 0;font-size:20px;font-weight:bold;color:#16a34a;">$${montoFmt} ${moneda}</td></tr>
        <tr><td style="padding:8px 0;color:#666;"><strong>Email pagador</strong></td><td style="padding:8px 0;">${payerEmail}</td></tr>
        <tr><td style="padding:8px 0;color:#666;"><strong>User ID</strong></td><td style="padding:8px 0;font-family:monospace;font-size:12px;">${userId}</td></tr>
        <tr><td style="padding:8px 0;color:#666;"><strong>Payment ID</strong></td><td style="padding:8px 0;font-family:monospace;font-size:12px;">${paymentId}</td></tr>
      </table>
      <p style="font-size:12px;color:#999;margin-top:24px;">Ergania · Notificación automática de pago</p>
    </div>
  `
  await sendEmail(ADMIN_EMAIL, `[Ergania] Pago recibido — $${montoFmt} ${moneda}`, html)
}
