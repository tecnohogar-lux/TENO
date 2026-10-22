-- Migración 038: fecha a la que se reprograma un envío de Delivery Santiago.
-- sales.reprogramado_para se llena al pasar un envío a "reprogramado" (el sistema pide la fecha). Ese día
-- el envío vuelve solo a "impreso" y, mientras siga pendiente (no entregado ni cancelado), muestra el tag
-- "Delivery Reprogramado". La etiqueta física (PDF) no cambia.
-- Es seguro repetirla.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS reprogramado_para DATE;
CREATE INDEX IF NOT EXISTS idx_sales_reprogramado_pendiente ON sales (reprogramado_para) WHERE delivery_status = 'reprogramado';
