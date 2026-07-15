-- Notificación de nuevo usuario pasa de "1 email por registro" a un digest diario
-- (Resend gratis limita a 100 emails/día — con más usuarios, notificar cada
-- registro individualmente compite por ese cupo con emails que sí importan:
-- confirmaciones de pago, respuestas de contacto, recordatorios de vencimiento).
-- NULL = todavía no incluido en ningún digest enviado.

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS signup_notified_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
