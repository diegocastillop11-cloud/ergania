-- Extiende multi-perfil a "Mi Búsqueda" (config de cargos/skills/exclusiones)
-- y al Escáner (cola de resultados), para que cada perfil tenga su propia
-- configuración de búsqueda y sus propios resultados encontrados.

CREATE TABLE IF NOT EXISTS perfil_portals (
  user_email  TEXT        NOT NULL,
  perfil_id   UUID        NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  config      JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_email, perfil_id)
);

DROP TRIGGER IF EXISTS perfil_portals_updated_at ON perfil_portals;
CREATE TRIGGER perfil_portals_updated_at
  BEFORE UPDATE ON perfil_portals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO perfil_portals (user_email, perfil_id, config)
SELECT pc.user_email,
       (SELECT id FROM perfiles pe WHERE pe.user_email = pc.user_email ORDER BY created_at LIMIT 1),
       pc.config
FROM portals_config pc
WHERE EXISTS (SELECT 1 FROM perfiles pe WHERE pe.user_email = pc.user_email)
ON CONFLICT (user_email, perfil_id) DO NOTHING;

-- pipeline_jobs: agregar perfil_id (nullable temporalmente para el backfill)
ALTER TABLE pipeline_jobs ADD COLUMN IF NOT EXISTS perfil_id UUID REFERENCES perfiles(id) ON DELETE CASCADE;

UPDATE pipeline_jobs pj
SET perfil_id = (SELECT id FROM perfiles pe WHERE pe.user_email = pj.user_email ORDER BY created_at LIMIT 1)
WHERE pj.perfil_id IS NULL
  AND EXISTS (SELECT 1 FROM perfiles pe WHERE pe.user_email = pj.user_email);

-- Job huérfano (usuario sin perfil aún, no debería ocurrir tras la migración 004): eliminar
DELETE FROM pipeline_jobs WHERE perfil_id IS NULL;

ALTER TABLE pipeline_jobs ALTER COLUMN perfil_id SET NOT NULL;
ALTER TABLE pipeline_jobs DROP CONSTRAINT IF EXISTS pipeline_jobs_user_email_url_key;
ALTER TABLE pipeline_jobs ADD CONSTRAINT pipeline_jobs_user_perfil_url_key UNIQUE (user_email, perfil_id, url);

NOTIFY pgrst, 'reload schema';
