-- Recordatorio de vencimiento: marca para enviar un solo email por período
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS reminder_for_period_end timestamptz;

NOTIFY pgrst, 'reload schema';
