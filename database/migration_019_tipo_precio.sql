-- Migración 019: tipo de precio usado en cada venta / retiro.
-- 'marketplace' = precios normales del producto; 'sol' = precios tienda (precio + 20%).
-- Las ventas y retiros existentes se hicieron con los precios normales => 'marketplace'.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS price_type VARCHAR(12) NOT NULL DEFAULT 'marketplace'
  CHECK (price_type IN ('sol', 'marketplace'));
ALTER TABLE retiros_tienda ADD COLUMN IF NOT EXISTS price_type VARCHAR(12) NOT NULL DEFAULT 'marketplace'
  CHECK (price_type IN ('sol', 'marketplace'));
