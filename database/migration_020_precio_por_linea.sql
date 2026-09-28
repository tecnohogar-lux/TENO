-- Migración 020: el tipo de precio (SOL / MARKETPLACE) se elige por línea de producto,
-- así que una misma transacción puede mezclar ambos.
--  * sales.price_type y retiros_tienda.price_type admiten 'mixto' (transacción con líneas de ambos tipos).
--  * sales.items guarda las líneas de un envío con varios productos (NULL si tiene un solo producto).
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_price_type_check;
ALTER TABLE sales ADD CONSTRAINT sales_price_type_check CHECK (price_type IN ('sol', 'marketplace', 'mixto'));
ALTER TABLE sales ALTER COLUMN price_type TYPE VARCHAR(12);

ALTER TABLE retiros_tienda DROP CONSTRAINT IF EXISTS retiros_tienda_price_type_check;
ALTER TABLE retiros_tienda ADD CONSTRAINT retiros_tienda_price_type_check CHECK (price_type IN ('sol', 'marketplace', 'mixto'));

ALTER TABLE sales ADD COLUMN IF NOT EXISTS items JSON;
