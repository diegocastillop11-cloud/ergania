-- Trazabilidad de perfil en el Tracker: hoy tracker_entries no tiene perfil_id,
-- así que con múltiples perfiles activos no se sabe con cuál se evaluó/postuló
-- cada oferta. Se agrega perfil_id y se backfillea con el perfil más antiguo
-- de cada usuario (equivalente al patrón de 004_multi_perfil.sql) para no
-- perder la asociación de las entradas ya existentes.

ALTER TABLE tracker_entries ADD COLUMN IF NOT EXISTS perfil_id UUID REFERENCES perfiles(id);

UPDATE tracker_entries te
SET perfil_id = (
  SELECT id FROM perfiles pe
  WHERE pe.user_email = te.user_email
  ORDER BY pe.created_at ASC
  LIMIT 1
)
WHERE perfil_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tracker_entries_perfil ON tracker_entries(perfil_id);

NOTIFY pgrst, 'reload schema';
