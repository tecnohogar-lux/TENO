// backend/routes/preguntas.js
// Módulo Preguntas: los vendedores preguntan, admin/operador/caja responden.
// Un vendedor solo ve sus propias preguntas y respuestas, nunca las de otros.
// Se borran solas a los 15 días de creadas (limpieza perezosa, igual que Noticias).
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');

const requireStaff = (message) => requireRole(['admin', 'operador', 'caja'], message);

async function limpiarVencidas() {
  await pool.query(`DELETE FROM preguntas WHERE created_at < NOW() - INTERVAL '15 days'`);
}

// ============================================
// GET - Listar preguntas (vendedor: solo las suyas; admin/operador/caja: todas)
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (user.role === 'escaneo') {
      return res.status(403).json({ error: 'No tienes acceso a Preguntas' });
    }
    await limpiarVencidas();

    const conditions = [];
    const params = [];
    if (user.role === 'vendedor') {
      params.push(user.id);
      conditions.push(`p.vendedor_id = $${params.length}`);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT p.*, v.name as vendedor_name, r.name as respondida_por_name
       FROM preguntas p
       JOIN users v ON p.vendedor_id = v.id
       LEFT JOIN users r ON p.respondida_por = r.id
       ${whereClause}
       ORDER BY p.created_at DESC`,
      params
    );

    res.json({ total: result.rows.length, preguntas: result.rows });

  } catch (err) {
    console.error('Error al obtener preguntas:', err);
    res.status(500).json({ error: 'Error al obtener preguntas' });
  }
});

// ============================================
// GET - Cantidad de "no leídas" para la alerta del menú.
// Vendedor: respuestas suyas aún no vistas. Admin/operador/caja: preguntas sin responder.
// ============================================
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (user.role === 'escaneo') {
      return res.json({ count: 0 });
    }
    await limpiarVencidas();

    let result;
    if (user.role === 'vendedor') {
      result = await pool.query(
        `SELECT COUNT(*) as count FROM preguntas WHERE vendedor_id = $1 AND respuesta IS NOT NULL AND leida_por_vendedor = false`,
        [user.id]
      );
    } else {
      result = await pool.query(`SELECT COUNT(*) as count FROM preguntas WHERE respuesta IS NULL`);
    }

    res.json({ count: parseInt(result.rows[0].count) });

  } catch (err) {
    console.error('Error al obtener preguntas sin leer:', err);
    res.status(500).json({ error: 'Error al obtener preguntas sin leer' });
  }
});

// ============================================
// POST - Hacer una pregunta (solo vendedor)
// ============================================
router.post('/', authenticateToken, requireRole(['vendedor'], 'Solo los vendedores pueden hacer preguntas'), async (req, res) => {
  try {
    const user = req.user;
    const { pregunta } = req.body;

    if (!pregunta || !pregunta.trim()) {
      return res.status(400).json({ error: 'Escribe tu pregunta' });
    }

    const result = await pool.query(
      `INSERT INTO preguntas (vendedor_id, pregunta) VALUES ($1, $2) RETURNING *`,
      [user.id, pregunta.trim()]
    );

    res.status(201).json({ message: 'Pregunta enviada', pregunta: result.rows[0] });

  } catch (err) {
    console.error('Error al crear pregunta:', err);
    res.status(500).json({ error: 'Error al crear pregunta' });
  }
});

// ============================================
// PUT - Responder una pregunta (admin/operador/caja)
// ============================================
router.put('/:id/responder', authenticateToken, requireStaff('No tienes permiso para responder preguntas'), async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { respuesta } = req.body;

    if (!respuesta || !respuesta.trim()) {
      return res.status(400).json({ error: 'Escribe una respuesta' });
    }

    const result = await pool.query(
      `UPDATE preguntas
       SET respuesta = $1, respondida_por = $2, respondida_at = CURRENT_TIMESTAMP, leida_por_vendedor = false
       WHERE id = $3
       RETURNING *`,
      [respuesta.trim(), user.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pregunta no encontrada' });
    }

    const pregunta = result.rows[0];
    await logAudit({ userId: user.id, action: 'responder_pregunta', tableName: 'preguntas', recordId: pregunta.id, newValues: pregunta });

    res.json({ message: 'Respuesta enviada', pregunta });

  } catch (err) {
    console.error('Error al responder pregunta:', err);
    res.status(500).json({ error: 'Error al responder pregunta' });
  }
});

// ============================================
// PUT - Marcar como leídas todas las respuestas del vendedor logueado
// (se llama al abrir el módulo, para apagar la alerta)
// ============================================
router.put('/marcar-leidas', authenticateToken, requireRole(['vendedor'], 'Solo un vendedor puede marcar sus preguntas como leídas'), async (req, res) => {
  try {
    await pool.query(
      `UPDATE preguntas SET leida_por_vendedor = true WHERE vendedor_id = $1 AND respuesta IS NOT NULL AND leida_por_vendedor = false`,
      [req.user.id]
    );
    res.json({ message: 'Marcadas como leídas' });

  } catch (err) {
    console.error('Error al marcar preguntas como leídas:', err);
    res.status(500).json({ error: 'Error al marcar preguntas como leídas' });
  }
});

module.exports = router;
