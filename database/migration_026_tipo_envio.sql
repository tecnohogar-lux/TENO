-- Migración 026: "tipo de envío" separado del estado de entrega.
-- Antes, solo_envio_pagado / solo_entrega_incompleto / cambio_producto vivían
-- dentro de delivery_status y pisaban el progreso normal (impreso/en_camino/
-- entregado). Pasan a ser un campo propio (delivery_type), que no afecta ni
-- es afectado por delivery_status. No borra ningún delivery existente: los
-- valores normales de delivery_status quedan intactos; solo se recupera el
-- caso de una venta que haya quedado con uno de los 3 valores especiales
-- guardado ahí (se mueve a delivery_type y delivery_status vuelve a su estado
-- normal de partida).

ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(30) NOT NULL DEFAULT 'delivery'
  CHECK (delivery_type IN ('delivery', 'solo_envio_pagado', 'solo_entrega_incompleto', 'cambio_producto'));

UPDATE sales SET delivery_type = delivery_status, delivery_status = 'listo_para_imprimir'
WHERE delivery_status IN ('solo_envio_pagado', 'solo_entrega_incompleto', 'cambio_producto');

ALTER TABLE sales DROP CONSTRAINT sales_delivery_status_check;
ALTER TABLE sales ADD CONSTRAINT sales_delivery_status_check
  CHECK (delivery_status IN ('listo_para_imprimir', 'impreso', 'en_camino', 'entregado', 'cancelado', 'reprogramado'));
