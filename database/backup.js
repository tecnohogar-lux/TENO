// database/backup.js
// Respaldo lógico de datos (no requiere pg_dump): exporta todas las filas de
// todas las tablas como sentencias INSERT, en el mismo orden en que aparecen
// en schema.sql. La estructura (CREATE TABLE) ya vive versionada en schema.sql,
// así que este respaldo solo cubre los datos.
//
// Uso: node database/backup.js "<connectionString>" [archivo_salida.sql]
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const connectionString = process.argv[2];
const outPath = process.argv[3] || path.join(__dirname, 'backups', `backup_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.sql`);

if (!connectionString) {
  console.error('Uso: node database/backup.js "<connectionString>" [archivo_salida.sql]');
  process.exit(1);
}

function escapeIdent(name) {
  return '"' + name.replace(/"/g, '""') + '"';
}

function escapeValue(value, dataType) {
  if (value === null || value === undefined) return 'NULL';
  if (dataType === 'json' || dataType === 'jsonb') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::${dataType}`;
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  // strings, y cualquier otro tipo que pg no haya parseado (numeric llega como string)
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tablesResult = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );
  const tables = tablesResult.rows.map((r) => r.table_name);

  const lines = [];
  lines.push(`-- Respaldo de datos TENO ERP — ${new Date().toISOString()}`);
  lines.push('-- Generado con database/backup.js. Requiere que la estructura (schema.sql) ya exista en destino.');
  lines.push('BEGIN;');
  lines.push('SET session_replication_role = replica;', '');

  let totalRows = 0;
  for (const table of tables) {
    const columnsResult = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
      [table]
    );
    const columns = columnsResult.rows;
    const dataResult = await client.query(`SELECT * FROM ${escapeIdent(table)}`);

    lines.push(`-- Tabla: ${table} (${dataResult.rows.length} filas)`);
    lines.push(`DELETE FROM ${escapeIdent(table)};`);
    for (const row of dataResult.rows) {
      const values = columns.map((c) => escapeValue(row[c.column_name], c.data_type));
      lines.push(`INSERT INTO ${escapeIdent(table)} (${columns.map((c) => escapeIdent(c.column_name)).join(', ')}) VALUES (${values.join(', ')});`);
    }
    lines.push('');
    totalRows += dataResult.rows.length;
  }

  lines.push('SET session_replication_role = DEFAULT;');
  lines.push('COMMIT;');

  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  await client.end();

  console.log(`OK: ${tables.length} tablas, ${totalRows} filas en total.`);
  console.log(`Guardado en: ${outPath}`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
