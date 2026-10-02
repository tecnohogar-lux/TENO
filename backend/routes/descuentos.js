// backend/routes/descuentos.js
// Descuentos a vendedores (devoluciones, errores...) que se restan al pagar su comisión.
// Admin/operador/caja los registran; cada vendedor solo ve los suyos.
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');

const requireStaff = requireRole(['admin', 'operador', 'caja'], 'No tienes permiso para gestionar descuentos');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'vendedor' && !['admin', 'operador', 'caja'].includes(user.role)) {
      return res.status(403).json({ error: 'No tienes permiso para ver descuentos' });
    }

    const conditions = [];
    const params = [];

    if (user.role === 'vendedor') {
      params.push(user.id);
      conditions.push(`d.vendor_id = $${params.length}`);
    } else if (req.query.vendor_id) {
      params.push(Number(req.query.vendor_id));
      conditions.push(`d.vendor_id = $${params.length}`);
    }
    if (req.query.desde) {
      params.push(req.query.desde);
      conditions.push(`d.created_at >= $${params.length}`);
    }
    if (req.query.hasta) {
      params.push(req.query.hasta);
      conditions.push(`d.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT d.*, u.name as vendor_name, cb.name as created_by_name
       FROM descuentos_vendedor d
       JOIN users u ON d.vendor_id = u.id
       LEFT JOIN users cb ON d.created_by = cb.id
       ${where}
       ORDER BY d.created_at DESC
       LIMIT 500`,
      params
    );

    res.json({
      total_monto: result.rows.reduce((acc, r) => acc + parseFloat(r.monto), 0),
      descuentos: result.rows,
    });

  } catch (err) {
    console.error('Error al obtener descuentos:', err);
    res.status(500).json({ error: 'Error al obtener descuentos' });
  }
});

router.post('/', authenticateToken, requireStaff, async (req, res) => {
  try {
    const user = req.user;
    const vendorId = Number(req.body.vendor_id);
    const motivo = String(req.body.motivo || '').trim();
    const monto = Number(req.body.monto);

    if (!vendorId || !motivo || !(monto > 0)) {
      return res.status(400).json({ error: 'Vendedor, motivo y un monto mayor a 0 son requeridos' });
    }

    const vendor = await pool.query(`SELECT id FROM users WHERE id = $1 AND role = 'vendedor'`, [vendorId]);
    if (vendor.rows.length === 0) {
      return res.status(400).json({ error: 'Vendedor inválido' });
    }

    const result = await pool.query(
      'INSERT INTO descuentos_vendedor (vendor_id, motivo, monto, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [vendorId, motivo, monto, user.id]
    );

    await logAudit({ userId: user.id, action: 'crear_descuento_vendedor', tableName: 'descuentos_vendedor', recordId: result.rows[0].id, newValues: result.rows[0] });

    res.status(201).json({ message: 'Descuento registrado', descuento: result.rows[0] });

  } catch (err) {
    console.error('Error al crear descuento:', err);
    res.status(500).json({ error: 'Error al crear descuento' });
  }
});

router.delete('/:id', authenticateToken, requireStaff, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const result = await pool.query('DELETE FROM descuentos_vendedor WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Descuento no encontrado' });
    }

    await logAudit({ userId: user.id, action: 'eliminar_descuento_vendedor', tableName: 'descuentos_vendedor', recordId: Number(id), oldValues: result.rows[0] });

    res.json({ message: 'Descuento eliminado' });

  } catch (err) {
    console.error('Error al eliminar descuento:', err);
    res.status(500).json({ error: 'Error al eliminar descuento' });
  }
});

module.exports = router;
