// backend/routes/users.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

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
      'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
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
      'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = $1',
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
// POST - Crear nuevo usuario (vendedor/operador)
// ============================================
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { name, email, password, role } = req.body;

    // Solo operadores y admins pueden crear usuarios
    if (user.role === 'vendedor') {
      return res.status(403).json({ error: 'No tienes permiso para crear usuarios' });
    }

    // Validaciones
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Campos requeridos: name, email, password, role' });
    }

    if (!['vendedor', 'operador', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    // Verificar que el email no exista
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email ya registrado' });
    }

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, name, email, role, is_active, created_at`,
      [name, email, password, role]
    );

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
// PUT - Actualizar usuario
// ============================================
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { name, email, role, is_active } = req.body;

    // Solo admins pueden cambiar rol y estado
    if (user.role !== 'admin' && (role || is_active !== undefined)) {
      return res.status(403).json({ error: 'Solo admins pueden cambiar rol o estado' });
    }

    // Vendedores solo pueden editar su propio perfil
    if (user.role === 'vendedor' && user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'No puedes editar otros usuarios' });
    }

    const result = await pool.query(
      `UPDATE users 
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           role = COALESCE($3, role),
           is_active = COALESCE($4, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, name, email, role, is_active, updated_at`,
      [name, email, role, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
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

module.exports = router;