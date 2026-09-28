-- Migración 018: segundo cálculo de precios por producto ("tienda").
-- costo_tienda = costo; precio_tienda = precio * 1.20; rentabilidad_tienda = precio_tienda - costo_tienda;
-- margen_75_tienda = 75% de rentabilidad_tienda; comision_venta_tienda = 25% de rentabilidad_tienda.
-- No se duplican productos: son columnas nuevas en la misma fila. Todo se recalcula en el servidor.

ALTER TABLE products ADD COLUMN IF NOT EXISTS costo_tienda DECIMAL(10, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS precio_tienda DECIMAL(10, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS rentabilidad_tienda DECIMAL(10, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS margen_75_tienda DECIMAL(10, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS comision_venta_tienda DECIMAL(10, 2);

UPDATE products SET
  costo_tienda = costo,
  precio_tienda = ROUND(price * 1.20, 2),
  rentabilidad_tienda = CASE WHEN costo IS NULL THEN NULL ELSE ROUND(price * 1.20, 2) - costo END,
  margen_75_tienda = CASE WHEN costo IS NULL THEN NULL ELSE ROUND((ROUND(price * 1.20, 2) - costo) * 0.75, 2) END,
  comision_venta_tienda = CASE WHEN costo IS NULL THEN NULL ELSE ROUND((ROUND(price * 1.20, 2) - costo) * 0.25, 2) END;
