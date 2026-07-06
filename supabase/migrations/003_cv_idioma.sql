-- Idioma detectado de la oferta ('es' | 'en').
-- Se detecta al evaluar (tracker_entries) y se propaga a la postulación (applications).
-- El usuario puede cambiarlo con los botones de idioma en CV, entrevista, preguntas y carta.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS idioma text;
ALTER TABLE tracker_entries ADD COLUMN IF NOT EXISTS idioma text;
