-- Migración 014: costo, rentabilidad y comisión de venta por producto.
-- rentabilidad = precio - costo; margen_75 = rentabilidad * 0.75;
-- comision_venta = rentabilidad * 0.25 (la "Comisión de venta" del producto).
-- Todas nullable: productos existentes sin costo cargado quedan sin estos
-- valores hasta que se les asigne un costo (por edición individual o Excel).

ALTER TABLE products ADD COLUMN IF NOT EXISTS costo DECIMAL(10, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS rentabilidad DECIMAL(10, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS margen_75 DECIMAL(10, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS comision_venta DECIMAL(10, 2);
