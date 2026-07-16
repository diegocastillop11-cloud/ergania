-- Migra MercadoPago de Checkout Pro (pago único repetido a mano) a Preapproval
-- (cobro automático recurrente). Se hace ahora porque todavía no hay usuarios
-- pagando — cero riesgo de migración sobre suscripciones activas.

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS mp_preapproval_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_suspended BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
