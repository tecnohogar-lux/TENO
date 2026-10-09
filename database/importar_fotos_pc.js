// Importa a fotos_entregas las fotos que contó el programa del PC (contador-fotos/data/conteo.json),
// para no perderlas al pasar el conteo a TENO. Se puede correr más de una vez: no duplica.
// Antes de correrlo, cierra el programa del PC (solo uno puede leer los mensajes del bot).
// Uso: node database/importar_fotos_pc.js "C:\Users\...\contador-fotos\data\conteo.json"
const path = require('path');
const fs = require('fs');
const backendDir = path.join(__dirname, '..', 'backend');
require(path.join(backendDir, 'node_modules', 'dotenv')).config({ path: path.join(backendDir, '.env') });
const pool = require(path.join(backendDir, 'config', 'database'));

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Uso: node database/importar_fotos_pc.js <ruta a conteo.json>');
    process.exit(1);
  }
  const datos = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  let importadas = 0;
  for (const [clave, foto] of Object.entries(datos.photos || {})) {
    const [chatId, messageId] = clave.split(':');
    const r = await pool.query(
      `INSERT INTO fotos_entregas (chat_id, message_id, fecha, fecha_envio, enviado_at, enviado_por)
       VALUES ($1, $2, $3, (to_timestamp($4) AT TIME ZONE 'America/Santiago')::date, to_timestamp($4), $5)
       ON CONFLICT (chat_id, message_id) DO NOTHING`,
      [chatId, messageId, foto.day, foto.ts, foto.sender]
    );
    importadas += r.rowCount;
  }
  // Seguir leyendo Telegram desde donde quedó el programa del PC.
  await pool.query('UPDATE fotos_entregas_estado SET telegram_offset = GREATEST(telegram_offset, $1) WHERE id = 1', [datos.offset || 0]);
  console.log(`${importadas} fotos importadas (de ${Object.keys(datos.photos || {}).length} en el archivo).`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error al importar:', err.message);
  process.exit(1);
});
