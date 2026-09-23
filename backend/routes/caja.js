// backend/routes/caja.js (antes pos.js)
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');

const PAYMENT_METHODS = ['efectivo', 'debito', 'credito', 'transferencia', 'link_pago'];

// Busca la comisión de venta unitaria del producto por nombre exacto (sin
// distinguir mayúsculas/minúsculas). Si no hay coincidencia en el catálogo o
// el producto no tiene costo cargado, no hay comisión.
async function lookupComisionUnitaria(dbClient, productName) {
  if (!productName) return null;
  const result = await dbClient.query(
    'SELECT comision_venta FROM products WHERE LOWER(title) = LOWER($1) LIMIT 1',
    [productName]
  );
  const valor = result.rows[0]?.comision_venta;
  return valor !== undefined && valor !== null ? parseFloat(valor) : null;
}

// ============================================
// POST - Crear venta desde Caja (tienda o envío prepagado)
// ============================================
router.post('/sale', authenticateToken, requireRole(['operador', 'admin'], 'Solo operadores y admins pueden usar Caja'), async (req, res) => {
  const user = req.user;

  const { vendor_id, client_id, client, items, payment_method, notes, transferencia_verificada, retiro_id } = req.body;
  const tipo = req.body.tipo === 'ENVIO_PREPAGADO' ? 'ENVIO_PREPAGADO' : 'TIENDA';
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
  if (!payment_method || !PAYMENT_METHODS.includes(payment_method)) {
    return res.status(400).json({ error: `Forma de pago inválida. Opciones: ${PAYMENT_METHODS.join(', ')}` });
  }
  for (const item of items) {
    if (!item.product_name || !item.quantity || !item.price) {
      return res.status(400).json({ error: 'Cada producto necesita nombre, cantidad y precio' });
    }
  }
  if (tipo === 'ENVIO_PREPAGADO') {
    if (items.length > 1) {
      return res.status(400).json({ error: 'Un envío prepagado admite un solo producto por venta' });
    }
    if (!address || !comuna) {
      return res.status(400).json({ error: 'Dirección y comuna requeridas para envío prepagado' });
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
        `SELECT id, status FROM retiros_tienda WHERE id = $1 FOR UPDATE`,
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
      const comisionUnitaria = await lookupComisionUnitaria(dbClient, item.product_name);
      const comision = comisionUnitaria !== null ? comisionUnitaria * item.quantity : null;

      const inserted = await dbClient.query(
        `INSERT INTO sales
           (vendor_id, client_id, product_name, quantity, price, total, address, comuna, phone, notes,
            status, delivery_status, tipo_venta, payment_method, transferencia_verificada, precio_producto, precio_envio, comision)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                 'pendiente', 'listo_para_imprimir', 'ENVIO_PREPAGADO', $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          vendor_id, finalClientId, item.product_name, item.quantity, item.price, total,
          address, comuna, phone || null, notes || null,
          payment_method, !!transferencia_verificada, precioProducto, precioEnvio, comision,
        ]
      );

      const withQr = await dbClient.query(
        `UPDATE sales SET qr_code = $1 WHERE id = $2 RETURNING *`,
        [`TENO-${inserted.rows[0].id}`, inserted.rows[0].id]
      );
      createdSales.push(withQr.rows[0]);
    } else {
      for (const item of items) {
        const total = item.quantity * item.price;
        const comisionUnitaria = await lookupComisionUnitaria(dbClient, item.product_name);
        const comision = comisionUnitaria !== null ? comisionUnitaria * item.quantity : null;
        const inserted = await dbClient.query(
          `INSERT INTO sales
             (vendor_id, client_id, product_name, quantity, price, total, status, delivery_status, tipo_venta,
              payment_method, transferencia_verificada, notes, precio_producto, comision)
           VALUES ($1, $2, $3, $4, $5, $6, 'completado', NULL, 'TIENDA', $7, $8, $9, $6, $10)
           RETURNING *`,
          [vendor_id, finalClientId, item.product_name, item.quantity, item.price, total, payment_method, !!transferencia_verificada, notes || null, comision]
        );
        createdSales.push(inserted.rows[0]);
      }
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
