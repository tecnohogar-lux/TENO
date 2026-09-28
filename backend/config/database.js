// Conexión a PostgreSQL
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Un solo aviso al abrir la primera conexión (el pool abre varias durante el uso).
pool.once('connect', () => {
  console.log('✓ Conectado a PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Error en pool de conexión:', err);
});

// Exportar el pool
module.exports = pool;