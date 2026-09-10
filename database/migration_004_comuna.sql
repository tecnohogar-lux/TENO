-- Migración 004: agrega comuna para las etiquetas de envío (se muestra grande en la etiqueta impresa)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS comuna VARCHAR(100);
