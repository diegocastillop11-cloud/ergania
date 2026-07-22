-- Registro de descargas del APK de Android (botón en Landing y en el banner
-- del dashboard) para poder mostrar un contador en el panel Admin.

CREATE TABLE IF NOT EXISTS apk_downloads (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_apk_downloads_created_at ON apk_downloads(created_at DESC);

NOTIFY pgrst, 'reload schema';
