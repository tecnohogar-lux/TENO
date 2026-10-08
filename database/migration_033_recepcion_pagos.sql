-- Migración 033: módulo "Recepción de Pagos".
-- Cuentas pendientes por pagar (deudas de TecnoHogar) y por cobrar (deudas que le deben a la
-- empresa), con sus abonos. Es un registro aparte: NO toca la caja, el cierre de caja ni las ventas.
--
--  * pago_contrapartes: a quién se le paga / quién nos paga (se agregan a mano y se reutilizan).
--  * pago_cuentas: la cuenta pendiente (monto total, vencimiento, período que cubre).
--  * pago_abonos: cada pago registrado contra una cuenta (fecha, motivo, período que cubre).

CREATE TABLE IF NOT EXISTS pago_contrapartes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  notas TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pago_contrapartes_nombre ON pago_contrapartes (LOWER(nombre));

CREATE TABLE IF NOT EXISTS pago_cuentas (
  id SERIAL PRIMARY KEY,
  -- por_pagar: deuda de TecnoHogar con la contraparte. por_cobrar: la contraparte le debe a TecnoHogar.
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('por_pagar', 'por_cobrar')),
  contraparte_id INTEGER NOT NULL REFERENCES pago_contrapartes(id),
  concepto VARCHAR(255) NOT NULL,
  monto_total DECIMAL(12, 2) NOT NULL CHECK (monto_total > 0),
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  periodo_desde DATE,
  periodo_hasta DATE,
  notas TEXT,
  anulada_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pago_cuentas_contraparte ON pago_cuentas (contraparte_id);
CREATE INDEX IF NOT EXISTS idx_pago_cuentas_tipo ON pago_cuentas (tipo);
CREATE INDEX IF NOT EXISTS idx_pago_cuentas_emision ON pago_cuentas (fecha_emision DESC);

CREATE TABLE IF NOT EXISTS pago_abonos (
  id SERIAL PRIMARY KEY,
  cuenta_id INTEGER NOT NULL REFERENCES pago_cuentas(id) ON DELETE CASCADE,
  monto DECIMAL(12, 2) NOT NULL CHECK (monto > 0),
  fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
  motivo VARCHAR(255),
  periodo_desde DATE,
  periodo_hasta DATE,
  notas TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pago_abonos_cuenta ON pago_abonos (cuenta_id, fecha_pago DESC);
