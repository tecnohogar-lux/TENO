// backend/routes/caja.js (antes pos.js)
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');
const { MIN_MAYOR, MIN_MAYOR_MESSAGE, comisionDeLineas, summarizeLines } = require('../utils/saleLines');
const { PAYMENT_METHODS, validatePaymentBreakdown, normalizePaymentBreakdown } = require('../utils/paymentBreakdown');
const { buildQrValue } = require('../utils/qrCode');
const { conCobroSql } = require('../utils/sinCobro');
const { HOY, diaChile } = require('../utils/diaChile');

// ============================================
// GET - Ventas registradas en Caja durante el día en curso (hora de Chile): ventas de tienda
// (incluye las que salen de un retiro) y envíos prepagados. Los deliveries no pasan por caja.
// ============================================
router.get('/ventas-hoy', authenticateToken, requireRole(['operador', 'admin', 'caja'], 'Solo operadores, admins o caja pueden usar Caja'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.tipo_venta, s.retiro_id, s.product_name, s.items, s.quantity, s.total, s.status,
              s.payment_method, s.payment_breakdown, s.transferencia_verificada, s.created_at,
              u.name AS vendor_name, c.name AS client_name, ru.name AS registered_by_name
       FROM sales s
       JOIN users u ON s.vendor_id = u.id
       JOIN clients c ON s.client_id = c.id
       LEFT JOIN users ru ON s.registered_by = ru.id
       WHERE s.deleted_at IS NULL AND s.tipo_venta IN ('TIENDA', 'ENVIO_PREPAGADO') AND s.status <> 'cancelado' AND ${conCobroSql('s.')}
         AND ${diaChile('s.created_at')} = ${HOY}
       ORDER BY s.created_at DESC`
    );
    res.json({ ventas: result.rows, total: result.rows.reduce((acc, v) => acc + Number(v.total), 0) });

  } catch (err) {
    console.error('Error al obtener las ventas de caja de hoy:', err);
    res.status(500).json({ error: 'Error al obtener las ventas de hoy' });
  }
});

// ============================================
// POST - Crear venta desde Caja (tienda o envío prepagado)
// ============================================
router.post('/sale', authenticateToken, requireRole(['operador', 'admin', 'caja'], 'Solo operadores, admins o caja pueden usar Caja'), async (req, res) => {
  const user = req.user;

  const { vendor_id, client_id, client, items, payment_method, payment_breakdown, notes, transferencia_verificada, retiro_id } = req.body;
  const tipo = req.body.tipo === 'ENVIO_PREPAGADO' ? 'ENVIO_PREPAGADO' : 'TIENDA';
  // En Caja el tipo de precio por defecto es SOL (precios tienda).
  const defaultPriceType = req.body.price_type === 'marketplace' ? 'marketplace' : 'sol';
  // Cada producto (línea) trae su propio tipo de precio; si no lo trae se usa el de la venta.
  const itemPriceType = (item) => (['sol', 'marketplace', 'mayor'].includes(item.price_type) ? item.price_type : defaultPriceType);
  const { address, comuna, phone } = req.body;

  if (!vendor_id) {
    return res.status(400).json({ error: 'Vendedor requerido' });
  }
  if (!client_id && !client?.name) {
    return res.status(400).json({ error: 'Cliente requerido (existente o nuevo)' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Debes agregar al menos un producto' });
  }
  if (!payment_method || (payment_method !== 'mixto' && !PAYMENT_METHODS.includes(payment_method))) {
    return res.status(400).json({ error: `Forma de pago inválida. Opciones: ${PAYMENT_METHODS.join(', ')}, mixto` });
  }
  if (payment_method === 'mixto' && !Array.isArray(payment_breakdown)) {
    return res.status(400).json({ error: 'El pago mixto necesita el detalle de montos por forma de pago' });
  }
  for (const item of items) {
    if (!item.product_name || !item.quantity || !item.price) {
      return res.status(400).json({ error: 'Cada producto necesita nombre, cantidad y precio' });
    }
    if (itemPriceType(item) === 'mayor' && Number(item.quantity) < MIN_MAYOR) {
      return res.status(400).json({ error: MIN_MAYOR_MESSAGE });
    }
  }
  if (tipo === 'ENVIO_PREPAGADO') {
    if (items.length > 1) {
      return res.status(400).json({ error: 'Un envío prepagado admite un solo producto por venta' });
    }
    if (!address || !comuna || !phone) {
      return res.status(400).json({ error: 'Dirección, comuna y teléfono requeridos para envío prepagado' });
    }
  }

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    // Caja solo puede usarse mientras haya una caja abierta desde Apertura/Cierre de Caja.
    const cajaAbierta = await dbClient.query(`SELECT id FROM cierre_caja WHERE closed_at IS NULL LIMIT 1`);
    if (cajaAbierta.rows.length === 0) {
      throw { status: 409, message: 'No hay una caja abierta. Ve a Apertura/Cierre de Caja para abrir una antes de registrar ventas.' };
    }

    const vendorResult = await dbClient.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'vendedor' AND is_active = true`,
      [vendor_id]
    );
    if (vendorResult.rows.length === 0) {
      throw { status: 400, message: 'Vendedor inválido o inactivo' };
    }

    // Si esta venta viene de un Retiro en Tienda, se bloquea la fila para evitar
    // que dos solicitudes lo procesen a la vez y se duplique la venta.
    if (retiro_id) {
      const retiroLock = await dbClient.query(
        `SELECT id, status, price_type FROM retiros_tienda WHERE id = $1 FOR UPDATE`,
        [retiro_id]
      );
      if (retiroLock.rows.length === 0) {
        throw { status: 404, message: 'Retiro en tienda no encontrado' };
      }
      if (retiroLock.rows[0].status !== 'pendiente') {
        throw { status: 409, message: 'Este retiro en tienda ya fue procesado' };
      }
    }

    let precioEnvio = null;
    if (tipo === 'ENVIO_PREPAGADO') {
      const comunaResult = await dbClient.query('SELECT precio FROM costos_envio_comuna WHERE comuna = $1', [comuna]);
      if (comunaResult.rows.length === 0) {
        throw { status: 400, message: 'No hay un costo de envío cargado para esa comuna' };
      }
      precioEnvio = parseFloat(comunaResult.rows[0].precio);
    }

    let finalClientId = client_id;
    if (!finalClientId) {
      const newClient = await dbClient.query(
        `INSERT INTO clients (name, address, phone, email, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [client.name, client.address || address || null, client.phone || phone || null, client.email || null, user.id]
      );
      finalClientId = newClient.rows[0].id;
    }

    const createdSales = [];
    if (tipo === 'ENVIO_PREPAGADO') {
      const item = items[0];
      const precioProducto = item.quantity * item.price;
      const total = precioProducto + precioEnvio;
      const comision = await comisionDeLineas(dbClient, [{ product_name: item.product_name, quantity: Number(item.quantity), price: Number(item.price), price_type: itemPriceType(item) }]);

      let breakdownJson = null;
      if (payment_method === 'mixto') {
        const error = validatePaymentBreakdown(payment_breakdown, total);
        if (error) throw { status: 400, message: error };
        breakdownJson = JSON.stringify(normalizePaymentBreakdown(payment_breakdown));
      }

      const inserted = await dbClient.query(
        `INSERT INTO sales
           (vendor_id, client_id, product_name, quantity, price, total, address, comuna, phone, notes,
            status, delivery_status, tipo_venta, payment_method, transferencia_verificada, precio_producto, precio_envio, comision, price_type, payment_breakdown, registered_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                 'pendiente', 'listo_para_imprimir', 'ENVIO_PREPAGADO', $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING *`,
        [
          vendor_id, finalClientId, item.product_name, item.quantity, item.price, total,
          address, comuna, phone || null, notes || null,
          payment_method, !!transferencia_verificada, precioProducto, precioEnvio, comision, itemPriceType(item), breakdownJson, user.id,
        ]
      );

      const withQr = await dbClient.query(
        `UPDATE sales SET qr_code = $1 WHERE id = $2 RETURNING *`,
        [buildQrValue(), inserted.rows[0].id]
      );
      createdSales.push(withQr.rows[0]);
    } else {
      // Una venta de tienda es UNA sola venta aunque tenga varios productos (con SOL y/o
      // MARKETPLACE mezclados): una fila; si hay más de un producto, las líneas van en items.
      const lines = items.map((item) => ({
        product_name: String(item.product_name).trim(),
        quantity: Number(item.quantity),
        price: Number(item.price),
        price_type: itemPriceType(item),
      }));
      const resumen = await summarizeLines(dbClient, lines);
      const total = resumen.productosTotal;

      let breakdownJson = null;
      if (payment_method === 'mixto') {
        const error = validatePaymentBreakdown(payment_breakdown, total);
        if (error) throw { status: 400, message: error };
        breakdownJson = JSON.stringify(normalizePaymentBreakdown(payment_breakdown));
      }

      const inserted = await dbClient.query(
        `INSERT INTO sales
           (vendor_id, client_id, product_name, quantity, price, total, status, delivery_status, tipo_venta,
            payment_method, transferencia_verificada, notes, precio_producto, comision, price_type, items, payment_breakdown, registered_by, retiro_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'completado', NULL, 'TIENDA', $7, $8, $9, $6, $10, $11, $12, $13, $14,
                 (SELECT id FROM retiros_tienda WHERE id = $15))
         RETURNING *`,
        [vendor_id, finalClientId, resumen.productName, resumen.totalQty, total / resumen.totalQty, total, payment_method, !!transferencia_verificada, notes || null, resumen.comision, resumen.priceType, resumen.itemsJson, breakdownJson, user.id, retiro_id ? Number(retiro_id) : null]
      );
      createdSales.push(inserted.rows[0]);
    }

    if (retiro_id) {
      const marked = await dbClient.query(
        `UPDATE retiros_tienda SET status = 'entregado', delivered_at = CURRENT_TIMESTAMP, delivered_by = $1
         WHERE id = $2 AND status = 'pendiente'
         RETURNING id`,
        [user.id, retiro_id]
      );
      if (marked.rows.length === 0) {
        // Otra solicitud lo procesó justo antes: se revierte para no duplicar la venta.
        throw { status: 409, message: 'Este retiro en tienda ya fue procesado' };
      }
    }

    await dbClient.query('COMMIT');

    for (const sale of createdSales) {
      await logAudit({ userId: user.id, action: 'crear_venta_caja', tableName: 'sales', recordId: sale.id, newValues: sale });
    }
    if (retiro_id) {
      await logAudit({ userId: user.id, action: 'procesar_retiro_tienda', tableName: 'retiros_tienda', recordId: Number(retiro_id) });
    }

    res.status(201).json({
      message: tipo === 'ENVIO_PREPAGADO' ? 'Envío prepagado creado exitosamente' : 'Venta de tienda creada exitosamente',
      client_id: finalClientId,
      sales: createdSales
    });

  } catch (err) {
    await dbClient.query('ROLLBACK');
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Error al crear venta en Caja:', err);
    res.status(500).json({ error: 'Error al crear venta' });
  } finally {
    dbClient.release();
  }
});

module.exports = router;
