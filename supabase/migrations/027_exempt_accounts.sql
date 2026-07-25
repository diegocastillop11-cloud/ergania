-- Asegura que exista la columna is_exempt (cuenta exenta: acceso activo
-- permanente sin pago, ver getSubscriptionStatus en subscriptionService.ts).
-- El código ya la usaba pero no había migración que la creara en este repo —
-- IF NOT EXISTS por si ya se agregó a mano en Supabase (ver gotcha de env vars
-- en CLAUDE.md sobre cambios hechos directo en el dashboard).

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_exempt BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
