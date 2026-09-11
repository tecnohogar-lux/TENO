// backend/routes/audit.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// ============================================
// GET - Historial de auditoría (solo admin)
// ============================================
router.get('/', authenticateToken, requireRole(['admin'], 'Solo un admin puede ver la auditoría'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);

    const result = await pool.query(
      `SELECT a.*, u.name as user_name
       FROM audit_log a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT $1`,
      [limit]
    );

    res.json({ total: result.rows.length, entries: result.rows });

  } catch (err) {
    console.error('Error al obtener auditoría:', err);
    res.status(500).json({ error: 'Error al obtener auditoría' });
  }
});

module.exports = router;
