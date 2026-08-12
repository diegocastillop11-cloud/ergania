-- Registro de reproducciones del video demo (sección de la landing y banner del
-- dashboard) para mostrar un contador en el panel Admin, al lado de las descargas
-- del APK. Mismo diseño que apk_downloads (024).
--
-- "source" distingue de dónde salió la reproducción: 'landing' son visitantes que
-- todavía no se registran, 'dashboard' son usuarios ya dentro de la app. Sin eso el
-- contador mezcla dos comportamientos muy distintos.

CREATE TABLE IF NOT EXISTS video_plays (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source     TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_video_plays_created_at ON video_plays(created_at DESC);

NOTIFY pgrst, 'reload schema';
