-- Migración 010: Retiro en Tienda (propuestas de venta que no cuentan como
-- ventas/dinero ganado hasta que se procesan en Caja al momento de entregar).

CREATE TABLE IF NOT EXISTS retiros_tienda (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES users(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  items JSON NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'entregado')),
  notes TEXT,
  delivered_at TIMESTAMP,
  delivered_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_retiros_tienda_vendor ON retiros_tienda(vendor_id);
CREATE INDEX IF NOT EXISTS idx_retiros_tienda_status ON retiros_tienda(status);
