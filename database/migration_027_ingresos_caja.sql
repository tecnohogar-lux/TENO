-- Migración 027: ingresos de dinero a caja (pagos de deudas, abonos, etc.).
-- Son efectivo que entra a la caja abierta sin pertenecer a ninguna venta, así
-- que viven en su propia tabla: no generan comisión ni costo ni aparecen en
-- reportes de ventas. Solo suman al efectivo esperado de Apertura/Cierre de Caja.

CREATE TABLE IF NOT EXISTS ingresos_caja (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  monto DECIMAL(10, 2) NOT NULL CHECK (monto > 0),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ingresos_caja_created_at ON ingresos_caja(created_at DESC);

ALTER TABLE cierre_caja ADD COLUMN IF NOT EXISTS total_ingresos DECIMAL(10, 2);
