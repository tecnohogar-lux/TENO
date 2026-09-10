-- Migración 006: nuevo rol "escaneo" (repartidor) — solo escanea QR y ve el estado de envíos.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('vendedor', 'operador', 'admin', 'escaneo'));

INSERT INTO users (name, email, password, role, is_active) VALUES
('Escaneo Test', 'escaneo@teno.com', '$2a$10$Wy.aX.KIIVr9HYr0E4q6CeKm.R7z6.0UR1s4sJ3BoYlVb4dQjyGZu', 'escaneo', true)
ON CONFLICT DO NOTHING;
