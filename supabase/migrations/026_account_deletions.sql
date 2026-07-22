-- Registro de solicitudes de eliminación de cuenta. Se guarda el email en texto
-- plano (no una FK a auth.users) porque para cuando se consulta este registro
-- el usuario de Auth ya fue borrado — es lo único que sobrevive para poder
-- mostrar el motivo en el panel Admin y para bloquear un trial nuevo si el
-- mismo correo se vuelve a registrar (ver getOrCreateSubscription).

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL,
  email       TEXT        NOT NULL,
  motivo      TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_email ON account_deletion_requests(email);

NOTIFY pgrst, 'reload schema';
