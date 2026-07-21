-- Adjuntos reales (contratos, comprobantes, fotos) para cada gasto — el link
-- externo de la migración anterior (021) sigue existiendo para quien prefiera
-- apuntar a un Drive, pero ahora también se puede subir el archivo directo.
--
-- Bucket privado, SIN políticas de storage.objects: todo el acceso (subida,
-- descarga, borrado) pasa por el backend con la service role key, igual que
-- el resto de las tablas de este proyecto — el frontend nunca habla con
-- Supabase Storage directo. Evita tener que mantener políticas de RLS a mano.
INSERT INTO storage.buckets (id, name, public)
VALUES ('gastos-comprobantes', 'gastos-comprobantes', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS gasto_archivos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gasto_id        UUID NOT NULL REFERENCES gastos(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,
  nombre_original TEXT NOT NULL,
  mime_type       TEXT,
  size_bytes      BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gasto_archivos_gasto ON gasto_archivos(gasto_id);

NOTIFY pgrst, 'reload schema';
