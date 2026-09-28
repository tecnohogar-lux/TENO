-- Migración 024: módulo Preguntas (vendedores preguntan; admin/operador/caja responden).
-- Cada pregunta se borra sola a los 15 días de creada (limpieza perezosa, igual que Noticias).
CREATE TABLE IF NOT EXISTS preguntas (
  id SERIAL PRIMARY KEY,
  vendedor_id INTEGER NOT NULL REFERENCES users(id),
  pregunta TEXT NOT NULL,
  respuesta TEXT,
  respondida_por INTEGER REFERENCES users(id),
  respondida_at TIMESTAMP,
  leida_por_vendedor BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_preguntas_vendedor ON preguntas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_preguntas_created_at ON preguntas(created_at);
