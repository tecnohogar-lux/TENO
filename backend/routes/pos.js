// backend/routes/pos.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const PAYMENT_METHODS = ['efectivo', 'tarjeta', 'transferencia'];

// ============================================
// POST - Crear venta desde el punto de venta (tienda)
// ============================================
router.post('/sale', authenticateToken, async (req, res) => {
  const user = req.user;

  if (user.role !== 'operador' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo operadores y admins pueden usar el punto de venta' });
  }

  const { vendor_id, client_id, client, items, payment_method, notes } = req.body;

  if (!vendor_id) {
    return res.status(400).json({ error: 'Vendedor requerido' });
  }
  if (!client_id && !client?.name) {
    return res.status(400).json({ error: 'Cliente requerido (existente o nuevo)' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Debes agregar al menos un producto' });
  }
  if (!payment_method || !PAYMENT_METHODS.includes(payment_method)) {
    return res.status(400).json({ error: `Forma de pago inválida. Opciones: ${PAYMENT_METHODS.join(', ')}` });
  }
  for (const item of items) {
    if (!item.product_name || !item.quantity || !item.price) {
      return res.status(400).json({ error: 'Cada producto necesita nombre, cantidad y precio' });
    }
  }

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const vendorResult = await dbClient.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'vendedor' AND is_active = true`,
      [vendor_id]
    );
    if (vendorResult.rows.length === 0) {
      throw { status: 400, message: 'Vendedor inválido o inactivo' };
    }

    let finalClientId = client_id;
    if (!finalClientId) {
      const newClient = await dbClient.query(
        `INSERT INTO clients (name, address, phone, email, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [client.name, client.address || null, client.phone || null, client.email || null, user.id]
      );
      finalClientId = newClient.rows[0].id;
    }

    const createdSales = [];
    for (const item of items) {
      const total = item.quantity * item.price;
      const inserted = await dbClient.query(
        `INSERT INTO sales
           (vendor_id, client_id, product_name, quantity, price, total, status, delivery_status, tipo_venta, payment_method, notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'completado', NULL, 'TIENDA', $7, $8)
         RETURNING *`,
        [vendor_id, finalClientId, item.product_name, item.quantity, item.price, total, payment_method, notes || null]
      );
      createdSales.push(inserted.rows[0]);
    }

    await dbClient.query('COMMIT');

    res.status(201).json({
      message: 'Venta de tienda creada exitosamente',
      client_id: finalClientId,
      sales: createdSales
    });

  } catch (err) {
    await dbClient.query('ROLLBACK');
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Error al crear venta POS:', err);
    res.status(500).json({ error: 'Error al crear venta de tienda' });
  } finally {
    dbClient.release();
  }
});

module.exports = router;
