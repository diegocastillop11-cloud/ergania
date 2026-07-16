-- Generaliza "Correos masivos": de una campaña hardcodeada en código a
-- correos guardados y editables desde el panel, con envío manual o
-- programado por día (no por hora exacta — Vercel Hobby solo corre crons
-- una vez al día, ver /api/admin/bulk-email/run-scheduled).

CREATE TABLE IF NOT EXISTS bulk_emails (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      TEXT NOT NULL,
  asunto      TEXT NOT NULL,
  cuerpo      TEXT NOT NULL DEFAULT '',
  cta1_texto  TEXT,
  cta1_url    TEXT,
  cta2_texto  TEXT,
  cta2_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS bulk_emails_updated_at ON bulk_emails;
CREATE TRIGGER bulk_emails_updated_at
  BEFORE UPDATE ON bulk_emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- bulk_email_log.campaign (migración 019) ahora guarda el id (uuid como
-- texto) del bulk_email correspondiente, no un string hardcodeado — la
-- columna ya era TEXT así que no requiere cambio de tipo.

CREATE TABLE IF NOT EXISTS scheduled_emails (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_email_id UUID NOT NULL REFERENCES bulk_emails(id) ON DELETE CASCADE,
  send_date     DATE NOT NULL,
  max_evals     INT NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at       TIMESTAMPTZ,
  result        JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_pending ON scheduled_emails(status, send_date);

-- Seed: el correo de activación que ya estaba hardcodeado en emailService.ts,
-- ahora como fila editable.
INSERT INTO bulk_emails (titulo, asunto, cuerpo, cta1_texto, cta1_url, cta2_texto, cta2_url) VALUES
('Correo de activación — trial con poco uso',
 'Tu búsqueda de trabajo puede ir más rápido — Ergania',
 E'Notamos que aún no le has sacado todo el jugo a Ergania. Con tu cuenta puedes:\n\n- Evaluar cualquier oferta con IA y ver qué tan buen match eres\n- Estimar la renta esperada antes de postular\n- Optimizar tu CV y carta de presentación para cada oferta\n- Postular y hacer seguimiento de todo en un solo lugar\n\nSi no sabes por dónde partir, el tutorial de 6 pasos te muestra exactamente qué hacer.',
 'Aprende a usar Ergania', 'https://ergania.com/dashboard?guide=1',
 'Ir directo a mi cuenta →', 'https://ergania.com/dashboard');

NOTIFY pgrst, 'reload schema';
