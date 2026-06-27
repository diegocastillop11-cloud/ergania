-- ============================================================
-- Career Ops UI — Schema completo
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- Trigger helper (reutilizable)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── tracker_entries ──────────────────────────────────────────────────────────
-- Una fila por oferta evaluada/postulada
CREATE TABLE IF NOT EXISTS tracker_entries (
  id          TEXT        NOT NULL,
  user_email  TEXT        NOT NULL DEFAULT 'local@careerops.local',
  fecha       DATE        NOT NULL DEFAULT CURRENT_DATE,
  empresa     TEXT        NOT NULL DEFAULT '',
  rol         TEXT        NOT NULL DEFAULT '',
  score       NUMERIC(3,1),
  estado      TEXT        NOT NULL DEFAULT 'Evaluada',
  pdf         BOOLEAN     NOT NULL DEFAULT FALSE,
  report_slug TEXT,
  url         TEXT        NOT NULL DEFAULT '',
  notas       TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_email, id)
);

DROP TRIGGER IF EXISTS tracker_entries_updated_at ON tracker_entries;
CREATE TRIGGER tracker_entries_updated_at
  BEFORE UPDATE ON tracker_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_tracker_user    ON tracker_entries(user_email);
CREATE INDEX IF NOT EXISTS idx_tracker_estado  ON tracker_entries(estado);
CREATE INDEX IF NOT EXISTS idx_tracker_fecha   ON tracker_entries(fecha DESC);

-- ── pipeline_jobs ────────────────────────────────────────────────────────────
-- URLs pendientes de evaluar
CREATE TABLE IF NOT EXISTS pipeline_jobs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  TEXT        NOT NULL DEFAULT 'local@careerops.local',
  url         TEXT        NOT NULL,
  added       DATE        NOT NULL DEFAULT CURRENT_DATE,
  source      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_email, url)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_user ON pipeline_jobs(user_email);

-- ── applications ─────────────────────────────────────────────────────────────
-- Postulaciones con CV generado
CREATE TABLE IF NOT EXISTS applications (
  id              TEXT        NOT NULL,
  user_email      TEXT        NOT NULL DEFAULT 'local@careerops.local',
  fecha           DATE        NOT NULL DEFAULT CURRENT_DATE,
  empresa         TEXT        NOT NULL DEFAULT '',
  rol             TEXT        NOT NULL DEFAULT '',
  url             TEXT        NOT NULL DEFAULT '',
  jd              TEXT        NOT NULL DEFAULT '',
  "cvHtml"        TEXT,
  "cvTex"         TEXT,
  "cvPdfFilename" TEXT,
  estado          TEXT        NOT NULL DEFAULT 'Evaluada',
  score           NUMERIC(3,1),
  notas           TEXT        NOT NULL DEFAULT '',
  "interviewPrep" TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_email, id)
);

DROP TRIGGER IF EXISTS applications_updated_at ON applications;
CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_applications_user   ON applications(user_email);
CREATE INDEX IF NOT EXISTS idx_applications_fecha  ON applications(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_applications_estado ON applications(estado);

-- ── reports ──────────────────────────────────────────────────────────────────
-- Reportes markdown de evaluación de Claude
CREATE TABLE IF NOT EXISTS reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  TEXT        NOT NULL DEFAULT 'local@careerops.local',
  slug        TEXT        NOT NULL,
  content     TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_email, slug)
);

DROP TRIGGER IF EXISTS reports_updated_at ON reports;
CREATE TRIGGER reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_email);

-- ── profiles ──────────────────────────────────────────────────────────────────
-- profile.yml serializado como JSONB
CREATE TABLE IF NOT EXISTS profiles (
  user_email  TEXT        PRIMARY KEY,
  data        JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── cvs ───────────────────────────────────────────────────────────────────────
-- cv.md como texto
CREATE TABLE IF NOT EXISTS cvs (
  user_email  TEXT        PRIMARY KEY,
  content     TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS cvs_updated_at ON cvs;
CREATE TRIGGER cvs_updated_at
  BEFORE UPDATE ON cvs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── portals_config ────────────────────────────────────────────────────────────
-- portals.yml serializado como JSONB
CREATE TABLE IF NOT EXISTS portals_config (
  user_email  TEXT        PRIMARY KEY,
  config      JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS portals_config_updated_at ON portals_config;
CREATE TRIGGER portals_config_updated_at
  BEFORE UPDATE ON portals_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
