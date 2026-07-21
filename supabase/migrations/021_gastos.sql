-- Módulo "Planilla de gastos" del Panel de Admin: reemplaza los PDFs/Word
-- sueltos (ej. Ergania_Reporte_Hosting.pdf) como fuente única de gastos del
-- negocio (hosting, APIs de IA, pasarelas de pago, marketing, legal). Sin
-- upload de archivos por ahora — el comprobante es un link (Drive u otro)
-- para no depender de Supabase Storage, que hoy no está configurado en el
-- proyecto (decisión del triage 2026-07-20, ver /abogado-del-diablo).

CREATE TABLE IF NOT EXISTS gastos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monto           NUMERIC NOT NULL,
  moneda          TEXT NOT NULL DEFAULT 'CLP',
  categoria       TEXT NOT NULL CHECK (categoria IN (
                    'hosting_infra', 'apis_ia', 'pagos_suscripciones',
                    'marketing', 'legal_contable', 'otro'
                  )),
  descripcion     TEXT NOT NULL DEFAULT '',
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  comprobante_url TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha DESC);

DROP TRIGGER IF EXISTS gastos_updated_at ON gastos;
CREATE TRIGGER gastos_updated_at
  BEFORE UPDATE ON gastos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
