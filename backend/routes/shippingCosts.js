// backend/routes/shippingCosts.js
// Costos de envío por comuna (Región Metropolitana). Admin/Operador editan, todos ven.
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');

// ============================================
// GET - Listar costos por comuna (todos los roles)
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM costos_envio_comuna ORDER BY comuna ASC');
    res.json({ total: result.rows.length, costos: result.rows });
  } catch (err) {
    console.error('Error al obtener costos de envío:', err);
    res.status(500).json({ error: 'Error al obtener costos de envío' });
  }
});

// ============================================
// POST - Crear comuna con precio (Admin/Operador)
// ============================================
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { comuna, precio } = req.body;

    if (user.role !== 'admin' && user.role !== 'operador') {
      return res.status(403).json({ error: 'No tienes permiso para editar costos de envío' });
    }
    if (!comuna || !precio) {
      return res.status(400).json({ error: 'Comuna y precio requeridos' });
    }

    const result = await pool.query(
      `INSERT INTO costos_envio_comuna (comuna, precio) VALUES ($1, $2) RETURNING *`,
      [comuna, precio]
    );

    await logAudit({ userId: user.id, action: 'crear_costo_envio', tableName: 'costos_envio_comuna', recordId: result.rows[0].id, newValues: result.rows[0] });

    res.status(201).json({ message: 'Comuna agregada', costo: result.rows[0] });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Esa comuna ya tiene un precio cargado' });
    }
    console.error('Error al crear costo de envío:', err);
    res.status(500).json({ error: 'Error al crear costo de envío' });
  }
});

// ============================================
// PUT - Editar precio de una comuna (Admin/Operador)
// ============================================
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { comuna, precio } = req.body;

    if (user.role !== 'admin' && user.role !== 'operador') {
      return res.status(403).json({ error: 'No tienes permiso para editar costos de envío' });
    }

    const result = await pool.query(
      `UPDATE costos_envio_comuna
       SET comuna = COALESCE($1, comuna), precio = COALESCE($2, precio), updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [comuna || null, precio || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comuna no encontrada' });
    }

    await logAudit({ userId: user.id, action: 'editar_costo_envio', tableName: 'costos_envio_comuna', recordId: Number(id), newValues: result.rows[0] });

    res.json({ message: 'Costo de envío actualizado', costo: result.rows[0] });

  } catch (err) {
    console.error('Error al editar costo de envío:', err);
    res.status(500).json({ error: 'Error al editar costo de envío' });
  }
});

// ============================================
// DELETE - Eliminar comuna (Admin/Operador)
// ============================================
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (user.role !== 'admin' && user.role !== 'operador') {
      return res.status(403).json({ error: 'No tienes permiso para eliminar costos de envío' });
    }

    const result = await pool.query('DELETE FROM costos_envio_comuna WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comuna no encontrada' });
    }

    await logAudit({ userId: user.id, action: 'eliminar_costo_envio', tableName: 'costos_envio_comuna', recordId: Number(id) });

    res.json({ message: 'Comuna eliminada' });

  } catch (err) {
    console.error('Error al eliminar costo de envío:', err);
    res.status(500).json({ error: 'Error al eliminar costo de envío' });
  }
});

module.exports = router;
