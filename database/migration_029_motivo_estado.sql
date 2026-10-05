-- Migración 029: motivo de cancelación / reprogramación de un envío.
-- Cuando un envío de Santiago pasa a "cancelado" o "reprogramado", el operador o
-- administrador debe registrar el motivo; el vendedor lo ve en su módulo
-- Delivery Santiago. Columna nueva y nullable: no toca ningún envío existente.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS motivo_estado VARCHAR(500);
