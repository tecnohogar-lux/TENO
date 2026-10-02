-- Migración 028: descuentos a vendedores (devoluciones, errores, etc.).
-- Es un movimiento aparte: no modifica ventas ni comisiones ya calculadas; se
-- resta al pagar la comisión del rango de fechas en que fue registrado.

CREATE TABLE IF NOT EXISTS descuentos_vendedor (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES users(id),
  motivo VARCHAR(255) NOT NULL,
  monto DECIMAL(10, 2) NOT NULL CHECK (monto > 0),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_descuentos_vendedor_vendor ON descuentos_vendedor(vendor_id, created_at DESC);
