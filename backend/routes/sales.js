// backend/routes/sales.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// GET - Obtener todas las ventas (según rol)
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    let query;
    let params;

    if (user.role === 'vendedor') {
      // Vendedor solo ve sus ventas
      query = `
        SELECT s.*, u.name as vendor_name, c.name as client_name 
        FROM sales s
        JOIN users u ON s.vendor_id = u.id
        JOIN clients c ON s.client_id = c.id
        WHERE s.vendor_id = $1
        ORDER BY s.created_at DESC
      `;
      params = [user.id];
    } else {
      // Operador y Admin ven todas
      query = `
        SELECT s.*, u.name as vendor_name, c.name as client_name 
        FROM sales s
        JOIN users u ON s.vendor_id = u.id
        JOIN clients c ON s.client_id = c.id
        ORDER BY s.created_at DESC
      `;
      params = [];
    }

    const result = await pool.query(query, params);
    res.json({
      total: result.rows.length,
      sales: result.rows
    });

  } catch (err) {
    console.error('Error al obtener ventas:', err);
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
});

// ============================================
// GET - Obtener venta por ID
// ============================================
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const result = await pool.query(
      `SELECT s.*, u.name as vendor_name, c.name as client_name 
       FROM sales s
       JOIN users u ON s.vendor_id = u.id
       JOIN clients c ON s.client_id = c.id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const sale = result.rows[0];

    // Validar permisos
    if (user.role === 'vendedor' && sale.vendor_id !== user.id) {
      return res.status(403).json({ error: 'No tienes permiso para ver esta venta' });
    }

    res.json(sale);

  } catch (err) {
    console.error('Error al obtener venta:', err);
    res.status(500).json({ error: 'Error al obtener venta' });
  }
});

// ============================================
// POST - Crear nueva venta
// ============================================
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { client_id, product_name, quantity, price, address, phone, notes } = req.body;

    // Validaciones
    if (!client_id || !product_name || !quantity || !price) {
      return res.status(400).json({ error: 'Campos requeridos faltantes' });
    }

    // Verificar que no exista venta duplicada
    const duplicate = await pool.query(
      `SELECT id FROM sales 
       WHERE vendor_id = $1 AND client_id = $2 AND product_name = $3`,
      [user.id, client_id, product_name]
    );

    if (duplicate.rows.length > 0) {
      return res.status(400).json({ error: 'Esta venta ya existe (producto + cliente duplicado)' });
    }

    const total = quantity * price;

    const result = await pool.query(
      `INSERT INTO sales (vendor_id, client_id, product_name, quantity, price, total, address, phone, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [user.id, client_id, product_name, quantity, price, total, address, phone, notes]
    );

    res.status(201).json({
      message: 'Venta creada exitosamente',
      sale: result.rows[0]
    });

  } catch (err) {
    console.error('Error al crear venta:', err);
    res.status(500).json({ error: 'Error al crear venta' });
  }
});

// ============================================
// PUT - Actualizar venta
// ============================================
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { status, delivery_status, notes } = req.body;

    // Obtener venta actual
    const saleResult = await pool.query('SELECT * FROM sales WHERE id = $1', [id]);

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const sale = saleResult.rows[0];

    // Validar permisos (vendedor solo su venta, operador y admin todas)
    if (user.role === 'vendedor' && sale.vendor_id !== user.id) {
      return res.status(403).json({ error: 'No tienes permiso para editar esta venta' });
    }

    const result = await pool.query(
      `UPDATE sales 
       SET status = COALESCE($1, status),
           delivery_status = COALESCE($2, delivery_status),
           notes = COALESCE($3, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, delivery_status, notes, id]
    );

    res.json({
      message: 'Venta actualizada',
      sale: result.rows[0]
    });

  } catch (err) {
    console.error('Error al actualizar venta:', err);
    res.status(500).json({ error: 'Error al actualizar venta' });
  }
});

// ============================================
// DELETE - Cancelar venta
// ============================================
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const saleResult = await pool.query('SELECT * FROM sales WHERE id = $1', [id]);

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const sale = saleResult.rows[0];

    if (user.role === 'vendedor' && sale.vendor_id !== user.id) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta venta' });
    }

    await pool.query(
      'UPDATE sales SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['cancelled', id]
    );

    res.json({ message: 'Venta cancelada' });

  } catch (err) {
    console.error('Error al cancelar venta:', err);
    res.status(500).json({ error: 'Error al cancelar venta' });
  }
});

module.exports = router;