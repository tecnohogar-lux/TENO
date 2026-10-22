-- Migración 037: cada venta guarda el costo de compra con que se vendió.
-- Antes el costo del Excel de Reportes se calculaba al momento con el costo actual del producto, así que
-- cuando el costo de un producto subía o bajaba, cambiaba el costo de todas sus ventas pasadas.
-- sales.costo_total = costo unitario x cantidad (costo_tienda en líneas SOL), fijado al crear la venta.
--
-- Las ventas que ya existen reciben el costo ACTUAL del producto: es el mejor dato disponible (no se puede
-- saber el costo que tenían antes). Desde ahora quedan fijas. Las ventas cuyo producto no se pudo enlazar
-- (productos libres o nombres sin coincidencia) quedan en NULL.
-- Es seguro repetirla: solo rellena las ventas que aún no tienen costo guardado.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS costo_total DECIMAL(12, 2);

-- Ventas de un solo producto.
UPDATE sales s
SET costo_total = ROUND(s.quantity * (CASE WHEN s.price_type = 'sol' AND p.costo_tienda IS NOT NULL THEN p.costo_tienda ELSE p.costo END), 2)
FROM products p
WHERE s.product_id = p.id AND s.items IS NULL AND s.costo_total IS NULL
  AND (CASE WHEN s.price_type = 'sol' AND p.costo_tienda IS NOT NULL THEN p.costo_tienda ELSE p.costo END) IS NOT NULL;

-- Ventas con varios productos: suma por línea; si alguna línea no tiene producto o costo, queda en NULL.
UPDATE sales s
SET costo_total = x.total
FROM (
  SELECT v.id,
         CASE WHEN bool_and(c.unitario IS NOT NULL)
              THEN ROUND(SUM(c.unitario * (l->>'quantity')::numeric), 2) END AS total
  FROM sales v
  CROSS JOIN LATERAL json_array_elements(v.items) AS l
  LEFT JOIN LATERAL (
    SELECT CASE WHEN l->>'price_type' = 'sol' AND p.costo_tienda IS NOT NULL THEN p.costo_tienda ELSE p.costo END AS unitario
    FROM products p WHERE p.id = NULLIF(l->>'product_id', '')::int
  ) c ON TRUE
  WHERE v.items IS NOT NULL AND json_typeof(v.items) = 'array' AND v.costo_total IS NULL
  GROUP BY v.id
) x
WHERE s.id = x.id AND x.total IS NOT NULL;
