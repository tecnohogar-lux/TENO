-- Migración 035: fecha en que un envío se pone en camino.
-- sales.en_camino_at se llena cada vez que el estado de envío pasa a "en_camino" (desde "Delivery Santiago",
-- "Envíos Regiones", el escáner o la edición de una venta). Si vuelve a ponerse en camino tras una
-- reprogramación, se actualiza. La fecha de creación sigue siendo sales.created_at.
-- Los retiros en tienda ya tenían retiros_tienda.created_at (registro de la etiqueta) y
-- retiros_tienda.delivered_at (día en que el cliente fue a retirar): no necesitan cambios.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS en_camino_at TIMESTAMP;

-- Envíos que ya estaban en camino o entregados: se recupera la fecha desde la auditoría (primera vez que
-- se marcó "en_camino"). Los que nunca pasaron por ese estado quedan sin fecha.
UPDATE sales s
SET en_camino_at = a.fecha
FROM (
  SELECT record_id, MIN(created_at) AS fecha
  FROM audit_log
  WHERE table_name = 'sales' AND new_values->>'delivery_status' = 'en_camino'
  GROUP BY record_id
) a
WHERE s.id = a.record_id AND s.en_camino_at IS NULL;
