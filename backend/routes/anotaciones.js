// backend/routes/anotaciones.js
// Bitácora privada de notas diarias, solo Admin/Operador (ni lectura para vendedor/escaneo).
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');

const requireAdminOperador = requireRole(['admin', 'operador'], 'No tienes permiso para acceder a las anotaciones diarias');

// ============================================
// GET - Listar anotaciones (paginado, más recientes primero)
// ============================================
router.get('/', authenticateToken, requireAdminOperador, async (req, res) => {
  try {
    const { page, limit } = req.query;

    const countResult = await pool.query('SELECT COUNT(*) as count FROM anotaciones_diarias');
    const total = parseInt(countResult.rows[0].count);

    let query = `
      SELECT a.*, u.name as created_by_name
      FROM anotaciones_diarias a
      LEFT JOIN users u ON a.created_by = u.id
      ORDER BY a.fecha DESC, a.created_at DESC
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
      anotaciones: result.rows
    });

  } catch (err) {
    console.error('Error al obtener anotaciones:', err);
    res.status(500).json({ error: 'Error al obtener anotaciones' });
  }
});

// ============================================
// POST - Crear anotación
// ============================================
router.post('/', authenticateToken, requireAdminOperador, async (req, res) => {
  try {
    const user = req.user;
    const { fecha, texto } = req.body;

    if (!texto) {
      return res.status(400).json({ error: 'Texto requerido' });
    }

    const result = await pool.query(
      `INSERT INTO anotaciones_diarias (fecha, texto, created_by)
       VALUES (COALESCE($1, CURRENT_DATE), $2, $3)
       RETURNING *`,
      [fecha || null, texto, user.id]
    );

    await logAudit({ userId: user.id, action: 'crear_anotacion', tableName: 'anotaciones_diarias', recordId: result.rows[0].id, newValues: result.rows[0] });

    res.status(201).json({ message: 'Anotación creada', anotacion: result.rows[0] });

  } catch (err) {
    console.error('Error al crear anotación:', err);
    res.status(500).json({ error: 'Error al crear anotación' });
  }
});

// ============================================
// PUT - Editar anotación
// ============================================
router.put('/:id', authenticateToken, requireAdminOperador, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { fecha, texto } = req.body;

    const result = await pool.query(
      `UPDATE anotaciones_diarias
       SET fecha = COALESCE($1, fecha),
           texto = COALESCE($2, texto),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [fecha || null, texto || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Anotación no encontrada' });
    }

    await logAudit({ userId: user.id, action: 'editar_anotacion', tableName: 'anotaciones_diarias', recordId: Number(id), newValues: result.rows[0] });

    res.json({ message: 'Anotación actualizada', anotacion: result.rows[0] });

  } catch (err) {
    console.error('Error al editar anotación:', err);
    res.status(500).json({ error: 'Error al editar anotación' });
  }
});

// ============================================
// DELETE - Eliminar anotación
// ============================================
router.delete('/:id', authenticateToken, requireAdminOperador, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const result = await pool.query('DELETE FROM anotaciones_diarias WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Anotación no encontrada' });
    }

    await logAudit({ userId: user.id, action: 'eliminar_anotacion', tableName: 'anotaciones_diarias', recordId: Number(id) });

    res.json({ message: 'Anotación eliminada' });

  } catch (err) {
    console.error('Error al eliminar anotación:', err);
    res.status(500).json({ error: 'Error al eliminar anotación' });
  }
});

module.exports = router;
