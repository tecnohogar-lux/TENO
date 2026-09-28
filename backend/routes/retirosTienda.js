// backend/routes/retirosTienda.js
// Retiro en Tienda: propuestas de venta ingresadas por vendedores para clientes
// que dicen que pasarán a retirar. No cuentan como venta/dinero ganado hasta que
// un operador/admin las procesa en Caja al momento de la entrega (evita duplicar
// el monto: solo se registra una vez, como venta real, en /api/caja/sale).
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');

function validarPayload(client_name, items) {
  if (!client_name) return 'Nombre del cliente requerido';
  if (!Array.isArray(items) || items.length === 0) return 'Debes agregar al menos un producto';
  for (const item of items) {
    if (!item.product_id || !item.quantity || item.quantity < 1) return 'Cada producto necesita un producto válido y una cantidad';
  }
  return null;
}

// Reutiliza un cliente existente con el mismo nombre (sin distinguir mayúsculas), si existe.
async function resolverCliente(dbClient, client_name, userId) {
  const existingClient = await dbClient.query('SELECT id FROM clients WHERE name ILIKE $1 LIMIT 1', [client_name]);
  if (existingClient.rows.length > 0) return existingClient.rows[0].id;
  const newClient = await dbClient.query('INSERT INTO clients (name, created_by) VALUES ($1, $2) RETURNING id', [client_name, userId]);
  return newClient.rows[0].id;
}

// El precio se toma siempre del catálogo (no se confía en un precio enviado por el cliente).
async function resolverItems(dbClient, items, defaultPriceType) {
  const resolvedItems = [];
  let total = 0;
  for (const item of items) {
    const productResult = await dbClient.query('SELECT id, title, price, precio_tienda FROM products WHERE id = $1', [item.product_id]);
    if (productResult.rows.length === 0) {
      throw { status: 400, message: 'Uno de los productos seleccionados no existe' };
    }
    const product = productResult.rows[0];
    const quantity = Number(item.quantity);
    // Cada producto (línea) trae su propio tipo de precio; SOL usa el precio tienda y
    // MARKETPLACE el precio normal del producto.
    const priceType = ['sol', 'marketplace', 'mayor'].includes(item.price_type) ? item.price_type : defaultPriceType;
    let price;
    if (priceType === 'mayor') {
      // Venta al mayor: mínimo 6 unidades y precio libre (lo define quien registra el retiro).
      price = Number(item.price);
      if (!(quantity >= 6)) throw { status: 400, message: 'Venta al mayor: el mínimo es 6 unidades por producto' };
      if (!(price > 0)) throw { status: 400, message: 'Venta al mayor: indica el precio de cada producto' };
    } else {
      price = parseFloat(priceType === 'sol' && product.precio_tienda !== null ? product.precio_tienda : product.price);
    }
    const subtotal = price * quantity;
    total += subtotal;
    resolvedItems.push({ product_id: product.id, product_name: product.title, quantity, price, subtotal, price_type: priceType });
  }
  const tipos = new Set(resolvedItems.map((i) => i.price_type));
  const priceType = tipos.size > 1 ? 'mixto' : resolvedItems[0].price_type;
  return { resolvedItems, total, priceType };
}

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
  // En Retiro en Tienda el tipo de precio por defecto es MARKETPLACE.
  const price_type = req.body.price_type === 'sol' ? 'sol' : 'marketplace';

  const invalido = validarPayload(client_name, items);
  if (invalido) {
    return res.status(400).json({ error: invalido });
  }
  if (user.role === 'vendedor' && items.some((i) => i.price_type === 'sol')) {
    return res.status(400).json({ error: 'Los vendedores no pueden usar precios SOL' });
  }

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const clientId = await resolverCliente(dbClient, client_name, user.id);
    const { resolvedItems, total, priceType } = await resolverItems(dbClient, items, price_type);

    const inserted = await dbClient.query(
      `INSERT INTO retiros_tienda (vendor_id, client_id, items, total, notes, price_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [user.id, clientId, JSON.stringify(resolvedItems), total, notes || null, priceType]
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

// ============================================
// PUT - Editar retiro (solo operador/admin). Si ya fue entregado, la venta ya creada en Caja no cambia.
// ============================================
router.put('/:id', authenticateToken, requireRole(['admin', 'operador', 'caja'], 'No tienes permiso para editar retiros en tienda'), async (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const { client_name, items, notes } = req.body;

  const invalido = validarPayload(client_name, items);
  if (invalido) {
    return res.status(400).json({ error: invalido });
  }

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const before = await dbClient.query('SELECT * FROM retiros_tienda WHERE id = $1 FOR UPDATE', [id]);
    if (before.rows.length === 0) {
      throw { status: 404, message: 'Retiro en tienda no encontrado' };
    }

    const clientId = await resolverCliente(dbClient, client_name, user.id);
    const price_type = req.body.price_type === 'sol' ? 'sol' : 'marketplace';
    const { resolvedItems, total, priceType } = await resolverItems(dbClient, items, price_type);

    const updated = await dbClient.query(
      `UPDATE retiros_tienda
       SET client_id = $1, items = $2, total = $3, notes = $4, price_type = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [clientId, JSON.stringify(resolvedItems), total, notes || null, id, priceType]
    );

    await dbClient.query('COMMIT');

    await logAudit({ userId: user.id, action: 'editar_retiro_tienda', tableName: 'retiros_tienda', recordId: Number(id), oldValues: before.rows[0], newValues: updated.rows[0] });

    res.json({ message: 'Retiro en tienda actualizado', retiro: updated.rows[0] });

  } catch (err) {
    await dbClient.query('ROLLBACK');
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Error al editar retiro en tienda:', err);
    res.status(500).json({ error: 'Error al editar retiro en tienda' });
  } finally {
    dbClient.release();
  }
});

// ============================================
// DELETE - Eliminar retiro (solo operador/admin). Si ya fue entregado, la venta ya creada en Caja se mantiene.
// ============================================
router.delete('/:id', authenticateToken, requireRole(['admin', 'operador', 'caja'], 'No tienes permiso para eliminar retiros en tienda'), async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const existing = await pool.query('SELECT * FROM retiros_tienda WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Retiro en tienda no encontrado' });
    }

    await pool.query('DELETE FROM retiros_tienda WHERE id = $1', [id]);
    await logAudit({ userId: user.id, action: 'eliminar_retiro_tienda', tableName: 'retiros_tienda', recordId: Number(id), oldValues: existing.rows[0] });

    res.json({ message: 'Retiro en tienda eliminado' });

  } catch (err) {
    console.error('Error al eliminar retiro en tienda:', err);
    res.status(500).json({ error: 'Error al eliminar retiro en tienda' });
  }
});

module.exports = router;
