-- Migración 025: pago mixto en Caja (más de una forma de pago en la misma venta).
-- payment_method pasa a admitir 'mixto'; el detalle (método, monto, verificación
-- de transferencia) queda en la nueva columna payment_breakdown (JSON).

ALTER TABLE sales DROP CONSTRAINT sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('efectivo', 'debito', 'credito', 'transferencia', 'link_pago', 'mixto'));

ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_breakdown JSON;
