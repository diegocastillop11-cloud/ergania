-- Recordatorio de trial por vencer: marca para no repetir el correo
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_reminder_sent boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
