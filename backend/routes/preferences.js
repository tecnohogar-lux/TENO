// backend/routes/preferences.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// GET - Obtener preferencias del usuario
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    const result = await pool.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [user.id]
    );

    if (result.rows.length === 0) {
      // Si no existen, crear con valores por defecto
      const defaultPrefs = await pool.query(
        `INSERT INTO user_preferences (user_id, theme, module_order)
         VALUES ($1, 'light', '[]')
         RETURNING *`,
        [user.id]
      );
      return res.json(defaultPrefs.rows[0]);
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Error al obtener preferencias:', err);
    res.status(500).json({ error: 'Error al obtener preferencias' });
  }
});

// ============================================
// PUT - Actualizar tema
// ============================================
router.put('/theme', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { theme } = req.body;

    // Validar tema
    const validThemes = ['light', 'dark'];
    if (!validThemes.includes(theme)) {
      return res.status(400).json({
        error: 'Tema inválido. Opciones: light, dark'
      });
    }

    // Verificar si existen preferencias
    const existing = await pool.query(
      'SELECT id FROM user_preferences WHERE user_id = $1',
      [user.id]
    );

    let result;
    if (existing.rows.length === 0) {
      result = await pool.query(
        `INSERT INTO user_preferences (user_id, theme, module_order)
         VALUES ($1, $2, '[]')
         RETURNING *`,
        [user.id, theme]
      );
    } else {
      result = await pool.query(
        `UPDATE user_preferences 
         SET theme = $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2
         RETURNING *`,
        [theme, user.id]
      );
    }

    res.json({
      message: 'Tema actualizado',
      preferences: result.rows[0]
    });

  } catch (err) {
    console.error('Error al actualizar tema:', err);
    res.status(500).json({ error: 'Error al actualizar tema' });
  }
});

// ============================================
// PUT - Actualizar orden de módulos
// ============================================
router.put('/module-order', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { moduleOrder } = req.body;

    // Validar que sea un array
    if (!Array.isArray(moduleOrder)) {
      return res.status(400).json({ error: 'moduleOrder debe ser un array' });
    }

    // Verificar si existen preferencias
    const existing = await pool.query(
      'SELECT id FROM user_preferences WHERE user_id = $1',
      [user.id]
    );

    let result;
    if (existing.rows.length === 0) {
      result = await pool.query(
        `INSERT INTO user_preferences (user_id, theme, module_order)
         VALUES ($1, 'light', $2)
         RETURNING *`,
        [user.id, JSON.stringify(moduleOrder)]
      );
    } else {
      result = await pool.query(
        `UPDATE user_preferences 
         SET module_order = $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2
         RETURNING *`,
        [JSON.stringify(moduleOrder), user.id]
      );
    }

    res.json({
      message: 'Orden de módulos actualizado',
      preferences: result.rows[0]
    });

  } catch (err) {
    console.error('Error al actualizar módulos:', err);
    res.status(500).json({ error: 'Error al actualizar módulos' });
  }
});

// ============================================
// PUT - Actualizar ambos (tema + módulos)
// ============================================
router.put('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { theme, moduleOrder } = req.body;

    // Validaciones
    if (theme) {
      const validThemes = ['light', 'dark'];
      if (!validThemes.includes(theme)) {
        return res.status(400).json({ error: 'Tema inválido' });
      }
    }

    if (moduleOrder && !Array.isArray(moduleOrder)) {
      return res.status(400).json({ error: 'moduleOrder debe ser un array' });
    }

    // Verificar si existen preferencias
    const existing = await pool.query(
      'SELECT id FROM user_preferences WHERE user_id = $1',
      [user.id]
    );

    let result;
    if (existing.rows.length === 0) {
      result = await pool.query(
        `INSERT INTO user_preferences (user_id, theme, module_order)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [user.id, theme || 'light', JSON.stringify(moduleOrder || [])]
      );
    } else {
      result = await pool.query(
        `UPDATE user_preferences 
         SET theme = COALESCE($1, theme),
             module_order = COALESCE($2, module_order),
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $3
         RETURNING *`,
        [theme || null, moduleOrder ? JSON.stringify(moduleOrder) : null, user.id]
      );
    }

    res.json({
      message: 'Preferencias actualizadas',
      preferences: result.rows[0]
    });

  } catch (err) {
    console.error('Error al actualizar preferencias:', err);
    res.status(500).json({ error: 'Error al actualizar preferencias' });
  }
});

module.exports = router;