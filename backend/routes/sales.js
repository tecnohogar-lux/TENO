// backend/routes/sales.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');

const DELIVERY_STATUSES = [
  'listo_para_imprimir', 'impreso', 'en_camino', 'entregado', 'cancelado', 'reprogramado',
  'solo_envio_pagado', 'solo_entrega_incompleto', 'cambio_producto',
];

// ============================================
// GET - Papelera (ventas/envíos eliminados, solo admin)
// ============================================
router.get('/trash', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo un admin puede ver la papelera' });
    }

    const result = await pool.query(
      `SELECT s.*, u.name as vendor_name, c.name as client_name
       FROM sales s
       JOIN users u ON s.vendor_id = u.id
       JOIN clients c ON s.client_id = c.id
       WHERE s.deleted_at IS NOT NULL
       ORDER BY s.deleted_at DESC`
    );

    res.json({ total: result.rows.length, sales: result.rows });

  } catch (err) {
    console.error('Error al obtener la papelera:', err);
    res.status(500).json({ error: 'Error al obtener la papelera' });
  }
});

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
       WHERE s.tipo_venta = 'ENVIO' AND s.delivery_status NOT IN ('entregado', 'cancelado') AND s.deleted_at IS NULL
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
// GET - Resumen agregado de ventas (para métricas, respeta el mismo filtro que la lista)
// ============================================
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { search } = req.query;

    const conditions = ['s.deleted_at IS NULL'];
    const params = [];

    if (user.role === 'vendedor') {
      params.push(user.id);
      conditions.push(`s.vendor_id = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(u.name ILIKE $${idx} OR c.name ILIKE $${idx} OR s.product_name ILIKE $${idx})`);
    }

    const result = await pool.query(
      `SELECT COUNT(*) as total,
              COALESCE(SUM(s.total) FILTER (WHERE s.status = 'completado'), 0) as monto,
              COUNT(*) FILTER (WHERE s.tipo_venta IN ('ENVIO', 'ENVIO_PREPAGADO', 'ENVIO_REGION')) as envios,
              COUNT(*) FILTER (WHERE s.tipo_venta = 'TIENDA') as tienda
       FROM sales s
       JOIN users u ON s.vendor_id = u.id
       JOIN clients c ON s.client_id = c.id
       WHERE ${conditions.join(' AND ')}`,
      params
    );

    const row = result.rows[0];
    res.json({
      total: parseInt(row.total),
      monto: parseFloat(row.monto),
      envios: parseInt(row.envios),
      tienda: parseInt(row.tienda),
    });

  } catch (err) {
    console.error('Error al obtener resumen de ventas:', err);
    res.status(500).json({ error: 'Error al obtener resumen de ventas' });
  }
});

// ============================================
// GET - Obtener todas las ventas (según rol)
// Soporta ?search=  y, opcionalmente, ?page= &limit= (si no se pasan, devuelve todo)
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { page, limit, search } = req.query;

    const conditions = ['s.deleted_at IS NULL'];
    const params = [];

    if (user.role === 'vendedor') {
      params.push(user.id);
      conditions.push(`s.vendor_id = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(u.name ILIKE $${idx} OR c.name ILIKE $${idx} OR s.product_name ILIKE $${idx})`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM sales s
       JOIN users u ON s.vendor_id = u.id
       JOIN clients c ON s.client_id = c.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    let query = `
      SELECT s.*, u.name as vendor_name, c.name as client_name
      FROM sales s
      JOIN users u ON s.vendor_id = u.id
      JOIN clients c ON s.client_id = c.id
      ${whereClause}
      ORDER BY s.created_at DESC
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
       WHERE s.id = $1 AND s.deleted_at IS NULL`,
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
// POST - Crear nueva venta (envío / etiqueta)
// ============================================
router.post('/', authenticateToken, async (req, res) => {
  const user = req.user;
  const { client_id, client, product_name, quantity, price, address, comuna, phone, notes, region, precio_producto, precio_envio } = req.body;
  let { vendor_id } = req.body;
  const tipo_venta = req.body.tipo_venta === 'ENVIO_REGION' ? 'ENVIO_REGION' : 'ENVIO';

  if (user.role === 'escaneo') {
    return res.status(403).json({ error: 'El usuario de escaneo no puede crear ventas' });
  }

  if (tipo_venta === 'ENVIO_REGION' && !region) {
    return res.status(400).json({ error: 'Región requerida para envíos a región' });
  }

  // Vendedor solo puede crear a su propio nombre; operador/admin puede asignar a cualquier vendedor
  if (user.role === 'vendedor') {
    vendor_id = user.id;
  } else if (!vendor_id) {
    return res.status(400).json({ error: 'Vendedor requerido' });
  }

  if (!client_id && !client?.name) {
    return res.status(400).json({ error: 'Cliente requerido (existente o nuevo)' });
  }
  if (!product_name || !quantity || !price) {
    return res.status(400).json({ error: 'Campos requeridos faltantes' });
  }

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    if (user.role !== 'vendedor') {
      const vendorResult = await dbClient.query(
        `SELECT id FROM users WHERE id = $1 AND role = 'vendedor' AND is_active = true`,
        [vendor_id]
      );
      if (vendorResult.rows.length === 0) {
        throw { status: 400, message: 'Vendedor inválido o inactivo' };
      }
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

    const total = quantity * price;

    const inserted = await dbClient.query(
      `INSERT INTO sales (vendor_id, client_id, product_name, quantity, price, total, address, comuna, phone, notes, tipo_venta, region, precio_producto, precio_envio)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [vendor_id, finalClientId, product_name, quantity, price, total, address, comuna, phone, notes, tipo_venta, region || null, precio_producto || null, precio_envio || null]
    );

    const sale = inserted.rows[0];

    const withQr = await dbClient.query(
      `UPDATE sales SET qr_code = $1 WHERE id = $2 RETURNING *`,
      [`TENO-${sale.id}`, sale.id]
    );

    await dbClient.query('COMMIT');

    await logAudit({ userId: user.id, action: 'crear_venta', tableName: 'sales', recordId: sale.id, newValues: withQr.rows[0] });

    res.status(201).json({
      message: 'Venta creada exitosamente',
      sale: withQr.rows[0]
    });

  } catch (err) {
    await dbClient.query('ROLLBACK');
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Error al crear venta:', err);
    res.status(500).json({ error: 'Error al crear venta' });
  } finally {
    dbClient.release();
  }
});

// ============================================
// PUT - Cambiar estado de varios paquetes a la vez (escaneo por lotes)
// ============================================
router.put('/batch-status', authenticateToken, async (req, res) => {
  const user = req.user;
  const { ids, status } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Debes enviar al menos un id de venta' });
  }
  if (!DELIVERY_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Estado inválido. Opciones: ${DELIVERY_STATUSES.join(', ')}` });
  }

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const existing = await dbClient.query(
      `SELECT id, vendor_id, tipo_venta, delivery_status FROM sales WHERE id = ANY($1::int[]) AND deleted_at IS NULL`,
      [ids]
    );

    if (existing.rows.length !== ids.length) {
      throw { status: 404, message: 'Una o más ventas no existen' };
    }
    if (existing.rows.some((s) => s.tipo_venta !== 'ENVIO')) {
      throw { status: 400, message: 'Solo las ventas de tipo envío tienen estado de paquete' };
    }
    if (user.role === 'vendedor' && existing.rows.some((s) => s.vendor_id !== user.id)) {
      throw { status: 403, message: 'No tienes permiso para editar alguna de estas ventas' };
    }

    // Al entregar el paquete, la venta queda completada (se refleja en el dashboard)
    const newSaleStatus = status === 'entregado' ? 'completado' : null;
    const deliveredAt = status === 'entregado' ? new Date() : null;

    const result = await dbClient.query(
      `UPDATE sales
       SET delivery_status = $1,
           status = COALESCE($2, status),
           delivered_at = COALESCE($3, delivered_at),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($4::int[])
       RETURNING *`,
      [status, newSaleStatus, deliveredAt, ids]
    );

    await dbClient.query('COMMIT');

    for (const before of existing.rows) {
      await logAudit({
        userId: user.id,
        action: 'cambiar_estado_paquete_lote',
        tableName: 'sales',
        recordId: before.id,
        oldValues: { delivery_status: before.delivery_status },
        newValues: { delivery_status: status }
      });
    }

    res.json({
      message: `${result.rows.length} paquete(s) actualizado(s)`,
      sales: result.rows
    });

  } catch (err) {
    await dbClient.query('ROLLBACK');
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Error al actualizar paquetes por lote:', err);
    res.status(500).json({ error: 'Error al actualizar paquetes' });
  } finally {
    dbClient.release();
  }
});

// ============================================
// PUT - Actualizar venta (edición completa; operador/admin pueden reasignar vendedor)
// ============================================
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const {
      status, delivery_status, notes,
      product_name, quantity, price,
      client_id, address, comuna, phone,
      transferencia_verificada,
    } = req.body;
    let { vendor_id } = req.body;

    if (user.role === 'escaneo') {
      return res.status(403).json({ error: 'El usuario de escaneo no puede editar ventas' });
    }

    const saleResult = await pool.query('SELECT * FROM sales WHERE id = $1 AND deleted_at IS NULL', [id]);

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const sale = saleResult.rows[0];

    // Validar permisos (vendedor solo su venta, operador y admin todas)
    if (user.role === 'vendedor' && sale.vendor_id !== user.id) {
      return res.status(403).json({ error: 'No tienes permiso para editar esta venta' });
    }

    // Solo operador/admin puede reasignar el vendedor de la venta
    if (vendor_id && user.role !== 'vendedor') {
      const vendorCheck = await pool.query(
        `SELECT id FROM users WHERE id = $1 AND role = 'vendedor' AND is_active = true`,
        [vendor_id]
      );
      if (vendorCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Vendedor inválido o inactivo' });
      }
    } else {
      vendor_id = null; // sin cambios
    }

    const newQuantity = quantity !== undefined && quantity !== '' ? Number(quantity) : sale.quantity;
    const newPrice = price !== undefined && price !== '' ? Number(price) : sale.price;
    const recalcTotal = quantity !== undefined || price !== undefined;
    const total = recalcTotal ? newQuantity * newPrice : null;

    const deliveringNow = delivery_status === 'entregado' && sale.delivery_status !== 'entregado';
    const newStatus = status || (deliveringNow ? 'completado' : null);
    const deliveredAt = deliveringNow ? new Date() : null;

    const result = await pool.query(
      `UPDATE sales
       SET status = COALESCE($1, status),
           delivery_status = COALESCE($2, delivery_status),
           notes = COALESCE($3, notes),
           product_name = COALESCE($4, product_name),
           quantity = COALESCE($5, quantity),
           price = COALESCE($6, price),
           total = COALESCE($7, total),
           vendor_id = COALESCE($8, vendor_id),
           client_id = COALESCE($9, client_id),
           address = COALESCE($10, address),
           comuna = COALESCE($11, comuna),
           phone = COALESCE($12, phone),
           delivered_at = COALESCE($13, delivered_at),
           transferencia_verificada = COALESCE($14, transferencia_verificada),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $15
       RETURNING *`,
      [
        newStatus, delivery_status, notes,
        product_name, quantity !== undefined ? newQuantity : null, price !== undefined ? newPrice : null, total,
        vendor_id, client_id, address, comuna, phone,
        deliveredAt, transferencia_verificada !== undefined ? !!transferencia_verificada : null, id,
      ]
    );

    await logAudit({
      userId: user.id,
      action: vendor_id ? 'reasignar_vendedor' : 'editar_venta',
      tableName: 'sales',
      recordId: Number(id),
      oldValues: sale,
      newValues: result.rows[0]
    });

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

    const saleResult = await pool.query('SELECT * FROM sales WHERE id = $1 AND deleted_at IS NULL', [id]);

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
    const deliveredAt = status === 'entregado' ? new Date() : sale.delivered_at;

    const result = await pool.query(
      `UPDATE sales
       SET delivery_status = $1,
           status = $2,
           delivered_at = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, newSaleStatus, deliveredAt, id]
    );

    await logAudit({
      userId: user.id,
      action: 'cambiar_estado_paquete',
      tableName: 'sales',
      recordId: Number(id),
      oldValues: { delivery_status: sale.delivery_status },
      newValues: { delivery_status: status }
    });

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
    const { address, comuna, phone } = req.body;

    if (user.role === 'escaneo') {
      return res.status(403).json({ error: 'El usuario de escaneo no puede editar ventas' });
    }

    if (!address) {
      return res.status(400).json({ error: 'Dirección requerida' });
    }

    const saleResult = await pool.query('SELECT * FROM sales WHERE id = $1 AND deleted_at IS NULL', [id]);

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
           comuna = COALESCE($2, comuna),
           phone = COALESCE($3, phone),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [address, comuna, phone, id]
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
// PUT - Restaurar venta desde la papelera (solo admin)
// ============================================
router.put('/:id/restore', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo un admin puede restaurar ventas' });
    }

    const { id } = req.params;
    const result = await pool.query(
      `UPDATE sales SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró en la papelera' });
    }

    await logAudit({ userId: req.user.id, action: 'restaurar_venta', tableName: 'sales', recordId: Number(id) });

    res.json({ message: 'Venta restaurada', sale: result.rows[0] });

  } catch (err) {
    console.error('Error al restaurar venta:', err);
    res.status(500).json({ error: 'Error al restaurar venta' });
  }
});

// ============================================
// DELETE - Enviar a la papelera (solo admin)
// ============================================
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo un admin puede eliminar ventas o envíos' });
    }

    const result = await pool.query(
      `UPDATE sales SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    await logAudit({ userId: user.id, action: 'eliminar_venta', tableName: 'sales', recordId: Number(id) });

    res.json({ message: 'Venta enviada a la papelera' });

  } catch (err) {
    console.error('Error al eliminar venta:', err);
    res.status(500).json({ error: 'Error al eliminar venta' });
  }
});

// ============================================
// DELETE - Eliminar definitivamente desde la papelera (solo admin)
// ============================================
router.delete('/:id/permanent', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo un admin puede eliminar definitivamente' });
    }

    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM sales WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró en la papelera' });
    }

    res.json({ message: 'Venta eliminada definitivamente' });

  } catch (err) {
    console.error('Error al eliminar definitivamente:', err);
    res.status(500).json({ error: 'Error al eliminar definitivamente' });
  }
});

module.exports = router;
