-- Migración 015: comisión de venta por venta (snapshot al crear/editar la venta,
-- tomada del campo comision_venta del producto en ese momento; cantidad * comisión
-- unitaria). No se recalcula sola si el producto cambia después: así el pago a
-- vendedores no varía retroactivamente por una edición posterior del catálogo.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS comision DECIMAL(10, 2);
