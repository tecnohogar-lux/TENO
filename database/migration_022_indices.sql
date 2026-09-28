-- Migración 022: índice para las búsquedas de producto por nombre (LOWER(title)) que hace
-- cada venta al calcular su comisión y cada buscador del catálogo.
CREATE INDEX IF NOT EXISTS idx_products_title_lower ON products (LOWER(title));
