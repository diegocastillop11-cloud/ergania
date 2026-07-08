-- Persistir el salario estimado en la postulación cuando viene de una oferta
-- ya evaluada (Tracker), para no tener que recalcularlo en Postulaciones.

ALTER TABLE applications ADD COLUMN IF NOT EXISTS salario_clp TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS salario_usd TEXT;

NOTIFY pgrst, 'reload schema';
