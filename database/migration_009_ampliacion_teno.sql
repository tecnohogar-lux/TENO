-- Migración 009: Noticias, Anotaciones diarias, Costos de envío (comuna/región),
-- Cierre de caja, Gastos, Configuración global, y columnas nuevas en products/sales.
-- Idempotente: seguro de correr más de una vez.

-- ============================================
-- products
-- ============================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS caracteristicas TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS agotado BOOLEAN DEFAULT false;

-- ============================================
-- sales: nuevos valores de tipo_venta, delivery_status, payment_method
-- ============================================
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_tipo_venta_check;
ALTER TABLE sales ADD CONSTRAINT sales_tipo_venta_check
  CHECK (tipo_venta IN ('ENVIO', 'TIENDA', 'ENVIO_PREPAGADO', 'ENVIO_REGION'));

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_delivery_status_check;
ALTER TABLE sales ADD CONSTRAINT sales_delivery_status_check
  CHECK (delivery_status IN (
    'listo_para_imprimir', 'impreso', 'en_camino', 'entregado', 'cancelado', 'reprogramado',
    'solo_envio_pagado', 'solo_entrega_incompleto', 'cambio_producto'
  ));

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('efectivo', 'tarjeta', 'transferencia', 'link_pago'));

ALTER TABLE sales ADD COLUMN IF NOT EXISTS transferencia_verificada BOOLEAN DEFAULT false;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS precio_producto DECIMAL(10, 2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS precio_envio DECIMAL(10, 2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS region VARCHAR(100);

-- ============================================
-- noticias
-- ============================================
CREATE TABLE IF NOT EXISTS noticias (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(30) NOT NULL DEFAULT 'manual' CHECK (tipo IN (
    'manual', 'producto_creado', 'producto_editado', 'producto_agotado', 'producto_disponible', 'producto_eliminado'
  )),
  texto TEXT NOT NULL,
  producto_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_noticias_created_at ON noticias(created_at DESC);

-- ============================================
-- anotaciones_diarias
-- ============================================
CREATE TABLE IF NOT EXISTS anotaciones_diarias (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  texto TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_anotaciones_fecha ON anotaciones_diarias(fecha DESC);

-- ============================================
-- costos_envio_comuna
-- ============================================
CREATE TABLE IF NOT EXISTS costos_envio_comuna (
  id SERIAL PRIMARY KEY,
  comuna VARCHAR(100) UNIQUE NOT NULL,
  precio DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO costos_envio_comuna (comuna, precio) VALUES
  ('Puente Alto', 4000),
  ('San Bernardo', 4000),
  ('La Pintana', 4000),
  ('El Bosque', 4000),
  ('Lo Barnechea', 4000),
  ('Colina', 4000),
  ('Padre Hurtado', 4000),
  ('Lo Prado', 3500),
  ('Quinta Normal', 3500),
  ('San Joaquín', 3500),
  ('Independencia', 3500),
  ('Estación Central', 3500),
  ('Santiago', 3500),
  ('Recoleta', 3500),
  ('Providencia', 3500),
  ('Pudahuel', 3500),
  ('Cerro Navia', 3500),
  ('San Miguel', 3500),
  ('Pedro Aguirre Cerda', 3500),
  ('La Cisterna', 3500),
  ('Las Condes', 3500),
  ('Macul', 3500),
  ('Ñuñoa', 3500),
  ('Renca', 3500),
  ('La Reina', 3500),
  ('Conchalí', 3500),
  ('Huechuraba', 3500),
  ('Peñalolén', 3500),
  ('Maipú', 3500),
  ('Lo Espejo', 3500),
  ('La Granja', 3500),
  ('San Ramón', 3500),
  ('La Florida', 3500),
  ('Vitacura', 3500),
  ('Cerrillos', 3500),
  ('Quilicura', 3500)
ON CONFLICT (comuna) DO NOTHING;

-- ============================================
-- envios_regiones (sin seed; se carga manualmente desde el módulo)
-- ============================================
CREATE TABLE IF NOT EXISTS envios_regiones (
  id SERIAL PRIMARY KEY,
  region VARCHAR(100) NOT NULL,
  comuna VARCHAR(100) NOT NULL,
  precio DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_envios_regiones_region ON envios_regiones(region);

-- ============================================
-- cierre_caja
-- ============================================
CREATE TABLE IF NOT EXISTS cierre_caja (
  id SERIAL PRIMARY KEY,
  opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  opened_by INTEGER NOT NULL REFERENCES users(id),
  saldo_inicial DECIMAL(10, 2) NOT NULL DEFAULT 0,
  closed_at TIMESTAMP,
  closed_by INTEGER REFERENCES users(id),
  total_vendido DECIMAL(10, 2),
  total_gastos DECIMAL(10, 2),
  saldo_real DECIMAL(10, 2),
  efectivo_contado DECIMAL(10, 2),
  diferencia DECIMAL(10, 2),
  notas TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cierre_caja_closed_at ON cierre_caja(closed_at);

-- Garantiza que solo exista una caja abierta (closed_at IS NULL) a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cierre_caja_una_abierta
  ON cierre_caja((closed_at IS NULL))
  WHERE closed_at IS NULL;

-- ============================================
-- gastos
-- ============================================
CREATE TABLE IF NOT EXISTS gastos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  monto DECIMAL(10, 2) NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gastos_created_at ON gastos(created_at DESC);

-- ============================================
-- app_settings
-- ============================================
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app_settings (key, value) VALUES ('envio_deadline_hora', '18:00')
ON CONFLICT (key) DO NOTHING;
