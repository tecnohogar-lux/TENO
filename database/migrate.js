// Ejecuta un archivo .sql contra la base de datos configurada en backend/.env
// Uso: node database/migrate.js database/migration_002_pos_envio_es.sql
const path = require('path');
const fs = require('fs');
const backendDir = path.join(__dirname, '..', 'backend');
require(path.join(backendDir, 'node_modules', 'dotenv')).config({ path: path.join(backendDir, '.env') });
const pool = require(path.join(backendDir, 'config', 'database'));

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Uso: node database/migrate.js <archivo.sql>');
    process.exit(1);
  }

  const sql = fs.readFileSync(path.resolve(file), 'utf8');
  console.log(`Ejecutando ${file}...`);
  await pool.query(sql);
  console.log('Migración aplicada correctamente.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error al ejecutar la migración:', err.message);
  process.exit(1);
});
