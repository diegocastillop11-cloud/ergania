-- Habilita conversación multi-mensaje en Mensajes de Contacto, solo para usuarios
-- autenticados (los mensajes anónimos, ej. desde /login, siguen siendo de una sola
-- vía por correo — no hay identidad estable para reabrir un hilo).

ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS admin_unread BOOLEAN DEFAULT true;
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS user_unread BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS contact_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_message_id UUID NOT NULL REFERENCES contact_messages(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'admin')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_replies_message ON contact_replies(contact_message_id);

NOTIFY pgrst, 'reload schema';
