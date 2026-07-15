-- Marca cuentas de prueba (correos internos usados para probar pagos, etc.) para
-- excluirlas de métricas de negocio (ingresos, suscritos activos, pagos) en el
-- panel Admin sin borrar sus datos. Distinto de is_exempt (que da acceso activo
-- gratis) — is_test solo afecta qué se cuenta en los reportes.

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
