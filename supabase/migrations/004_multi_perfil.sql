-- Multi-perfil: un usuario puede tener N perfiles (ej: "Contador", "Abogado"),
-- cada uno con su propio profile (datos) y CV. El perfil activo se marca en DB
-- para que todos los endpoints existentes sigan funcionando sin cambios.

CREATE TABLE IF NOT EXISTS perfiles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  TEXT        NOT NULL,
  nombre      TEXT        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perfiles_user ON perfiles(user_email);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS perfil_id UUID;
ALTER TABLE cvs      ADD COLUMN IF NOT EXISTS perfil_id UUID;

-- Backfill: cada usuario existente recibe un perfil "Principal" activo
INSERT INTO perfiles (user_email, nombre, is_active)
SELECT u.user_email, 'Principal', true
FROM (SELECT user_email FROM profiles UNION SELECT user_email FROM cvs) u
WHERE NOT EXISTS (SELECT 1 FROM perfiles p WHERE p.user_email = u.user_email);

UPDATE profiles pr
SET perfil_id = (SELECT id FROM perfiles pe WHERE pe.user_email = pr.user_email ORDER BY created_at LIMIT 1)
WHERE pr.perfil_id IS NULL;

UPDATE cvs c
SET perfil_id = (SELECT id FROM perfiles pe WHERE pe.user_email = c.user_email ORDER BY created_at LIMIT 1)
WHERE c.perfil_id IS NULL;

-- PK compuesta: permite N filas por usuario (una por perfil)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_pkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_email, perfil_id);
ALTER TABLE cvs DROP CONSTRAINT IF EXISTS cvs_pkey;
ALTER TABLE cvs ADD CONSTRAINT cvs_pkey PRIMARY KEY (user_email, perfil_id);
