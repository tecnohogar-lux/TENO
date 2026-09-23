-- Migración 013: Couriers (empresas/personas que retiran los paquetes de
-- Delivery Santiago). Módulo solo visible para admin/operador; los vendedores
-- no pueden crear couriers ni asignarlos a un envío.

CREATE TABLE IF NOT EXISTS couriers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE sales ADD COLUMN IF NOT EXISTS courier_id INTEGER REFERENCES couriers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_courier_id ON sales(courier_id);

INSERT INTO couriers (name) VALUES
  ('Mattos'),
  ('Driver Po'),
  ('Kike'),
  ('Yilberth'),
  ('Angel'),
  ('Rodolfo')
ON CONFLICT (name) DO NOTHING;
