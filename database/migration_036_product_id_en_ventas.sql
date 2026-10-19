-- Migración 036: las ventas guardan el id del producto (no solo su nombre).
-- Antes una venta solo recordaba el nombre con que se vendió; si el producto se renombraba después, el
-- sistema ya no lo encontraba (costo y comisión quedaban vacíos). Ahora:
--  * sales.product_id: producto de la venta (ventas de un solo producto).
--  * Las líneas de sales.items (ventas con varios productos) llevan "product_id" dentro del JSON.
--  * producto_nombres_anteriores: nombres que tuvo cada producto antes de renombrarse (se llena al renombrar).
-- Es seguro repetirla: no duplica nada ni pisa ids ya asignados.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales (product_id);

CREATE TABLE IF NOT EXISTS producto_nombres_anteriores (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pna_producto_nombre ON producto_nombres_anteriores (product_id, LOWER(TRIM(nombre)));
CREATE INDEX IF NOT EXISTS idx_pna_nombre ON producto_nombres_anteriores (LOWER(TRIM(nombre)));

-- 1) Nombres anteriores: los cambios de título que quedaron registrados en las Noticias.
INSERT INTO producto_nombres_anteriores (product_id, nombre, created_at)
SELECT n.producto_id, MIN(TRIM(c->>'de')), MIN(n.created_at)
FROM noticias n, jsonb_array_elements(COALESCE(n.datos->'cambios', '[]'::jsonb)) c
WHERE n.tipo = 'producto_editado' AND c->>'campo' = 'titulo'
  AND n.producto_id IS NOT NULL
  AND COALESCE(TRIM(c->>'de'), '') <> ''
  AND EXISTS (SELECT 1 FROM products p WHERE p.id = n.producto_id)
GROUP BY n.producto_id, LOWER(TRIM(c->>'de'))
ON CONFLICT DO NOTHING;

-- 2) Ventas de un solo producto: se enlazan por el nombre actual del producto o, si no, por un nombre anterior.
UPDATE sales s
SET product_id = m.pid
FROM (
  SELECT v.id AS venta_id,
         COALESCE(
           (SELECT p.id FROM products p WHERE LOWER(TRIM(p.title)) = LOWER(TRIM(v.product_name)) ORDER BY p.id LIMIT 1),
           (SELECT h.product_id FROM producto_nombres_anteriores h WHERE LOWER(TRIM(h.nombre)) = LOWER(TRIM(v.product_name)) ORDER BY h.id DESC LIMIT 1)
         ) AS pid
  FROM sales v
  WHERE v.items IS NULL AND v.product_id IS NULL
) m
WHERE s.id = m.venta_id AND m.pid IS NOT NULL;

-- 3) Ventas con varios productos: cada línea del JSON recibe su product_id.
UPDATE sales s
SET items = (
  SELECT json_agg(
           CASE WHEN r.pid IS NOT NULL AND (t.l->>'product_id') IS NULL
                THEN (t.l::jsonb || jsonb_build_object('product_id', r.pid))::json
                ELSE t.l END
           ORDER BY t.ord)
  FROM json_array_elements(s.items) WITH ORDINALITY AS t(l, ord)
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      (SELECT p.id FROM products p WHERE LOWER(TRIM(p.title)) = LOWER(TRIM(t.l->>'product_name')) ORDER BY p.id LIMIT 1),
      (SELECT h.product_id FROM producto_nombres_anteriores h WHERE LOWER(TRIM(h.nombre)) = LOWER(TRIM(t.l->>'product_name')) ORDER BY h.id DESC LIMIT 1)
    ) AS pid
  ) r
)
WHERE s.items IS NOT NULL AND json_typeof(s.items) = 'array';
