-- Permite responder mensajes de contacto desde el panel Admin y dejar registro
-- de qué se respondió y cuándo (no hay hilo de conversación, es una respuesta única).

ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS reply_text TEXT;

NOTIFY pgrst, 'reload schema';
