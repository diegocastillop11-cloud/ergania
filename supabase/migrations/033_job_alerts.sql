-- Alertas diarias de ofertas nuevas por correo (opt-in, desactivadas por defecto).
-- Una fila por usuario; seen_urls evita repetir ofertas ya enviadas y unsubscribe_token
-- permite darse de baja desde el correo sin iniciar sesión.
-- Rollback: DROP TABLE job_alerts;
CREATE TABLE IF NOT EXISTS job_alerts (
  user_email text PRIMARY KEY,
  user_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  seen_urls text[] NOT NULL DEFAULT '{}',
  last_sent_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS job_alerts_token_idx ON job_alerts (unsubscribe_token);
-- Solo el backend (service role) accede; sin policies = ningún acceso desde el cliente.
ALTER TABLE job_alerts ENABLE ROW LEVEL SECURITY;
