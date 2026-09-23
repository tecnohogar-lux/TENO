// backend/routes/couriers.js
// Couriers que retiran los paquetes de Delivery Santiago. Módulo solo
// visible/editable por admin y operador; los vendedores no pueden acceder.
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');

const requireManage = requireRole(['admin', 'operador'], 'No tienes permiso para gestionar couriers');

// ============================================
// GET - Listar couriers
// ============================================
router.get('/', authenticateToken, requireManage, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM couriers ORDER BY name ASC');
    res.json({ couriers: result.rows });
  } catch (err) {
    console.error('Error al obtener couriers:', err);
    res.status(500).json({ error: 'Error al obtener couriers' });
  }
});

// ============================================
// POST - Crear courier
// ============================================
router.post('/', authenticateToken, requireManage, async (req, res) => {
  try {
    const user = req.user;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nombre requerido' });
    }

    const result = await pool.query(
      `INSERT INTO couriers (name, created_by) VALUES ($1, $2) RETURNING *`,
      [name.trim(), user.id]
    );

    await logAudit({ userId: user.id, action: 'crear_courier', tableName: 'couriers', recordId: result.rows[0].id, newValues: result.rows[0] });

    res.status(201).json({ message: 'Courier creado', courier: result.rows[0] });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un courier con ese nombre' });
    }
    console.error('Error al crear courier:', err);
    res.status(500).json({ error: 'Error al crear courier' });
  }
});

// ============================================
// DELETE - Eliminar courier
// ============================================
router.delete('/:id', authenticateToken, requireManage, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const result = await pool.query('DELETE FROM couriers WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Courier no encontrado' });
    }

    await logAudit({ userId: user.id, action: 'eliminar_courier', tableName: 'couriers', recordId: Number(id) });

    res.json({ message: 'Courier eliminado' });

  } catch (err) {
    console.error('Error al eliminar courier:', err);
    res.status(500).json({ error: 'Error al eliminar courier' });
  }
});

module.exports = router;
