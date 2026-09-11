// backend/routes/regionShipping.js
// Costos de envío a regiones (fuera de la Región Metropolitana). Admin/Operador editan, todos ven.
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');

const requireManage = (message) => requireRole(['admin', 'operador'], message);

// ============================================
// GET - Listar costos por región/comuna (todos los roles)
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM envios_regiones ORDER BY region ASC, comuna ASC');
    res.json({ total: result.rows.length, costos: result.rows });
  } catch (err) {
    console.error('Error al obtener envíos a regiones:', err);
    res.status(500).json({ error: 'Error al obtener envíos a regiones' });
  }
});

// ============================================
// POST - Crear región/comuna con precio (Admin/Operador)
// ============================================
router.post('/', authenticateToken, requireManage('No tienes permiso para editar envíos a regiones'), async (req, res) => {
  try {
    const user = req.user;
    const { region, comuna, precio } = req.body;

    if (!region || !comuna || !precio) {
      return res.status(400).json({ error: 'Región, comuna y precio requeridos' });
    }

    const result = await pool.query(
      `INSERT INTO envios_regiones (region, comuna, precio) VALUES ($1, $2, $3) RETURNING *`,
      [region, comuna, precio]
    );

    await logAudit({ userId: user.id, action: 'crear_envio_region', tableName: 'envios_regiones', recordId: result.rows[0].id, newValues: result.rows[0] });

    res.status(201).json({ message: 'Región agregada', costo: result.rows[0] });

  } catch (err) {
    console.error('Error al crear envío a región:', err);
    res.status(500).json({ error: 'Error al crear envío a región' });
  }
});

// ============================================
// PUT - Editar precio de una región/comuna (Admin/Operador)
// ============================================
router.put('/:id', authenticateToken, requireManage('No tienes permiso para editar envíos a regiones'), async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { region, comuna, precio } = req.body;

    const result = await pool.query(
      `UPDATE envios_regiones
       SET region = COALESCE($1, region), comuna = COALESCE($2, comuna), precio = COALESCE($3, precio), updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [region || null, comuna || null, precio !== undefined && precio !== null && precio !== '' ? precio : null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    await logAudit({ userId: user.id, action: 'editar_envio_region', tableName: 'envios_regiones', recordId: Number(id), newValues: result.rows[0] });

    res.json({ message: 'Envío a región actualizado', costo: result.rows[0] });

  } catch (err) {
    console.error('Error al editar envío a región:', err);
    res.status(500).json({ error: 'Error al editar envío a región' });
  }
});

// ============================================
// DELETE - Eliminar región/comuna (Admin/Operador)
// ============================================
router.delete('/:id', authenticateToken, requireManage('No tienes permiso para eliminar envíos a regiones'), async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const result = await pool.query('DELETE FROM envios_regiones WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    await logAudit({ userId: user.id, action: 'eliminar_envio_region', tableName: 'envios_regiones', recordId: Number(id) });

    res.json({ message: 'Registro eliminado' });

  } catch (err) {
    console.error('Error al eliminar envío a región:', err);
    res.status(500).json({ error: 'Error al eliminar envío a región' });
  }
});

module.exports = router;
