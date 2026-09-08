
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('vendedor', 'operador', 'admin')),
  is_active BOOLEAN DEFAULT true,
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

CREATE TABLE IF NOT EXISTS labels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  notes TEXT,
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
  phone VARCHAR(20),
  status VARCHAR(50) NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'completado', 'cancelado')),
  delivery_status VARCHAR(50) DEFAULT 'listo_para_imprimir' CHECK (delivery_status IN ('listo_para_imprimir', 'impreso', 'en_camino', 'entregado', 'cancelado', 'reprogramado')),
  tipo_venta VARCHAR(20) NOT NULL DEFAULT 'ENVIO' CHECK (tipo_venta IN ('ENVIO', 'TIENDA')),
  payment_method VARCHAR(30) CHECK (payment_method IN ('efectivo', 'tarjeta', 'transferencia')),
  qr_code VARCHAR(500),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_labels (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sale_id, label_id)
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(50) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'coral')),
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

CREATE INDEX idx_sales_vendor_id ON sales(vendor_id);
CREATE INDEX idx_sales_client_id ON sales(client_id);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_tipo_venta ON sales(tipo_venta);
CREATE INDEX idx_sales_delivery_status ON sales(delivery_status);
CREATE INDEX idx_clients_created_by ON clients(created_by);
CREATE INDEX idx_labels_created_by ON labels(created_by);
CREATE INDEX idx_products_created_by ON products(created_by);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

INSERT INTO users (name, email, password, role, is_active) VALUES
('Admin', 'admin@teno.com', '$2a$10$Wy.aX.KIIVr9HYr0E4q6CeKm.R7z6.0UR1s4sJ3BoYlVb4dQjyGZu', 'admin', true),
('Vendedor Test', 'vendedor@teno.com', '$2a$10$Wy.aX.KIIVr9HYr0E4q6CeKm.R7z6.0UR1s4sJ3BoYlVb4dQjyGZu', 'vendedor', true),
('Operador Test', 'operador@teno.com', '$2a$10$Wy.aX.KIIVr9HYr0E4q6CeKm.R7z6.0UR1s4sJ3BoYlVb4dQjyGZu', 'operador', true)
ON CONFLICT DO NOTHING;
