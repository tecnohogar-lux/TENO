-- Migración 023:
--  * Nuevo rol 'caja' (mismos permisos que 'operador'; su pantalla de inicio es el módulo Caja).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('vendedor', 'operador', 'admin', 'escaneo', 'caja'));
