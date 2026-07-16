-- Módulo "Correos masivos" del Panel de Admin: registro de envíos por campaña
-- para no reenviar el mismo correo a un usuario que ya lo recibió (protege
-- contra doble clic o reintentos). Solo lo ve el ADMIN_EMAIL (mismo gate que
-- salary_anchors / internal_reports).

CREATE TABLE IF NOT EXISTS bulk_email_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign   TEXT NOT NULL,
  email      TEXT NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bulk_email_log_campaign_email ON bulk_email_log(campaign, email);

NOTIFY pgrst, 'reload schema';
