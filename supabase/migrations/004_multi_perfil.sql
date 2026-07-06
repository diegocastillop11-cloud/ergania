-- Multi-perfil: un usuario puede tener N perfiles (ej: "Contador", "Abogado"),
-- cada uno con sus datos y su CV. El perfil activo se marca en DB para que
-- todos los endpoints existentes sigan funcionando sin cambios.
--
-- Se usan tablas NUEVAS (perfil_profiles / perfil_cvs) en lugar de alterar la PK
-- de profiles/cvs: la base es compartida entre preview y producción, y el código
-- de producción sigue escribiendo en las tablas viejas hasta que esta feature se
-- mergee. Las tablas viejas quedan como legacy (eliminables después).

CREATE TABLE IF NOT EXISTS perfiles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  TEXT        NOT NULL,
  nombre      TEXT        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perfiles_user ON perfiles(user_email);

CREATE TABLE IF NOT EXISTS perfil_profiles (
  user_email  TEXT        NOT NULL,
  perfil_id   UUID        NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  data        JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_email, perfil_id)
);

CREATE TABLE IF NOT EXISTS perfil_cvs (
  user_email  TEXT        NOT NULL,
  perfil_id   UUID        NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_email, perfil_id)
);

DROP TRIGGER IF EXISTS perfil_profiles_updated_at ON perfil_profiles;
CREATE TRIGGER perfil_profiles_updated_at
  BEFORE UPDATE ON perfil_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS perfil_cvs_updated_at ON perfil_cvs;
CREATE TRIGGER perfil_cvs_updated_at
  BEFORE UPDATE ON perfil_cvs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Backfill: cada usuario existente recibe un perfil "Principal" activo
INSERT INTO perfiles (user_email, nombre, is_active)
SELECT u.user_email, 'Principal', true
FROM (SELECT user_email FROM profiles UNION SELECT user_email FROM cvs) u
WHERE NOT EXISTS (SELECT 1 FROM perfiles p WHERE p.user_email = u.user_email);

-- Copiar datos existentes al perfil Principal
INSERT INTO perfil_profiles (user_email, perfil_id, data)
SELECT pr.user_email,
       (SELECT id FROM perfiles pe WHERE pe.user_email = pr.user_email ORDER BY created_at LIMIT 1),
       pr.data
FROM profiles pr
ON CONFLICT (user_email, perfil_id) DO NOTHING;

INSERT INTO perfil_cvs (user_email, perfil_id, content)
SELECT c.user_email,
       (SELECT id FROM perfiles pe WHERE pe.user_email = c.user_email ORDER BY created_at LIMIT 1),
       c.content
FROM cvs c
ON CONFLICT (user_email, perfil_id) DO NOTHING;
