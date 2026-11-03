-- Migración 042: porcentaje de comisión propio de cada vendedor.
-- La comisión de una venta es un porcentaje de (precio de venta - costo). Hasta ahora era 25% para todos;
-- ahora un admin puede fijar otro porcentaje para un vendedor (desde Usuarios > Editar comisión).
--  - users.comision_porcentaje: NULL = porcentaje estándar (25%). Solo se usa en usuarios con rol vendedor.
-- Aplica a las ventas que se registren o editen desde ese momento; las ya hechas conservan su comisión.
-- Es seguro repetirla.

ALTER TABLE users ADD COLUMN IF NOT EXISTS comision_porcentaje DECIMAL(5, 2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_comision_porcentaje_rango') THEN
    ALTER TABLE users ADD CONSTRAINT users_comision_porcentaje_rango
      CHECK (comision_porcentaje IS NULL OR (comision_porcentaje >= 0 AND comision_porcentaje <= 100));
  END IF;
END $$;
