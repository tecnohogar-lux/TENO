-- Migración 007: cuentas de marketplace por vendedor
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketplace_accounts TEXT;
