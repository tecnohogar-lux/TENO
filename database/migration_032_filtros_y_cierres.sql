-- Migración 032: filtros del Historial de Ventas / Delivery Santiago y corrección de cierres de caja.
--
--  * sales.registered_by: operador/admin/vendedor que registró la venta (filtro "Operador").
--  * sales.retiro_id: retiro en tienda del que salió la venta (distingue "retiro en tienda"
--    de "venta directa en caja" en el filtro de tipo de venta).
--
-- Columnas nuevas y nullable: no cambian ninguna venta existente. Se rellenan, cuando se puede,
-- con lo que ya está registrado (auditoría y retiros entregados).

ALTER TABLE sales ADD COLUMN IF NOT EXISTS registered_by INTEGER REFERENCES users(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS retiro_id INTEGER REFERENCES retiros_tienda(id) ON DELETE SET NULL;

-- Quién registró cada venta: el usuario que figura en la auditoría de su creación.
UPDATE sales s
SET registered_by = a.user_id
FROM audit_log a
WHERE a.table_name = 'sales'
  AND a.action IN ('crear_venta', 'crear_venta_caja')
  AND a.record_id = s.id
  AND s.registered_by IS NULL
  AND a.user_id IS NOT NULL;

-- Ventas de tienda que salieron de un retiro: se crearon en la misma transacción que marcó el
-- retiro como entregado (mismo timestamp), con el mismo cliente y vendedor.
UPDATE sales s
SET retiro_id = r.id,
    registered_by = COALESCE(s.registered_by, r.delivered_by)
FROM retiros_tienda r
WHERE r.status = 'entregado'
  AND s.tipo_venta = 'TIENDA'
  AND s.retiro_id IS NULL
  AND s.client_id = r.client_id
  AND s.vendor_id = r.vendor_id
  AND s.created_at = r.delivered_at;

CREATE INDEX IF NOT EXISTS idx_sales_registered_by ON sales(registered_by);
CREATE INDEX IF NOT EXISTS idx_sales_retiro_id ON sales(retiro_id);
