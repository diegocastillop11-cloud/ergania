-- Agrega PayPal como segundo medio de pago (en paralelo a MercadoPago) para
-- usuarios fuera de LATAM que hoy no pueden pagar con MP. A diferencia de MP
-- (pago único repetido a mano), PayPal Subscriptions cobra automático cada mes.

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'mercadopago';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paypal_payer_email TEXT;

ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'mercadopago';
ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT;

NOTIFY pgrst, 'reload schema';
