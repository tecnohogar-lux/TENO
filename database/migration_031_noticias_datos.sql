-- Migración 031: detalle estructurado de las noticias de productos.
-- `datos` guarda el título del producto y, en las ediciones, qué cambió
-- (precio antes/después, título, descripción) para mostrarlo en las tarjetas
-- de Noticias. Columna nueva y nullable: las noticias existentes siguen
-- funcionando (se muestran a partir de su texto).

ALTER TABLE noticias ADD COLUMN IF NOT EXISTS datos JSONB;
