-- Guía de entrevista interactiva (reemplaza el markdown plano de "interviewPrep").
--
-- interviewGuide  : JSON estructurado con todas las secciones de la guía. Es la fuente de
--                   verdad; el HTML standalone y el PDF se construyen a partir de él.
-- interviewNotes  : notas que el usuario escribe durante/después de la entrevista. Va
--                   aparte de la guía para que regenerar la guía no le borre las notas.
-- interviewMeta   : datos que el LLM no puede saber (entrevistadores, fecha, hora, link,
--                   tipo de entrevista). Se guardan para no re-preguntarlos al regenerar.
--
-- "interviewPrep" (TEXT) se mantiene: las postulaciones viejas siguen mostrando su guía
-- markdown. No se genera más contenido nuevo en esa columna.

ALTER TABLE applications ADD COLUMN IF NOT EXISTS "interviewGuide" JSONB;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS "interviewNotes" JSONB;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS "interviewMeta"  JSONB;

-- Para reusar la investigación de empresa ya pagada (web_search) entre postulaciones del
-- mismo usuario a la misma empresa, sin gastar una consulta nueva.
CREATE INDEX IF NOT EXISTS idx_applications_user_empresa
  ON applications(user_email, empresa);
