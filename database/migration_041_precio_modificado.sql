-- Migración 041: precio de un producto modificado en una venta puntual (sin tocar el catálogo).
-- Solo admin, operador y caja pueden cambiar el precio de un producto al registrar o editar una venta. La
-- comisión de esa venta se calcula con el precio de venta (25% de precio - costo), no con el del catálogo.
--  - sales.precio_modificado: true si el precio de venta difiere del que tenía el producto al venderlo.
--  - sales.precio_original: precio unitario original (solo ventas de un producto; en las de varios productos
--    cada línea del detalle `items` lleva su propio precio_original y precio_modificado).
-- Las ventas anteriores quedan con precio_modificado = false. Es seguro repetirla.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS precio_modificado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS precio_original DECIMAL(12, 2);
