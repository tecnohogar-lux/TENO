// backend/routes/clients.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const requireManage = (message) => requireRole(['admin', 'operador'], message);

// ============================================
// GET - Obtener todos los clientes
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(c.name ILIKE $${idx} OR c.email ILIKE $${idx} OR c.phone ILIKE $${idx})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM clients c ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    let query = `
      SELECT c.*, u.name as created_by_name
      FROM clients c
      JOIN users u ON c.created_by = u.id
      ${whereClause}
      ORDER BY c.name ASC
    `;

    let pageNum = null;
    let limitNum = null;
    if (page || limit) {
      limitNum = Math.min(parseInt(limit) || 50, 200);
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
      clients: result.rows
    });

  } catch (err) {
    console.error('Error al obtener clientes:', err);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// ============================================
// GET - Obtener cliente por ID
// ============================================
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT c.*, u.name as created_by_name 
       FROM clients c
       JOIN users u ON c.created_by = u.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Error al obtener cliente:', err);
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
});

// ============================================
// POST - Crear nuevo cliente
// ============================================
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { name, address, phone, email } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nombre del cliente requerido' });
    }

    const result = await pool.query(
      `INSERT INTO clients (name, address, phone, email, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, address, phone, email, user.id]
    );

    res.status(201).json({
      message: 'Cliente creado exitosamente',
      client: result.rows[0]
    });

  } catch (err) {
    console.error('Error al crear cliente:', err);
    res.status(500).json({ error: 'Error al crear cliente' });
  }
});

// ============================================
// PUT - Actualizar cliente
// ============================================
router.put('/:id', authenticateToken, requireManage('No tienes permiso para editar clientes'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { name, address, phone, email } = req.body;

    const result = await pool.query(
      `UPDATE clients
       SET name = COALESCE($1, name),
           address = COALESCE($2, address),
           phone = COALESCE($3, phone),
           email = COALESCE($4, email),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [name, address, phone, email, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json({
      message: 'Cliente actualizado',
      client: result.rows[0]
    });

  } catch (err) {
    console.error('Error al actualizar cliente:', err);
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
});

// ============================================
// DELETE - Eliminar cliente (operador/admin)
// ============================================
router.delete('/:id', authenticateToken, requireManage('No tienes permiso para eliminar clientes'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const result = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json({ message: 'Cliente eliminado' });

  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'No se puede eliminar: este cliente tiene ventas asociadas' });
    }
    console.error('Error al eliminar cliente:', err);
    res.status(500).json({ error: 'Error al eliminar cliente' });
  }
});

module.exports = router;