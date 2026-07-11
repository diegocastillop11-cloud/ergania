-- Módulo "Reportes" del Panel de Admin: historial versionado de correcciones,
-- implementaciones y planes futuros — reemplaza los PDFs sueltos como fuente
-- única de verdad para reuniones. Solo lo ve el ADMIN_EMAIL (mismo gate que
-- salary_anchors), sin sistema de roles nuevo (decisión del triage 2026-07-10:
-- el módulo de testing con permisos cross-usuario queda en backlog).

CREATE TABLE IF NOT EXISTS internal_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          TEXT NOT NULL CHECK (tipo IN ('correccion', 'implementacion', 'plan')),
  titulo        TEXT NOT NULL,
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  contenido     TEXT NOT NULL DEFAULT '',
  checklist     JSONB NOT NULL DEFAULT '[]',
  observaciones TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_reports_fecha ON internal_reports(fecha DESC);

DROP TRIGGER IF EXISTS internal_reports_updated_at ON internal_reports;
CREATE TRIGGER internal_reports_updated_at
  BEFORE UPDATE ON internal_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed de prueba: últimas 5 correcciones/implementaciones reales (2026-07-09/10)
INSERT INTO internal_reports (tipo, titulo, fecha, contenido, checklist, observaciones) VALUES
('correccion', 'CV importado: conserva el idioma original', '2026-07-09',
 'parseCv traducía a español cualquier CV subido en otro idioma. Ahora detecta el idioma del CV y lo preserva al extraer headline, resumen y CV completo.',
 '[{"texto":"Subir un CV en inglés y confirmar que no se traduce","marcado":false,"nota":""},{"texto":"Subir un CV en español (control) y confirmar que no cambia","marcado":false,"nota":""}]',
 ''),
('correccion', 'LinkedIn: la optimización ya no se pierde ni se pisa entre perfiles', '2026-07-09',
 'El resultado de "Optimizar Perfil LinkedIn" vivía solo en memoria del navegador y se perdía al cambiar de perfil. Ahora se guarda en el perfil activo y cada perfil mantiene el suyo.',
 '[{"texto":"Generar optimización en un perfil, cambiar de perfil y confirmar que no aparece la del otro","marcado":false,"nota":""},{"texto":"Volver al primer perfil y confirmar que su optimización sigue ahí","marcado":false,"nota":""}]',
 ''),
('correccion', 'Score normalizado a escala 1.0–5.0', '2026-07-09',
 'El score de Evaluar Oferta a veces se mostraba como "6.2/5" (escala inconsistente). Se reforzó el prompt y se agregó un clamp defensivo en el backend.',
 '[{"texto":"Evaluar una oferta y confirmar que el score nunca supera 5.0","marcado":false,"nota":""}]',
 ''),
('implementacion', 'Generador de CV base optimizado + descarga en PDF', '2026-07-09',
 'Nuevo botón "Generar CV con estas instrucciones" en el perfil: aplica las Instrucciones de Redacción al CV base (sin necesitar una postulación), muestra preview y permite descargar PDF o guardarlo como el nuevo CV base.',
 '[{"texto":"Escribir instrucciones y generar el CV","marcado":false,"nota":""},{"texto":"Descargar el PDF resultante","marcado":false,"nota":""},{"texto":"Probar \"Guardar como mi CV base\"","marcado":false,"nota":""}]',
 ''),
('plan', 'Fase 3: Job board B2B para empresas', '2026-07-10',
 'Pendiente, sin fecha. Empresas publican ofertas directamente (nuevo tipo de cuenta B2B). Reusa parte de la infraestructura de portales existente.',
 '[]',
 'Ejemplo de informe tipo "plan" — para discutir prioridad en la próxima reunión.');

NOTIFY pgrst, 'reload schema';
