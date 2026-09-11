// backend/routes/retirosTienda.js
// Retiro en Tienda: propuestas de venta ingresadas por vendedores para clientes
// que dicen que pasarán a retirar. No cuentan como venta/dinero ganado hasta que
// un operador/admin las procesa en Caja al momento de la entrega (evita duplicar
// el monto: solo se registra una vez, como venta real, en /api/caja/sale).
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');

// ============================================
// GET - Listar retiros en tienda (vendedor: solo los suyos; operador/admin: todos)
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (user.role === 'escaneo') {
      return res.status(403).json({ error: 'No tienes acceso a Retiro en Tienda' });
    }

    const { page, limit, search } = req.query;
    const conditions = [];
    const params = [];

    if (user.role === 'vendedor') {
      params.push(user.id);
      conditions.push(`r.vendor_id = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(u.name ILIKE $${idx} OR c.name ILIKE $${idx} OR r.items::text ILIKE $${idx})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM retiros_tienda r
       JOIN users u ON r.vendor_id = u.id
       JOIN clients c ON r.client_id = c.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    let query = `
      SELECT r.*, u.name as vendor_name, c.name as client_name, d.name as delivered_by_name
      FROM retiros_tienda r
      JOIN users u ON r.vendor_id = u.id
      JOIN clients c ON r.client_id = c.id
      LEFT JOIN users d ON r.delivered_by = d.id
      ${whereClause}
      ORDER BY r.created_at DESC
    `;

    let pageNum = null;
    let limitNum = null;
    if (page || limit) {
      limitNum = Math.min(parseInt(limit) || 25, 200);
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
      retiros: result.rows
    });

  } catch (err) {
    console.error('Error al obtener retiros en tienda:', err);
    res.status(500).json({ error: 'Error al obtener retiros en tienda' });
  }
});

// ============================================
// POST - Registrar retiro en tienda (vendedor/operador/admin; el vendedor siempre
// es quien está logueado, sin importar el rol)
// ============================================
router.post('/', authenticateToken, async (req, res) => {
  const user = req.user;

  if (user.role === 'escaneo') {
    return res.status(403).json({ error: 'No tienes acceso a Retiro en Tienda' });
  }

  const { client_name, items, notes } = req.body;

  if (!client_name) {
    return res.status(400).json({ error: 'Nombre del cliente requerido' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Debes agregar al menos un producto' });
  }
  for (const item of items) {
    if (!item.product_id || !item.quantity || item.quantity < 1) {
      return res.status(400).json({ error: 'Cada producto necesita un producto válido y una cantidad' });
    }
  }

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    // Reutiliza un cliente existente con el mismo nombre (sin distinguir mayúsculas), si existe.
    const existingClient = await dbClient.query('SELECT id FROM clients WHERE name ILIKE $1 LIMIT 1', [client_name]);
    let clientId;
    if (existingClient.rows.length > 0) {
      clientId = existingClient.rows[0].id;
    } else {
      const newClient = await dbClient.query(
        `INSERT INTO clients (name, created_by) VALUES ($1, $2) RETURNING id`,
        [client_name, user.id]
      );
      clientId = newClient.rows[0].id;
    }

    // El precio se toma siempre del catálogo (no se confía en un precio enviado por el cliente).
    const resolvedItems = [];
    let total = 0;
    for (const item of items) {
      const productResult = await dbClient.query('SELECT id, title, price FROM products WHERE id = $1', [item.product_id]);
      if (productResult.rows.length === 0) {
        throw { status: 400, message: 'Uno de los productos seleccionados no existe' };
      }
      const product = productResult.rows[0];
      const quantity = Number(item.quantity);
      const price = parseFloat(product.price);
      const subtotal = price * quantity;
      total += subtotal;
      resolvedItems.push({ product_id: product.id, product_name: product.title, quantity, price, subtotal });
    }

    const inserted = await dbClient.query(
      `INSERT INTO retiros_tienda (vendor_id, client_id, items, total, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [user.id, clientId, JSON.stringify(resolvedItems), total, notes || null]
    );

    await dbClient.query('COMMIT');

    const retiro = inserted.rows[0];
    await logAudit({ userId: user.id, action: 'crear_retiro_tienda', tableName: 'retiros_tienda', recordId: retiro.id, newValues: retiro });

    res.status(201).json({ message: 'Retiro en tienda registrado', retiro });

  } catch (err) {
    await dbClient.query('ROLLBACK');
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Error al crear retiro en tienda:', err);
    res.status(500).json({ error: 'Error al crear retiro en tienda' });
  } finally {
    dbClient.release();
  }
});

module.exports = router;
