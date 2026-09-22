-- Migración 011: reemplaza la forma de pago genérica "tarjeta" por "débito" y
-- "crédito" (registros existentes en tarjeta pasan a débito, el más común).
-- La restricción se amplía primero para permitir los valores nuevos junto al
-- viejo, se migran los datos, y luego se angosta para excluir "tarjeta".

ALTER TABLE sales DROP CONSTRAINT sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('efectivo', 'tarjeta', 'debito', 'credito', 'transferencia', 'link_pago'));

UPDATE sales SET payment_method = 'debito' WHERE payment_method = 'tarjeta';

ALTER TABLE sales DROP CONSTRAINT sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('efectivo', 'debito', 'credito', 'transferencia', 'link_pago'));
