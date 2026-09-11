// backend/routes/noticias.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');

const requireManage = (message) => requireRole(['admin', 'operador'], message);

// Crea una noticia. Se usa tanto desde las rutas de abajo como desde products.js
// para publicar automáticamente cada cambio de producto.
async function crearNoticia({ texto, tipo = 'manual', producto_id = null, userId = null }) {
  try {
    const result = await pool.query(
      `INSERT INTO noticias (tipo, texto, producto_id, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tipo, texto, producto_id, userId]
    );
    return result.rows[0];
  } catch (err) {
    // Igual que logAudit: una noticia nunca debe romper la operación principal que la generó.
    console.error('Error al crear noticia:', err.message);
    return null;
  }
}

// Limpieza perezosa: no hay scheduler en este backend, así que se corre en cada GET.
async function limpiarNoticiasViejas() {
  await pool.query(`DELETE FROM noticias WHERE created_at < NOW() - INTERVAL '30 days'`);
}

// ============================================
// GET - Listar noticias (todos los roles). Soporta ?limit= (por defecto 10)
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    await limpiarNoticiasViejas();

    const limit = Math.min(parseInt(req.query.limit) || 10, 200);

    const countResult = await pool.query('SELECT COUNT(*) as count FROM noticias');
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT n.*, u.name as created_by_name
       FROM noticias n
       LEFT JOIN users u ON n.created_by = u.id
       ORDER BY n.created_at DESC
       LIMIT $1`,
      [limit]
    );

    res.json({ total, limit, noticias: result.rows });

  } catch (err) {
    console.error('Error al obtener noticias:', err);
    res.status(500).json({ error: 'Error al obtener noticias' });
  }
});

// ============================================
// POST - Crear noticia manual (Admin/Operador)
// ============================================
router.post('/', authenticateToken, requireManage('No tienes permiso para publicar noticias'), async (req, res) => {
  try {
    const user = req.user;
    const { texto } = req.body;

    if (!texto) {
      return res.status(400).json({ error: 'Texto requerido' });
    }

    const noticia = await crearNoticia({ texto, tipo: 'manual', userId: user.id });

    if (!noticia) {
      return res.status(500).json({ error: 'Error al crear noticia' });
    }

    await logAudit({ userId: user.id, action: 'crear_noticia', tableName: 'noticias', recordId: noticia.id, newValues: noticia });

    res.status(201).json({ message: 'Noticia publicada', noticia });

  } catch (err) {
    console.error('Error al crear noticia:', err);
    res.status(500).json({ error: 'Error al crear noticia' });
  }
});

// ============================================
// PUT - Editar noticia manual (Admin/Operador)
// ============================================
router.put('/:id', authenticateToken, requireManage('No tienes permiso para editar noticias'), async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { texto } = req.body;

    if (!texto) {
      return res.status(400).json({ error: 'Texto requerido' });
    }

    const result = await pool.query(
      `UPDATE noticias SET texto = $1 WHERE id = $2 RETURNING *`,
      [texto, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }

    await logAudit({ userId: user.id, action: 'editar_noticia', tableName: 'noticias', recordId: Number(id), newValues: result.rows[0] });

    res.json({ message: 'Noticia actualizada', noticia: result.rows[0] });

  } catch (err) {
    console.error('Error al editar noticia:', err);
    res.status(500).json({ error: 'Error al editar noticia' });
  }
});

// ============================================
// DELETE - Eliminar noticia (Admin/Operador)
// ============================================
router.delete('/:id', authenticateToken, requireManage('No tienes permiso para eliminar noticias'), async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const result = await pool.query('DELETE FROM noticias WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }

    await logAudit({ userId: user.id, action: 'eliminar_noticia', tableName: 'noticias', recordId: Number(id) });

    res.json({ message: 'Noticia eliminada' });

  } catch (err) {
    console.error('Error al eliminar noticia:', err);
    res.status(500).json({ error: 'Error al eliminar noticia' });
  }
});

module.exports = router;
module.exports.crearNoticia = crearNoticia;
