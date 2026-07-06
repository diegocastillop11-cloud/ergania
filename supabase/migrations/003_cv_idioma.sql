-- Idioma del CV generado por postulación ('es' | 'en').
-- Detectado automáticamente del JD o elegido por el usuario con el botón "cambiar idioma".
ALTER TABLE applications ADD COLUMN IF NOT EXISTS idioma text;
