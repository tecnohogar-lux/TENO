const pool = require('../config/database');

async function logAudit({ userId, action, tableName, recordId, oldValues, newValues }) {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, tableName, recordId, oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null]
    );
  } catch (err) {
    // La auditoría nunca debe romper la operación principal
    console.error('Error al registrar auditoría:', err.message);
  }
}

module.exports = { logAudit };
