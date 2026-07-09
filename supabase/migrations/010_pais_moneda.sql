-- Internacionalización: país/moneda explícitos por oferta evaluada.
-- Backfill 'CLP' para filas existentes (todas eran chilenas antes de esto),
-- así la UI vieja sigue mostrando lo mismo sin cambios.

ALTER TABLE tracker_entries ADD COLUMN IF NOT EXISTS pais   TEXT;
ALTER TABLE tracker_entries ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'CLP';

ALTER TABLE applications ADD COLUMN IF NOT EXISTS pais   TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'CLP';

UPDATE tracker_entries SET moneda = 'CLP' WHERE moneda IS NULL;
UPDATE applications SET moneda = 'CLP' WHERE moneda IS NULL;

NOTIFY pgrst, 'reload schema';
