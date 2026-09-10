// backend/routes/settings.js
// Configuración global de la app (clave/valor). Todos leen, solo Admin edita.
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');

// ============================================
// GET - Obtener toda la configuración (todos los roles autenticados)
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value, updated_at FROM app_settings');
    const settings = Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
    res.json(settings);
  } catch (err) {
    console.error('Error al obtener configuración:', err);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

// ============================================
// PUT - Actualizar un valor de configuración (solo Admin)
// ============================================
router.put('/:key', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { key } = req.params;
    const { value } = req.body;

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo un admin puede cambiar la configuración' });
    }
    if (value === undefined) {
      return res.status(400).json({ error: 'Valor requerido' });
    }

    const result = await pool.query(
      `INSERT INTO app_settings (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [key, String(value), user.id]
    );

    await logAudit({ userId: user.id, action: 'editar_configuracion', tableName: 'app_settings', recordId: null, newValues: result.rows[0] });

    res.json({ message: 'Configuración actualizada', setting: result.rows[0] });

  } catch (err) {
    console.error('Error al actualizar configuración:', err);
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
});

module.exports = router;
