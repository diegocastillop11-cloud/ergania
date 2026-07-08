-- Anclas salariales curadas manualmente desde el panel Admin, usadas como
-- referencia para la recomendación de "cuánto debería cobrar" (IA ajusta
-- el rango final usando esta ancla como contexto, no como el resultado final).

CREATE TABLE IF NOT EXISTS salary_anchors (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  carrera     TEXT        NOT NULL,
  pais        TEXT        NOT NULL,
  rango_min   INTEGER     NOT NULL,
  rango_max   INTEGER     NOT NULL,
  moneda      TEXT        NOT NULL DEFAULT 'CLP',
  nota        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salary_anchors_carrera_pais ON salary_anchors(carrera, pais);

DROP TRIGGER IF EXISTS salary_anchors_updated_at ON salary_anchors;
CREATE TRIGGER salary_anchors_updated_at
  BEFORE UPDATE ON salary_anchors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
