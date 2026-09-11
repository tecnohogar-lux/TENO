// backend/routes/gastos.js
// Gastos y egresos. Solo Admin/Operador. Se restan en el Cierre de Caja.
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');

const requireAdminOperador = requireRole(['admin', 'operador'], 'No tienes permiso para acceder a gastos y egresos');

// ============================================
// GET - Listar gastos (paginado, más recientes primero). Soporta ?from=&to= (ISO) para acotar por fecha
// ============================================
router.get('/', authenticateToken, requireAdminOperador, async (req, res) => {
  try {
    const { page, limit, from, to } = req.query;
    const conditions = [];
    const params = [];

    if (from) {
      params.push(from);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`created_at <= $${params.length}`);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) as count FROM gastos ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const totalMontoResult = await pool.query(`SELECT COALESCE(SUM(monto), 0) as suma FROM gastos ${whereClause}`, params);

    let query = `
      SELECT g.*, u.name as created_by_name
      FROM gastos g
      LEFT JOIN users u ON g.created_by = u.id
      ${whereClause}
      ORDER BY g.created_at DESC
    `;

    let pageNum = null;
    let limitNum = null;
    if (page || limit) {
      limitNum = Math.min(parseInt(limit) || 25, 200);
      pageNum = Math.max(parseInt(page) || 1, 1);
      params.push(limitNum, (pageNum - 1) * limitNum);
      query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    }

    const result = await pool.query(query, params);

    res.json({
      total,
      page: pageNum || 1,
      limit: limitNum || total,
      totalPages: limitNum ? Math.max(Math.ceil(total / limitNum), 1) : 1,
      total_monto: parseFloat(totalMontoResult.rows[0].suma),
      gastos: result.rows
    });

  } catch (err) {
    console.error('Error al obtener gastos:', err);
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
});

// ============================================
// POST - Crear gasto
// ============================================
router.post('/', authenticateToken, requireAdminOperador, async (req, res) => {
  try {
    const user = req.user;
    const { nombre, monto } = req.body;

    if (!nombre || !monto) {
      return res.status(400).json({ error: 'Nombre y monto requeridos' });
    }

    const result = await pool.query(
      `INSERT INTO gastos (nombre, monto, created_by) VALUES ($1, $2, $3) RETURNING *`,
      [nombre, monto, user.id]
    );

    await logAudit({ userId: user.id, action: 'crear_gasto', tableName: 'gastos', recordId: result.rows[0].id, newValues: result.rows[0] });

    res.status(201).json({ message: 'Gasto registrado', gasto: result.rows[0] });

  } catch (err) {
    console.error('Error al crear gasto:', err);
    res.status(500).json({ error: 'Error al crear gasto' });
  }
});

// ============================================
// DELETE - Eliminar gasto
// ============================================
router.delete('/:id', authenticateToken, requireAdminOperador, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const result = await pool.query('DELETE FROM gastos WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }

    await logAudit({ userId: user.id, action: 'eliminar_gasto', tableName: 'gastos', recordId: Number(id) });

    res.json({ message: 'Gasto eliminado' });

  } catch (err) {
    console.error('Error al eliminar gasto:', err);
    res.status(500).json({ error: 'Error al eliminar gasto' });
  }
});

module.exports = router;
