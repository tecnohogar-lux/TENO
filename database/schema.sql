
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('vendedor', 'operador', 'admin', 'escaneo')),
  is_active BOOLEAN DEFAULT true,
  marketplace_accounts TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(500),
  phone VARCHAR(20),
  email VARCHAR(255),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  sku VARCHAR(255),
  price DECIMAL(10, 2) NOT NULL,
  cover_image_url VARCHAR(500),
  caracteristicas TEXT,
  agotado BOOLEAN DEFAULT false,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES users(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  address VARCHAR(500),
  comuna VARCHAR(100),
  region VARCHAR(100),
  phone VARCHAR(20),
  status VARCHAR(50) NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'completado', 'cancelado')),
  delivery_status VARCHAR(50) DEFAULT 'listo_para_imprimir' CHECK (delivery_status IN (
    'listo_para_imprimir', 'impreso', 'en_camino', 'entregado', 'cancelado', 'reprogramado',
    'solo_envio_pagado', 'solo_entrega_incompleto', 'cambio_producto'
  )),
  tipo_venta VARCHAR(20) NOT NULL DEFAULT 'ENVIO' CHECK (tipo_venta IN ('ENVIO', 'TIENDA', 'ENVIO_PREPAGADO', 'ENVIO_REGION')),
  payment_method VARCHAR(30) CHECK (payment_method IN ('efectivo', 'tarjeta', 'transferencia', 'link_pago')),
  transferencia_verificada BOOLEAN DEFAULT false,
  precio_producto DECIMAL(10, 2),
  precio_envio DECIMAL(10, 2),
  qr_code VARCHAR(500),
  notes TEXT,
  delivered_at TIMESTAMP,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(50) DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  module_order JSON DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  record_id INTEGER,
  old_values JSON,
  new_values JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS anotaciones_diarias (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  texto TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS costos_envio_comuna (
  id SERIAL PRIMARY KEY,
  comuna VARCHAR(100) UNIQUE NOT NULL,
  precio DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS envios_regiones (
  id SERIAL PRIMARY KEY,
  region VARCHAR(100) NOT NULL,
  comuna VARCHAR(100) NOT NULL,
  precio DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS gastos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  monto DECIMAL(10, 2) NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sales_vendor_id ON sales(vendor_id);
CREATE INDEX idx_sales_client_id ON sales(client_id);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_tipo_venta ON sales(tipo_venta);
CREATE INDEX idx_sales_delivery_status ON sales(delivery_status);
CREATE INDEX idx_sales_deleted_at ON sales(deleted_at);
CREATE INDEX idx_clients_created_by ON clients(created_by);
CREATE INDEX idx_products_created_by ON products(created_by);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_noticias_created_at ON noticias(created_at DESC);
CREATE INDEX idx_anotaciones_fecha ON anotaciones_diarias(fecha DESC);
CREATE INDEX idx_envios_regiones_region ON envios_regiones(region);
CREATE INDEX idx_cierre_caja_closed_at ON cierre_caja(closed_at);
CREATE UNIQUE INDEX idx_cierre_caja_una_abierta ON cierre_caja((closed_at IS NULL)) WHERE closed_at IS NULL;
CREATE INDEX idx_gastos_created_at ON gastos(created_at DESC);

INSERT INTO users (name, email, password, role, is_active) VALUES
('Admin', 'admin@teno.com', '$2a$10$kRh/5wEI6qiwryQIo0AAqeu5URs8csVeIcQO862mEJbVnasyOY5DS', 'admin', true),
('Vendedor Test', 'vendedor@teno.com', '$2a$10$kRh/5wEI6qiwryQIo0AAqeu5URs8csVeIcQO862mEJbVnasyOY5DS', 'vendedor', true),
('Operador Test', 'operador@teno.com', '$2a$10$kRh/5wEI6qiwryQIo0AAqeu5URs8csVeIcQO862mEJbVnasyOY5DS', 'operador', true),
('Escaneo Test', 'escaneo@teno.com', '$2a$10$kRh/5wEI6qiwryQIo0AAqeu5URs8csVeIcQO862mEJbVnasyOY5DS', 'escaneo', true)
ON CONFLICT DO NOTHING;

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

INSERT INTO app_settings (key, value) VALUES ('envio_deadline_hora', '18:00')
ON CONFLICT (key) DO NOTHING;
