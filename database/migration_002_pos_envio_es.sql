-- Migración 002: POS, envíos con estados en español, y limpieza de restricciones
-- Segura de re-ejecutar (usa IF NOT EXISTS / DO blocks donde aplica).

-- 1. Columnas nuevas en sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS tipo_venta VARCHAR(20) DEFAULT 'ENVIO';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS qr_code VARCHAR(500);

UPDATE sales SET tipo_venta = 'ENVIO' WHERE tipo_venta IS NULL;
ALTER TABLE sales ALTER COLUMN tipo_venta SET NOT NULL;

-- 2. Traducir valores existentes de status (quitar el CHECK viejo antes de tocar los datos)
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;

UPDATE sales SET status = 'pendiente' WHERE status = 'pending';
UPDATE sales SET status = 'completado' WHERE status = 'completed';
UPDATE sales SET status = 'cancelado' WHERE status = 'cancelled';

ALTER TABLE sales ADD CONSTRAINT sales_status_check
  CHECK (status IN ('pendiente', 'completado', 'cancelado'));
ALTER TABLE sales ALTER COLUMN status SET DEFAULT 'pendiente';

-- 3. Traducir valores existentes de delivery_status (paquetería) antes de cambiar el CHECK
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_delivery_status_check;

UPDATE sales SET delivery_status = 'listo_para_imprimir' WHERE delivery_status = 'pending';
UPDATE sales SET delivery_status = 'en_camino' WHERE delivery_status = 'in_transit';
UPDATE sales SET delivery_status = 'entregado' WHERE delivery_status = 'delivered';
UPDATE sales SET delivery_status = 'cancelado' WHERE delivery_status = 'failed';
UPDATE sales SET delivery_status = 'reprogramado' WHERE delivery_status = 'rescheduled';
UPDATE sales SET delivery_status = 'cancelado' WHERE delivery_status = 'cancelled';
-- Ventas TIENDA no usan estado de envío
UPDATE sales SET delivery_status = NULL WHERE tipo_venta = 'TIENDA';

ALTER TABLE sales ADD CONSTRAINT sales_delivery_status_check
  CHECK (delivery_status IN ('listo_para_imprimir', 'impreso', 'en_camino', 'entregado', 'cancelado', 'reprogramado'));
ALTER TABLE sales ALTER COLUMN delivery_status SET DEFAULT 'listo_para_imprimir';

-- 4. forma de pago válida
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('efectivo', 'tarjeta', 'transferencia'));

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_tipo_venta_check;
ALTER TABLE sales ADD CONSTRAINT sales_tipo_venta_check
  CHECK (tipo_venta IN ('ENVIO', 'TIENDA'));

-- 5. Generar qr_code para ventas ENVIO que no lo tengan
UPDATE sales SET qr_code = 'TENO-' || id WHERE tipo_venta = 'ENVIO' AND qr_code IS NULL;

-- 6. Quitar la restricción que bloqueaba una recompra legítima del mismo producto/cliente
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_vendor_id_client_id_product_name_key;

-- 7. Índices nuevos
CREATE INDEX IF NOT EXISTS idx_sales_tipo_venta ON sales(tipo_venta);
CREATE INDEX IF NOT EXISTS idx_sales_delivery_status ON sales(delivery_status);
CREATE INDEX IF NOT EXISTS idx_products_created_by ON products(created_by);
