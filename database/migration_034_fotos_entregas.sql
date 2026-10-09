-- Migración 034: módulo "Fotos de entregas".
-- Los repartidores mandan las fotos de los paquetes entregados a un grupo de Telegram. Al pulsar
-- "Actualizar" (o a las 22:00 con la tarea automática) el backend lee del bot las fotos nuevas y
-- las guarda acá; los totales por día se calculan con GROUP BY. Solo admin.
--
--  * fotos_entregas: una fila por foto (mensaje de Telegram).
--      fecha        = día al que cuenta la foto (el del envío, o el que indicó el repartidor
--                     en la descripción, p. ej. "lunes", o el que asignó un admin).
--      fecha_envio  = día (hora de Chile) en que se mandó la foto al grupo.
--      fecha_origen = de dónde salió "fecha": envio | descripcion | manual.
--  * fotos_entregas_estado: una sola fila con hasta dónde se leyó Telegram y la última actualización.

CREATE TABLE IF NOT EXISTS fotos_entregas (
  id SERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  media_group_id VARCHAR(64),
  fecha DATE NOT NULL,
  fecha_envio DATE NOT NULL,
  fecha_origen VARCHAR(12) NOT NULL DEFAULT 'envio' CHECK (fecha_origen IN ('envio', 'descripcion', 'manual')),
  enviado_at TIMESTAMPTZ NOT NULL,
  enviado_por VARCHAR(150) NOT NULL,
  telegram_user_id BIGINT,
  descripcion TEXT,
  movida_por INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (chat_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_fotos_entregas_fecha ON fotos_entregas (fecha);
CREATE INDEX IF NOT EXISTS idx_fotos_entregas_fecha_envio ON fotos_entregas (fecha_envio);
CREATE INDEX IF NOT EXISTS idx_fotos_entregas_media_group ON fotos_entregas (media_group_id) WHERE media_group_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS fotos_entregas_estado (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  telegram_offset BIGINT NOT NULL DEFAULT 0,
  ultima_actualizacion TIMESTAMPTZ,
  ultima_actualizacion_origen VARCHAR(12),
  ultimo_resultado JSONB
);
INSERT INTO fotos_entregas_estado (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
