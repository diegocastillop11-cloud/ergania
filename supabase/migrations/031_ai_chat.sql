-- Chat de IA asistente: historial de mensajes, log de errores para visibilidad
-- en Admin (no hay Sentry), y contador de consultas del trial. El límite de
-- evaluaciones NO se duplica acá — el chat reusa evaluateJob tal cual, que ya
-- aplica su propio límite (4/día, 12 total) vía la tabla tracker existente.

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant')),
  body TEXT NOT NULL,
  pending_action JSONB,
  tool_result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id, created_at);

CREATE TABLE IF NOT EXISTS chat_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_message TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_errors_created ON chat_errors(created_at DESC);

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS chat_consultas_used INT NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
