-- Agrega versión no-técnica del CV a la tabla applications
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS "cvHtmlNonTech"        TEXT,
  ADD COLUMN IF NOT EXISTS "cvPdfFilenameNonTech"  TEXT;
