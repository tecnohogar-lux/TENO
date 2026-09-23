-- Migración 012: hora límite de envíos diferenciada para sábado y domingo,
-- además de la hora de lunes a viernes ya existente (envio_deadline_hora).

INSERT INTO app_settings (key, value) VALUES ('envio_deadline_hora_sabado', '18:00')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value) VALUES ('envio_deadline_hora_domingo', '18:00')
ON CONFLICT (key) DO NOTHING;
