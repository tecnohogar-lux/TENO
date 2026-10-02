// backend/routes/ingresos.js
// Ingresos de dinero a caja (pagos de deudas, abonos, etc.): efectivo que entra a la
// caja abierta sin pertenecer a ninguna venta. No generan comisión ni costo.
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');

const requireStaff = requireRole(['admin', 'operador', 'caja'], 'No tienes permiso para acceder a ingresos');

router.get('/', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { page, limit } = req.query;

    const countResult = await pool.query('SELECT COUNT(*) as count, COALESCE(SUM(monto), 0) as suma FROM ingresos_caja');
    const total = parseInt(countResult.rows[0].count);

    let query = `
      SELECT i.*, u.name as created_by_name
      FROM ingresos_caja i
      LEFT JOIN users u ON i.created_by = u.id
      ORDER BY i.created_at DESC
    `;
    const params = [];

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
      total_monto: parseFloat(countResult.rows[0].suma),
      ingresos: result.rows
    });

  } catch (err) {
    console.error('Error al obtener ingresos:', err);
    res.status(500).json({ error: 'Error al obtener ingresos' });
  }
});

router.post('/', authenticateToken, requireStaff, async (req, res) => {
  try {
    const user = req.user;
    const nombre = String(req.body.nombre || '').trim();
    const monto = Number(req.body.monto);

    if (!nombre || !(monto > 0)) {
      return res.status(400).json({ error: 'Nombre y un monto mayor a 0 son requeridos' });
    }

    // Igual que las ventas, el dinero solo puede entrar a una caja que esté abierta.
    const cajaAbierta = await pool.query('SELECT id FROM cierre_caja WHERE closed_at IS NULL LIMIT 1');
    if (cajaAbierta.rows.length === 0) {
      return res.status(409).json({ error: 'No hay una caja abierta. Abre una desde Apertura/Cierre de Caja antes de registrar un ingreso.' });
    }

    const result = await pool.query(
      'INSERT INTO ingresos_caja (nombre, monto, created_by) VALUES ($1, $2, $3) RETURNING *',
      [nombre, monto, user.id]
    );

    await logAudit({ userId: user.id, action: 'crear_ingreso_caja', tableName: 'ingresos_caja', recordId: result.rows[0].id, newValues: result.rows[0] });

    res.status(201).json({ message: 'Ingreso registrado', ingreso: result.rows[0] });

  } catch (err) {
    console.error('Error al crear ingreso:', err);
    res.status(500).json({ error: 'Error al crear ingreso' });
  }
});

router.delete('/:id', authenticateToken, requireStaff, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const result = await pool.query('DELETE FROM ingresos_caja WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ingreso no encontrado' });
    }

    await logAudit({ userId: user.id, action: 'eliminar_ingreso_caja', tableName: 'ingresos_caja', recordId: Number(id), oldValues: result.rows[0] });

    res.json({ message: 'Ingreso eliminado' });

  } catch (err) {
    console.error('Error al eliminar ingreso:', err);
    res.status(500).json({ error: 'Error al eliminar ingreso' });
  }
});

module.exports = router;
