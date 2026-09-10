// backend/routes/users.js
const express = require('express');
const router = express.Router();
const bcryptjs = require('bcryptjs');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');

// ============================================
// GET - Listar todos los usuarios
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    // Solo operadores y admins pueden ver lista de usuarios
    if (user.role === 'vendedor') {
      return res.status(403).json({ error: 'No tienes permiso para ver usuarios' });
    }

    const result = await pool.query(
      'SELECT id, name, email, role, is_active, marketplace_accounts, created_at FROM users ORDER BY created_at DESC'
    );

    res.json({
      total: result.rows.length,
      users: result.rows
    });

  } catch (err) {
    console.error('Error al obtener usuarios:', err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// ============================================
// GET - Obtener usuario actual (me)
// ============================================
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    const result = await pool.query(
      'SELECT id, name, email, role, is_active, marketplace_accounts, created_at FROM users WHERE id = $1',
      [user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Error al obtener usuario actual:', err);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// ============================================
// PUT - Cualquier usuario autenticado edita su propia info operativa
// (solo cuentas de marketplace; nombre/email/rol/contraseña los maneja el admin)
// ============================================
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { marketplace_accounts } = req.body;

    const result = await pool.query(
      `UPDATE users SET marketplace_accounts = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, name, email, role, is_active, marketplace_accounts`,
      [marketplace_accounts || null, user.id]
    );

    res.json({ message: 'Perfil actualizado', user: result.rows[0] });

  } catch (err) {
    console.error('Error al actualizar perfil:', err);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// ============================================
// POST - Crear nuevo usuario (solo admin)
// ============================================
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { name, email, password, role, marketplace_accounts } = req.body;

    // Solo admins pueden crear usuarios
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo un admin puede crear usuarios' });
    }

    // Validaciones
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Campos requeridos: name, email, password, role' });
    }

    if (!['vendedor', 'operador', 'admin', 'escaneo'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    // Verificar que el email no exista
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email ya registrado' });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, is_active, marketplace_accounts)
       VALUES ($1, $2, $3, $4, true, $5)
       RETURNING id, name, email, role, is_active, marketplace_accounts, created_at`,
      [name, email, hashedPassword, role, marketplace_accounts || null]
    );

    await logAudit({
      userId: user.id,
      action: 'crear_usuario',
      tableName: 'users',
      recordId: result.rows[0].id,
      newValues: { name, email, role }
    });

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user: result.rows[0]
    });

  } catch (err) {
    console.error('Error al crear usuario:', err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// ============================================
// PUT - Actualizar usuario (solo admin)
// ============================================
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { name, email, role, is_active, password, marketplace_accounts } = req.body;

    // Solo admins pueden editar usuarios
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo un admin puede editar usuarios' });
    }

    const before = await pool.query('SELECT name, email, role, is_active FROM users WHERE id = $1', [id]);

    if (password) {
      const hashedPassword = await bcryptjs.hash(password, 10);
      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);
    }

    const result = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           role = COALESCE($3, role),
           is_active = COALESCE($4, is_active),
           marketplace_accounts = COALESCE($5, marketplace_accounts),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, name, email, role, is_active, marketplace_accounts, updated_at`,
      [name, email, role, is_active, marketplace_accounts, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (before.rows.length > 0) {
      await logAudit({
        userId: user.id,
        action: 'editar_usuario',
        tableName: 'users',
        recordId: Number(id),
        oldValues: before.rows[0],
        newValues: { name, email, role, is_active }
      });
    }

    res.json({
      message: 'Usuario actualizado',
      user: result.rows[0]
    });

  } catch (err) {
    console.error('Error al actualizar usuario:', err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// ============================================
// PUT - Activar/Desactivar usuario
// ============================================
router.put('/:id/toggle-status', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    // Solo admin puede hacer esto
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo admins pueden cambiar estado de usuarios' });
    }

    const result = await pool.query(
      `UPDATE users
       SET is_active = NOT is_active,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, email, role, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      message: `Usuario ${result.rows[0].is_active ? 'activado' : 'desactivado'}`,
      user: result.rows[0]
    });

  } catch (err) {
    console.error('Error al cambiar estado:', err);
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
});

// ============================================
// DELETE - Eliminar usuario (solo admin)
// ============================================
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo un admin puede eliminar usuarios' });
    }

    if (user.id === parseInt(id)) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    }

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await logAudit({ userId: user.id, action: 'eliminar_usuario', tableName: 'users', recordId: Number(id) });

    res.json({ message: 'Usuario eliminado' });

  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({
        error: 'No se puede eliminar: este usuario tiene ventas u otros registros asociados. Desactívalo en su lugar.'
      });
    }
    console.error('Error al eliminar usuario:', err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

module.exports = router;
