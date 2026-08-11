-- Variables de los correos masivos (módulo "Variables" del panel Admin).
--
-- Los merge fields calculados ({{nombre}}, {{monto}}, {{proxima_renovacion}}…)
-- siguen viviendo en código: dependen de queries por destinatario, no de un
-- valor fijo. Esta tabla es solo para las variables de valor fijo que Diego
-- quiera definir sin tocar código (precio, correo de soporte, nombre de una
-- promo), para no repetirlas a mano en cada correo.
CREATE TABLE IF NOT EXISTS email_variables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave       TEXT NOT NULL UNIQUE,
  valor       TEXT NOT NULL DEFAULT '',
  descripcion TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS email_variables_updated_at ON email_variables;
CREATE TRIGGER email_variables_updated_at
  BEFORE UPDATE ON email_variables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- `titulo` es el nombre interno de la campaña ("Win-back (reconquista)") y se
-- estaba imprimiendo como primera línea del correo, así que el usuario final
-- veía la jerga interna. Ahora el encabezado visible es una columna aparte y
-- opcional: si está vacía, el correo parte directo en el cuerpo.
ALTER TABLE bulk_emails ADD COLUMN IF NOT EXISTS encabezado TEXT;

NOTIFY pgrst, 'reload schema';
