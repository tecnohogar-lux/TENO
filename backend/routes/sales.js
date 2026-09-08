// backend/routes/sales.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const DELIVERY_STATUSES = ['listo_para_imprimir', 'impreso', 'en_camino', 'entregado', 'cancelado', 'reprogramado'];

// ============================================
// GET - Envíos pendientes (no entregados ni cancelados)
// ============================================
router.get('/pending-delivery', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.name as vendor_name, c.name as client_name
       FROM sales s
       JOIN users u ON s.vendor_id = u.id
       JOIN clients c ON s.client_id = c.id
       WHERE s.tipo_venta = 'ENVIO' AND s.delivery_status NOT IN ('entregado', 'cancelado')
       ORDER BY s.created_at ASC`
    );

    res.json({
      total: result.rows.length,
      sales: result.rows
    });

  } catch (err) {
    console.error('Error al obtener envíos pendientes:', err);
    res.status(500).json({ error: 'Error al obtener envíos pendientes' });
  }
});

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
// POST - Crear nueva venta (envío, creada por el vendedor)
// ============================================
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { client_id, product_name, quantity, price, address, phone, notes } = req.body;

    // Validaciones
    if (!client_id || !product_name || !quantity || !price) {
      return res.status(400).json({ error: 'Campos requeridos faltantes' });
    }

    const total = quantity * price;

    const result = await pool.query(
      `INSERT INTO sales (vendor_id, client_id, product_name, quantity, price, total, address, phone, notes, tipo_venta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ENVIO')
       RETURNING *`,
      [user.id, client_id, product_name, quantity, price, total, address, phone, notes]
    );

    const sale = result.rows[0];

    const withQr = await pool.query(
      `UPDATE sales SET qr_code = $1 WHERE id = $2 RETURNING *`,
      [`TENO-${sale.id}`, sale.id]
    );

    res.status(201).json({
      message: 'Venta creada exitosamente',
      sale: withQr.rows[0]
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
// PUT - Cambiar estado del paquete (envío)
// ============================================
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { status } = req.body;

    if (!DELIVERY_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Estado inválido. Opciones: ${DELIVERY_STATUSES.join(', ')}` });
    }

    const saleResult = await pool.query('SELECT * FROM sales WHERE id = $1', [id]);

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const sale = saleResult.rows[0];

    if (sale.tipo_venta !== 'ENVIO') {
      return res.status(400).json({ error: 'Solo las ventas de tipo envío tienen estado de paquete' });
    }

    if (user.role === 'vendedor' && sale.vendor_id !== user.id) {
      return res.status(403).json({ error: 'No tienes permiso para editar esta venta' });
    }

    // Al entregar el paquete, la venta queda completada (se refleja en el dashboard)
    const newSaleStatus = status === 'entregado' ? 'completado' : sale.status;

    const result = await pool.query(
      `UPDATE sales
       SET delivery_status = $1,
           status = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, newSaleStatus, id]
    );

    res.json({
      message: 'Estado del paquete actualizado',
      sale: result.rows[0]
    });

  } catch (err) {
    console.error('Error al actualizar estado del paquete:', err);
    res.status(500).json({ error: 'Error al actualizar estado del paquete' });
  }
});

// ============================================
// PUT - Cambiar dirección de envío
// ============================================
router.put('/:id/address', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { address, phone } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Dirección requerida' });
    }

    const saleResult = await pool.query('SELECT * FROM sales WHERE id = $1', [id]);

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const sale = saleResult.rows[0];

    if (user.role === 'vendedor' && sale.vendor_id !== user.id) {
      return res.status(403).json({ error: 'No tienes permiso para editar esta venta' });
    }

    const result = await pool.query(
      `UPDATE sales
       SET address = $1,
           phone = COALESCE($2, phone),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [address, phone, id]
    );

    res.json({
      message: 'Dirección actualizada',
      sale: result.rows[0]
    });

  } catch (err) {
    console.error('Error al actualizar dirección:', err);
    res.status(500).json({ error: 'Error al actualizar dirección' });
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
      `UPDATE sales
       SET status = 'cancelado',
           delivery_status = CASE WHEN tipo_venta = 'ENVIO' THEN 'cancelado' ELSE delivery_status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    res.json({ message: 'Venta cancelada' });

  } catch (err) {
    console.error('Error al cancelar venta:', err);
    res.status(500).json({ error: 'Error al cancelar venta' });
  }
});

module.exports = router;
