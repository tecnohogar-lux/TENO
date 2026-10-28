-- Migración 040: al cancelar un envío de Delivery Santiago se pregunta si el paquete salió o no a despacho.
-- sales.despacho_cancelacion guarda la respuesta: 'salio' o 'no_salio'. Solo se llena mientras el envío
-- está cancelado (al pasar a otro estado se limpia); los cancelados anteriores quedan en NULL.
-- Es seguro repetirla.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS despacho_cancelacion VARCHAR(20);
