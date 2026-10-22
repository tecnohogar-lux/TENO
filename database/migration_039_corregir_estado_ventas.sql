-- Migración 039: corrige envíos cuyo estado de venta contradice el de su paquete.
-- Un paquete se marcó "entregado" (la venta pasó a "completado") y después se cambió a "cancelado" o se
-- revirtió, pero la venta quedó "completado" y su monto seguía contando como venta cerrada en el dashboard.
--  * paquete cancelado + venta completada      -> venta "cancelado"
--  * paquete aún no entregado + venta completada -> venta "pendiente"
-- Solo envíos de Santiago y regiones (ENVIO / ENVIO_REGION) activos. Cada cambio queda en la auditoría
-- (acción 'corregir_estado_venta'). Es seguro repetirla: una vez corregidas, no hay nada más que cambiar.

WITH corregidas AS (
  UPDATE sales s
  SET status = CASE WHEN s.delivery_status = 'cancelado' THEN 'cancelado' ELSE 'pendiente' END,
      updated_at = CURRENT_TIMESTAMP
  WHERE s.deleted_at IS NULL
    AND s.tipo_venta IN ('ENVIO', 'ENVIO_REGION')
    AND s.status = 'completado'
    AND s.delivery_status IN ('cancelado', 'listo_para_imprimir', 'impreso', 'en_camino', 'reprogramado')
  RETURNING s.id, s.delivery_status, s.status AS status_nuevo
)
INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values)
SELECT NULL, 'corregir_estado_venta', 'sales', id,
       json_build_object('status', 'completado', 'delivery_status', delivery_status),
       json_build_object('status', status_nuevo, 'delivery_status', delivery_status)
FROM corregidas;
