-- Migración 021: nuevo tipo de precio 'mayor' (venta al mayor: mínimo 6 unidades y precio libre).
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_price_type_check;
ALTER TABLE sales ADD CONSTRAINT sales_price_type_check CHECK (price_type IN ('sol', 'marketplace', 'mayor', 'mixto'));

ALTER TABLE retiros_tienda DROP CONSTRAINT IF EXISTS retiros_tienda_price_type_check;
ALTER TABLE retiros_tienda ADD CONSTRAINT retiros_tienda_price_type_check CHECK (price_type IN ('sol', 'marketplace', 'mayor', 'mixto'));
