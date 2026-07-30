-- Instrucciones de redacción de CV específicas por oferta evaluada: hoy solo existe
-- profile.cv_instructions (aplica a todo CV que se genera), pero el usuario quiere poder
-- indicar preferencias puntuales para el CV de UNA oferta particular al momento de
-- evaluarla en Pipeline (ej. "para este rol destaca X, omite Y"). Se guardan junto al
-- tracker_entry de esa oferta para que createApplication las combine con las del perfil
-- al generar el kit de postulación.

ALTER TABLE tracker_entries ADD COLUMN IF NOT EXISTS cv_instructions TEXT;

NOTIFY pgrst, 'reload schema';
