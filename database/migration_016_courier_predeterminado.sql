-- Migración 016: courier predeterminado para envíos nuevos de Delivery Santiago.
-- Se guarda en app_settings (clave 'default_courier_id'); si Mattos existe se
-- deja precargado como valor inicial, editable luego desde Configuración.
INSERT INTO app_settings (key, value)
SELECT 'default_courier_id', id::text FROM couriers WHERE name = 'Mattos'
ON CONFLICT (key) DO NOTHING;
