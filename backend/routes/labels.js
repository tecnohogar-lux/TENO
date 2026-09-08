// backend/routes/labels.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// GET - Obtener todas las etiquetas
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    let query;
    let params;

    if (user.role === 'vendedor') {
      // Vendedor solo ve sus etiquetas
      query = `
        SELECT l.*, u.name as created_by_name 
        FROM labels l
        JOIN users u ON l.created_by = u.id
        WHERE l.created_by = $1
        ORDER BY l.name ASC
      `;
      params = [user.id];
    } else {
      // Operador y Admin ven todas
      query = `
        SELECT l.*, u.name as created_by_name 
        FROM labels l
        JOIN users u ON l.created_by = u.id
        ORDER BY l.name ASC
      `;
      params = [];
    }

    const result = await pool.query(query, params);
    res.json({
      total: result.rows.length,
      labels: result.rows
    });

  } catch (err) {
    console.error('Error al obtener etiquetas:', err);
    res.status(500).json({ error: 'Error al obtener etiquetas' });
  }
});

// ============================================
// GET - Obtener etiqueta por ID
// ============================================
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const result = await pool.query(
      `SELECT l.*, u.name as created_by_name 
       FROM labels l
       JOIN users u ON l.created_by = u.id
       WHERE l.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Etiqueta no encontrada' });
    }

    const label = result.rows[0];

    // Vendedor solo ve sus etiquetas
    if (user.role === 'vendedor' && label.created_by !== user.id) {
      return res.status(403).json({ error: 'No tienes permiso para ver esta etiqueta' });
    }

    res.json(label);

  } catch (err) {
    console.error('Error al obtener etiqueta:', err);
    res.status(500).json({ error: 'Error al obtener etiqueta' });
  }
});

// ============================================
// POST - Crear nueva etiqueta
// ============================================
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { name, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nombre de etiqueta requerido' });
    }

    const result = await pool.query(
      `INSERT INTO labels (name, notes, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, notes || null, user.id]
    );

    res.status(201).json({
      message: 'Etiqueta creada exitosamente',
      label: result.rows[0]
    });

  } catch (err) {
    console.error('Error al crear etiqueta:', err);
    res.status(500).json({ error: 'Error al crear etiqueta' });
  }
});

// ============================================
// PUT - Actualizar etiqueta
// ============================================
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { name, notes } = req.body;

    // Obtener etiqueta actual
    const labelResult = await pool.query('SELECT * FROM labels WHERE id = $1', [id]);

    if (labelResult.rows.length === 0) {
      return res.status(404).json({ error: 'Etiqueta no encontrada' });
    }

    const label = labelResult.rows[0];

    // Validar permisos (vendedor solo sus etiquetas, operador y admin todas)
    if (user.role === 'vendedor' && label.created_by !== user.id) {
      return res.status(403).json({ error: 'No tienes permiso para editar esta etiqueta' });
    }

    const result = await pool.query(
      `UPDATE labels 
       SET name = COALESCE($1, name),
           notes = COALESCE($2, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [name, notes, id]
    );

    res.json({
      message: 'Etiqueta actualizada',
      label: result.rows[0]
    });

  } catch (err) {
    console.error('Error al actualizar etiqueta:', err);
    res.status(500).json({ error: 'Error al actualizar etiqueta' });
  }
});

// ============================================
// DELETE - Eliminar etiqueta
// ============================================
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Obtener etiqueta
    const labelResult = await pool.query('SELECT * FROM labels WHERE id = $1', [id]);

    if (labelResult.rows.length === 0) {
      return res.status(404).json({ error: 'Etiqueta no encontrada' });
    }

    const label = labelResult.rows[0];

    // Validar permisos
    if (user.role === 'vendedor' && label.created_by !== user.id) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta etiqueta' });
    }

    await pool.query('DELETE FROM labels WHERE id = $1', [id]);

    res.json({ message: 'Etiqueta eliminada' });

  } catch (err) {
    console.error('Error al eliminar etiqueta:', err);
    res.status(500).json({ error: 'Error al eliminar etiqueta' });
  }
});

module.exports = router;