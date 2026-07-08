-- Ampliación del estudio de mercado salarial:
-- 1) Anclas por nivel de seniority (antes una sola ancla general por carrera+país).
-- 2) Persistir el salario estimado en la evaluación de oferta (tracker_entries),
--    para no tener que recalcularlo después en Postulaciones.

ALTER TABLE salary_anchors    ADD COLUMN IF NOT EXISTS nivel TEXT;
ALTER TABLE tracker_entries   ADD COLUMN IF NOT EXISTS salario_clp TEXT;
ALTER TABLE tracker_entries   ADD COLUMN IF NOT EXISTS salario_usd TEXT;

NOTIFY pgrst, 'reload schema';
