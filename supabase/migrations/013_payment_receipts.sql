-- Comprobante de pago informal (NO es boleta electrónica del SII — Ergania está
-- en trámite de formalización como SPA). Un registro por cada pago aprobado por
-- MercadoPago, con el monto REAL (antes el admin mostraba $9.990 hardcodeado).
-- Diseñado para migrar limpio a boleta real más adelante: 1 pago = 1 fila acá =
-- 1 futura boleta con folio SII, sin tener que rehacer el modelo de datos.

CREATE TABLE IF NOT EXISTS payment_receipts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  user_email    TEXT NOT NULL,
  monto         NUMERIC NOT NULL,
  moneda        TEXT NOT NULL DEFAULT 'CLP',
  plan          TEXT NOT NULL DEFAULT 'Ergania — Plan mensual',
  mp_payment_id TEXT,
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  email_sent    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_receipts_user ON payment_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_fecha ON payment_receipts(fecha DESC);

NOTIFY pgrst, 'reload schema';
