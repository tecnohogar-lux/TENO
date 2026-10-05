-- Migración 030: envíos "sin cobro".
-- Los tipos de envío solo_envio_pagado, solo_entrega_incompleto y cambio_producto no
-- se cobran: al asignarlos se dejan en 0 el precio, el total y la comisión, y no cuentan
-- en métricas, conteos, reportes ni caja. cobro_original guarda los montos que tenía el
-- envío para poder restaurarlos si vuelve a ser un "delivery" normal.
--
-- Los envíos que YA tienen alguno de esos tipos se llevan al mismo estado (con respaldo).

ALTER TABLE sales ADD COLUMN IF NOT EXISTS cobro_original JSONB;

UPDATE sales
SET cobro_original = jsonb_build_object(
      'price', price, 'total', total, 'precio_producto', precio_producto,
      'precio_envio', precio_envio, 'comision', comision),
    price = 0, total = 0, precio_producto = 0, precio_envio = 0, comision = 0
WHERE delivery_type IN ('solo_envio_pagado', 'solo_entrega_incompleto', 'cambio_producto')
  AND cobro_original IS NULL;
