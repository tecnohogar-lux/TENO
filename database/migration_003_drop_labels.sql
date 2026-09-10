-- Migración 003: el módulo de Etiquetas se fusiona con Envíos.
-- Las "etiquetas" ahora son las ventas de tipo ENVIO; la tabla genérica de tags ya no se usa.
DROP TABLE IF EXISTS sale_labels;
DROP TABLE IF EXISTS labels;
