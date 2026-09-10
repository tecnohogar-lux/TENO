-- Migración 005:
-- 1. Papelera de reciclaje para sales (soft delete en vez de borrado real)
-- 2. Fecha de entrega para el métrico "ventas entregadas ayer"
-- 3. Quitar el tema 'coral'

ALTER TABLE sales ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_sales_deleted_at ON sales(deleted_at);

-- Backfill: para las ventas ya entregadas, usamos updated_at como mejor estimado
UPDATE sales SET delivered_at = updated_at WHERE delivery_status = 'entregado' AND delivered_at IS NULL;

UPDATE user_preferences SET theme = 'light' WHERE theme = 'coral';
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_theme_check;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_theme_check
  CHECK (theme IN ('light', 'dark'));
