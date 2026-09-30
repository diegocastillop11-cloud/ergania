-- Diagnóstico del CV generado por oferta: keywords del JD que no se incorporaron por falta
-- de evidencia y afirmaciones que el candidato debe confirmar. El backend lo guarda en un
-- update aparte y tolerante a fallos, así que el deploy funciona antes de correr esto.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS "cvDiagnostico" jsonb;
