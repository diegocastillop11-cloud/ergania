-- Preguntas frecuentes editables desde el panel Admin, mostradas en la
-- página pública /preguntas (ver módulo "Preguntas frecuentes" en Admin).

CREATE TABLE IF NOT EXISTS faqs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question    TEXT        NOT NULL,
  answer      TEXT        NOT NULL,
  order_index INTEGER     NOT NULL DEFAULT 0,
  published   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faqs_published_order ON faqs(published, order_index);

DROP TRIGGER IF EXISTS faqs_updated_at ON faqs;
CREATE TRIGGER faqs_updated_at
  BEFORE UPDATE ON faqs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
