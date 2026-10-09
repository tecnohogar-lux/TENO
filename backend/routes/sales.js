// backend/routes/sales.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');
const { MIN_MAYOR, MIN_MAYOR_MESSAGE, lookupComisionUnitaria, validateLines, summarizeLines } = require('../utils/saleLines');
const { buildQrValue } = require('../utils/qrCode');
const { esSinCobro, conCobroSql, aplicarTipoEnvio } = require('../utils/sinCobro');
const { PAYMENT_METHODS, validatePaymentBreakdown, normalizePaymentBreakdown, formaPagoCondition } = require('../utils/paymentBreakdown');
const { recalcularCierresQueContienen } = require('../utils/cierreCaja');

const DELIVERY_STATUSES = ['listo_para_imprimir', 'impreso', 'en_camino', 'entregado', 'cancelado', 'reprogramado'];

// Cancelar o reprogramar un envío de Santiago exige dejar el motivo (lo ve el vendedor).
// Los envíos a regiones lo aceptan pero no lo exigen. Al pasar a cualquier otro estado
// el motivo se limpia (el historial queda en la auditoría).
const MOTIVO_STATUSES = ['cancelado', 'reprogramado'];
const MOTIVO_MAX = 500;

// Devuelve { motivo } (string|null) o { error } si falta o excede el largo.
function resolveMotivo(status, rawMotivo, exigir) {
  if (!MOTIVO_STATUSES.includes(status)) return { motivo: null };
  const motivo = typeof rawMotivo === 'string' ? rawMotivo.trim() : '';
  if (!motivo && exigir) return { error: 'Indica el motivo de la cancelación o reprogramación' };
  if (motivo.length > MOTIVO_MAX) return { error: `El motivo no puede superar ${MOTIVO_MAX} caracteres` };
  return { motivo: motivo || null };
}
// Tipo de envío de Delivery Santiago: independiente del estado de entrega (no lo
// pisa ni es pisado por él). Por defecto todo envío es 'delivery'; los otros 3
// tipos solo los puede poner/cambiar operador/admin/caja.
const DELIVERY_TYPES = ['delivery', 'solo_envio_pagado', 'solo_entrega_incompleto', 'cambio_producto'];
const MANAGE_ROLES = ['admin', 'operador', 'caja'];
const requireAdmin = (message) => requireRole(['admin'], message);
const requireManage = (message) => requireRole(MANAGE_ROLES, message);

// Títulos (del catálogo) de los productos agotados entre los nombres dados. Los productos libres,
// que no están en el catálogo, no se ven afectados.
async function productosAgotados(nombres) {
  const nombresMin = [...new Set(nombres.map((n) => String(n || '').trim().toLowerCase()).filter(Boolean))];
  if (nombresMin.length === 0) return [];
  const result = await pool.query('SELECT title FROM products WHERE agotado = true AND LOWER(title) = ANY($1::text[])', [nombresMin]);
  return result.rows.map((r) => r.title);
}

// Filtros de Todas Las Etiquetas y de Delivery Santiago (listado y resumen usan los mismos).
// "retiro" = venta de tienda que salió de un retiro en tienda; "directa" = venta directa en caja.
const CANALES = {
  envio: `s.tipo_venta = 'ENVIO'`,
  retiro: `(s.tipo_venta = 'TIENDA' AND s.retiro_id IS NOT NULL)`,
  directa: `(s.tipo_venta = 'TIENDA' AND s.retiro_id IS NULL)`,
  region: `s.tipo_venta = 'ENVIO_REGION'`,
  prepagado: `s.tipo_venta = 'ENVIO_PREPAGADO'`,
};
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS_FILTRO = [...DELIVERY_STATUSES, 'pendiente', 'completado'];

// Agrega a `conditions`/`params` los filtros pedidos en la query. Los valores inválidos se ignoran.
// "operador" (quién registró la venta) solo lo puede usar el personal; un vendedor ya queda
// limitado a lo suyo (o al equipo, en Delivery Santiago) por la condición que pone la ruta.
function applyFiltros(query, user, conditions, params) {
  const { vendedor_id, operador_id, cliente, desde, hasta, forma_pago, canal, tipo_envio, courier_id, estado } = query;
  const esInt = (v) => /^\d+$/.test(String(v || ''));

  if (esInt(vendedor_id)) {
    params.push(Number(vendedor_id));
    conditions.push(`s.vendor_id = $${params.length}`);
  }
  if (esInt(operador_id) && MANAGE_ROLES.includes(user.role)) {
    params.push(Number(operador_id));
    conditions.push(`s.registered_by = $${params.length}`);
  }
  if (cliente && String(cliente).trim()) {
    params.push(`%${String(cliente).trim()}%`);
    conditions.push(`c.name ILIKE $${params.length}`);
  }
  if (FECHA_RE.test(String(desde || ''))) {
    params.push(desde);
    conditions.push(`s.created_at >= $${params.length}::date`);
  }
  if (FECHA_RE.test(String(hasta || ''))) {
    params.push(hasta);
    conditions.push(`s.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }
  if (PAYMENT_METHODS.includes(forma_pago) || forma_pago === 'mixto') {
    conditions.push(forma_pago === 'mixto' ? `s.payment_method = 'mixto'` : formaPagoCondition(params, forma_pago));
  }
  if (CANALES[canal]) conditions.push(CANALES[canal]);
  if (DELIVERY_TYPES.includes(tipo_envio)) {
    params.push(tipo_envio);
    conditions.push(`s.delivery_type = $${params.length}`);
  }
  if (esInt(courier_id)) {
    params.push(Number(courier_id));
    conditions.push(`s.courier_id = $${params.length}`);
  }
  if (ESTADOS_FILTRO.includes(estado)) {
    params.push(estado);
    conditions.push(`COALESCE(s.delivery_status, s.status) = $${params.length}`);
  }
}

// ============================================
// GET - Papelera (ventas/envíos eliminados, solo admin)
// ============================================
router.get('/trash', authenticateToken, requireAdmin('Solo un admin puede ver la papelera'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.name as vendor_name, c.name as client_name, c.email as client_email, co.name as courier_name
       FROM sales s
       JOIN users u ON s.vendor_id = u.id
       JOIN clients c ON s.client_id = c.id
       LEFT JOIN couriers co ON s.courier_id = co.id
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
      `SELECT s.*, u.name as vendor_name, c.name as client_name, c.email as client_email, co.name as courier_name
       FROM sales s
       JOIN users u ON s.vendor_id = u.id
       JOIN clients c ON s.client_id = c.id
       LEFT JOIN couriers co ON s.courier_id = co.id
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
// GET - Movimientos de Envíos a Regiones (solo admin). Estos envíos no entran a la caja
// (ni al crearse ni al entregarse): se llevan como un movimiento independiente.
// ============================================
router.get('/regiones/movimientos', authenticateToken, requireAdmin('Solo un admin puede ver los movimientos de envíos a regiones'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE delivery_status != 'cancelado') as cantidad,
         COALESCE(SUM(total) FILTER (WHERE delivery_status != 'cancelado'), 0) as monto_total,
         COUNT(*) FILTER (WHERE delivery_status = 'entregado') as cantidad_entregados,
         COALESCE(SUM(total) FILTER (WHERE delivery_status = 'entregado'), 0) as monto_entregado,
         COUNT(*) FILTER (WHERE delivery_status NOT IN ('entregado', 'cancelado')) as cantidad_pendientes,
         COALESCE(SUM(total) FILTER (WHERE delivery_status NOT IN ('entregado', 'cancelado')), 0) as monto_pendiente
       FROM sales
       WHERE tipo_venta = 'ENVIO_REGION' AND deleted_at IS NULL`
    );
    const r = result.rows[0];
    res.json({
      cantidad: parseInt(r.cantidad),
      monto_total: parseFloat(r.monto_total),
      cantidad_entregados: parseInt(r.cantidad_entregados),
      monto_entregado: parseFloat(r.monto_entregado),
      cantidad_pendientes: parseInt(r.cantidad_pendientes),
      monto_pendiente: parseFloat(r.monto_pendiente),
    });
  } catch (err) {
    console.error('Error al obtener movimientos de regiones:', err);
    res.status(500).json({ error: 'Error al obtener movimientos de envíos a regiones' });
  }
});

// ============================================
// GET - Resumen agregado de ventas (para métricas, respeta el mismo filtro que la lista)
// ============================================
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { search } = req.query;

    // Los envíos sin cobro (solo envío, solo entrega, cambio de producto) no cuentan en las métricas.
    const conditions = ['s.deleted_at IS NULL', conCobroSql('s.')];
    const params = [];

    if (user.role === 'vendedor') {
      params.push(user.id);
      conditions.push(`s.vendor_id = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(u.name ILIKE $${idx} OR c.name ILIKE $${idx} OR s.product_name ILIKE $${idx} OR s.address ILIKE $${idx} OR s.comuna ILIKE $${idx} OR co.name ILIKE $${idx})`);
    }

    applyFiltros(req.query, user, conditions, params);

    const result = await pool.query(
      `SELECT COUNT(*) as total,
              COALESCE(SUM(s.total) FILTER (WHERE s.status = 'completado'), 0) as monto,
              COUNT(*) FILTER (WHERE s.tipo_venta IN ('ENVIO', 'ENVIO_PREPAGADO', 'ENVIO_REGION')) as envios,
              COUNT(*) FILTER (WHERE s.tipo_venta = 'TIENDA') as tienda
       FROM sales s
       JOIN users u ON s.vendor_id = u.id
       JOIN clients c ON s.client_id = c.id
       LEFT JOIN couriers co ON s.courier_id = co.id
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
// GET - Comisiones a pagar por vendedor en un rango de fechas (admin/operador).
// Solo cuenta ventas ya "cerradas": tienda/retiro completado, o envío entregado,
// y transferencias sin verificar no cuentan (aún no se confirma el pago recibido).
// ============================================
router.get('/comisiones', authenticateToken, requireManage('No tienes permiso para ver las comisiones'), async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    if (!desde || !hasta) {
      return res.status(400).json({ error: 'Debes indicar fecha desde y hasta' });
    }

    const conditions = [
      's.deleted_at IS NULL',
      conCobroSql('s.'),
      `s.status = 'completado'`,
      `(s.tipo_venta = 'TIENDA' OR s.delivery_status = 'entregado')`,
      `(
         (COALESCE(s.payment_method, '') NOT IN ('transferencia', 'mixto'))
         OR (s.payment_method = 'transferencia' AND s.transferencia_verificada = true)
         OR (s.payment_method = 'mixto' AND NOT EXISTS (
              SELECT 1 FROM json_array_elements(s.payment_breakdown) leg
              WHERE leg->>'method' = 'transferencia' AND COALESCE((leg->>'transferencia_verificada')::boolean, false) = false
            ))
       )`,
      's.created_at >= $1',
      's.created_at < ($2::date + INTERVAL \'1 day\')',
    ];
    const params = [desde, hasta];

    const result = await pool.query(
      `SELECT u.id as vendor_id, u.name as vendor_name,
              COUNT(*) as cantidad_ventas,
              COALESCE(SUM(s.comision), 0) as total_comision
       FROM sales s
       JOIN users u ON s.vendor_id = u.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY u.id, u.name
       ORDER BY u.name ASC`,
      params
    );

    // Descuentos (devoluciones, errores...) registrados en el rango: se restan de la
    // comisión. Un vendedor con descuentos pero sin comisión también aparece (neto negativo).
    const descuentosResult = await pool.query(
      `SELECT d.id, d.vendor_id, u.name as vendor_name, d.motivo, d.monto, d.created_at
       FROM descuentos_vendedor d
       JOIN users u ON d.vendor_id = u.id
       WHERE d.created_at >= $1 AND d.created_at < ($2::date + INTERVAL '1 day')
       ORDER BY d.created_at DESC`,
      params
    );

    const porVendedor = new Map();
    for (const r of result.rows) {
      porVendedor.set(r.vendor_id, {
        vendor_id: r.vendor_id,
        vendor_name: r.vendor_name,
        cantidad_ventas: parseInt(r.cantidad_ventas),
        total_comision: parseFloat(r.total_comision),
        total_descuentos: 0,
        descuentos: [],
      });
    }
    for (const d of descuentosResult.rows) {
      if (!porVendedor.has(d.vendor_id)) {
        porVendedor.set(d.vendor_id, { vendor_id: d.vendor_id, vendor_name: d.vendor_name, cantidad_ventas: 0, total_comision: 0, total_descuentos: 0, descuentos: [] });
      }
      const v = porVendedor.get(d.vendor_id);
      v.total_descuentos += parseFloat(d.monto);
      v.descuentos.push({ id: d.id, motivo: d.motivo, monto: parseFloat(d.monto), created_at: d.created_at });
    }

    const vendedores = [...porVendedor.values()]
      .map((v) => ({ ...v, neto: v.total_comision - v.total_descuentos }))
      .sort((a, b) => a.vendor_name.localeCompare(b.vendor_name));

    res.json({
      desde,
      hasta,
      vendedores,
      total_general: vendedores.reduce((acc, v) => acc + v.total_comision, 0),
      total_descuentos: vendedores.reduce((acc, v) => acc + v.total_descuentos, 0),
      total_neto: vendedores.reduce((acc, v) => acc + v.neto, 0),
    });

  } catch (err) {
    console.error('Error al calcular comisiones:', err);
    res.status(500).json({ error: 'Error al calcular comisiones' });
  }
});

// ============================================
// GET - Obtener todas las ventas (según rol)
// Soporta ?search=  y, opcionalmente, ?page= &limit= (si no se pasan, devuelve todo)
// Un vendedor ve solo sus ventas, salvo con ?equipo=1 (módulo Delivery Santiago): ahí ve los
// envíos de Santiago de TODOS los vendedores (solo lectura). Las ventas hechas en Caja (tienda,
// envío prepagado), los envíos a regiones y los datos de pago de otros vendedores nunca se le muestran.
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { page, limit, search, tipo_venta, equipo } = req.query;

    const conditions = ['s.deleted_at IS NULL'];
    const params = [];

    if (user.role === 'vendedor') {
      params.push(user.id);
      if (equipo === '1') {
        conditions.push(`(s.vendor_id = $${params.length} OR s.tipo_venta = 'ENVIO')`);
      } else {
        conditions.push(`s.vendor_id = $${params.length}`);
      }
    }

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(u.name ILIKE $${idx} OR c.name ILIKE $${idx} OR s.product_name ILIKE $${idx} OR s.address ILIKE $${idx} OR s.comuna ILIKE $${idx} OR co.name ILIKE $${idx})`);
    }

    if (tipo_venta) {
      const tipos = String(tipo_venta).split(',').filter((t) => ['ENVIO', 'TIENDA', 'ENVIO_PREPAGADO', 'ENVIO_REGION'].includes(t));
      if (tipos.length > 0) {
        params.push(tipos);
        conditions.push(`s.tipo_venta = ANY($${params.length})`);
      }
    }

    applyFiltros(req.query, user, conditions, params);

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM sales s
       JOIN users u ON s.vendor_id = u.id
       JOIN clients c ON s.client_id = c.id
       LEFT JOIN couriers co ON s.courier_id = co.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    let query = `
      SELECT s.*, u.name as vendor_name, c.name as client_name, c.email as client_email, co.name as courier_name
      FROM sales s
      JOIN users u ON s.vendor_id = u.id
      JOIN clients c ON s.client_id = c.id
      LEFT JOIN couriers co ON s.courier_id = co.id
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

    // De un envío ajeno el vendedor no ve la comisión ni nada del cobro (forma de pago, transferencia).
    const sales = user.role === 'vendedor'
      ? result.rows.map((s) => (s.vendor_id === user.id
          ? s
          : { ...s, comision: null, cobro_original: null, payment_method: null, payment_breakdown: null, transferencia_verificada: null }))
      : result.rows;

    res.json({
      total,
      page: pageNum || 1,
      limit: limitNum || total,
      totalPages: limitNum ? Math.max(Math.ceil(total / limitNum), 1) : 1,
      sales
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
      `SELECT s.*, u.name as vendor_name, c.name as client_name, c.email as client_email, co.name as courier_name
       FROM sales s
       JOIN users u ON s.vendor_id = u.id
       JOIN clients c ON s.client_id = c.id
       LEFT JOIN couriers co ON s.courier_id = co.id
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
  const { client_id, client, address, comuna, phone, notes, region } = req.body;
  let { product_name, quantity, price, precio_producto, precio_envio } = req.body;
  let { vendor_id } = req.body;
  const tipo_venta = req.body.tipo_venta === 'ENVIO_REGION' ? 'ENVIO_REGION' : 'ENVIO';
  let price_type = req.body.price_type === 'sol' ? 'sol' : 'marketplace';

  // Forma nueva: items[] con el tipo de precio (sol/marketplace) de cada línea, mezclables
  // en una misma transacción. Forma antigua: un solo producto (product_name/quantity/price).
  const lines = Array.isArray(req.body.items) && req.body.items.length > 0
    ? req.body.items.map((i) => ({
        product_name: String(i.product_name || '').trim(),
        quantity: Number(i.quantity),
        price: Number(i.price),
        price_type: ['sol', 'mayor'].includes(i.price_type) ? i.price_type : 'marketplace',
      }))
    : null;
  const lineasInvalidas = lines && validateLines(lines);
  if (lineasInvalidas) {
    return res.status(400).json({ error: lineasInvalidas });
  }
  if (lines && user.role === 'vendedor' && lines.some((l) => l.price_type === 'sol')) {
    return res.status(400).json({ error: 'Los vendedores no pueden usar precios SOL' });
  }

  if (user.role === 'escaneo') {
    return res.status(403).json({ error: 'El usuario de escaneo no puede crear ventas' });
  }

  if (tipo_venta === 'ENVIO_REGION' && !region) {
    return res.status(400).json({ error: 'Región requerida para envíos a región' });
  }
  if (!address || !phone) {
    return res.status(400).json({ error: 'Dirección y teléfono requeridos para un envío' });
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
  if (!lines && (!product_name || !quantity || !price)) {
    return res.status(400).json({ error: 'Campos requeridos faltantes' });
  }

  // Un vendedor no puede registrar envíos con productos agotados (se muestran en la lista, pero no se pueden usar).
  if (user.role === 'vendedor') {
    const agotados = await productosAgotados(lines ? lines.map((l) => l.product_name) : [product_name]);
    if (agotados.length > 0) {
      const detalle = agotados.map((t) => `"${t}"`).join(', ');
      return res.status(400).json({ error: `${agotados.length === 1 ? 'Producto agotado' : 'Productos agotados'}: ${detalle}. No se puede registrar el envío.` });
    }
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

    let itemsJson = null;
    let comision = null;
    let total;
    if (lines) {
      const resumen = await summarizeLines(dbClient, lines);
      const envio = Number(precio_envio) || 0;
      total = resumen.productosTotal + envio;
      precio_producto = resumen.productosTotal;
      precio_envio = envio;
      quantity = resumen.totalQty;
      // La columna price guarda el promedio para que total = quantity * price siga cumpliéndose.
      price = total / resumen.totalQty;
      product_name = resumen.productName;
      price_type = resumen.priceType;
      itemsJson = resumen.itemsJson;
      comision = resumen.comision;
    } else {
      total = quantity * price;
      const comisionUnitaria = await lookupComisionUnitaria(dbClient, product_name, price_type);
      comision = comisionUnitaria !== null ? comisionUnitaria * quantity : null;
    }

    // Courier predeterminado (configurable en Configuración) para que todo envío
    // nuevo de Delivery Santiago nazca con un courier asignado; se puede cambiar
    // después desde la tabla de Envíos.
    const defaultCourier = await dbClient.query(
      `SELECT c.id FROM app_settings s JOIN couriers c ON c.id::text = s.value WHERE s.key = 'default_courier_id'`
    );
    const courierId = defaultCourier.rows[0]?.id || null;

    const inserted = await dbClient.query(
      `INSERT INTO sales (vendor_id, client_id, product_name, quantity, price, total, address, comuna, phone, notes, tipo_venta, region, precio_producto, precio_envio, comision, courier_id, price_type, items, registered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [vendor_id, finalClientId, product_name, quantity, price, total, address, comuna, phone, notes, tipo_venta, region || null, precio_producto || null, precio_envio || null, comision, courierId, price_type, itemsJson, user.id]
    );

    const sale = inserted.rows[0];

    const withQr = await dbClient.query(
      `UPDATE sales SET qr_code = $1 WHERE id = $2 RETURNING *`,
      [buildQrValue(), sale.id]
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
  const { ids, status, motivo: rawMotivo } = req.body;

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
    if (existing.rows.some((s) => !['ENVIO', 'ENVIO_REGION'].includes(s.tipo_venta))) {
      throw { status: 400, message: 'Solo las ventas de tipo envío tienen estado de paquete' };
    }
    if (user.role === 'vendedor' && existing.rows.some((s) => s.vendor_id !== user.id)) {
      throw { status: 403, message: 'No tienes permiso para editar alguna de estas ventas' };
    }

    const exigirMotivo = existing.rows.some((s) => s.tipo_venta !== 'ENVIO_REGION');
    const { motivo, error: motivoError } = resolveMotivo(status, rawMotivo, exigirMotivo);
    if (motivoError) throw { status: 400, message: motivoError };

    // Al entregar el paquete, la venta queda completada (se refleja en el dashboard)
    const newSaleStatus = status === 'entregado' ? 'completado' : null;
    const deliveredAt = status === 'entregado' ? new Date() : null;

    const result = await dbClient.query(
      `UPDATE sales
       SET delivery_status = $1,
           status = COALESCE($2, status),
           delivered_at = COALESCE($3, delivered_at),
           motivo_estado = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($4::int[])
       RETURNING *`,
      [status, newSaleStatus, deliveredAt, ids, motivo]
    );

    await dbClient.query('COMMIT');

    for (const before of existing.rows) {
      await logAudit({
        userId: user.id,
        action: 'cambiar_estado_paquete_lote',
        tableName: 'sales',
        recordId: before.id,
        oldValues: { delivery_status: before.delivery_status },
        newValues: { delivery_status: status, motivo_estado: motivo }
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
// PUT - Cambiar el tipo de envío (delivery/solo envío pagado/etc.) de varios a la vez.
// Independiente de delivery_status: no lo pisa ni es pisado por él. Solo operador/admin/caja.
// ============================================
router.put('/batch-delivery-type', authenticateToken, requireManage('Solo operadores pueden cambiar el tipo de envío'), async (req, res) => {
  const user = req.user;
  const { ids, delivery_type } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Debes enviar al menos un id de venta' });
  }
  if (!DELIVERY_TYPES.includes(delivery_type)) {
    return res.status(400).json({ error: `Tipo de envío inválido. Opciones: ${DELIVERY_TYPES.join(', ')}` });
  }

  try {
    const existing = await pool.query(
      `SELECT id, tipo_venta, delivery_type FROM sales WHERE id = ANY($1::int[]) AND deleted_at IS NULL`,
      [ids]
    );
    if (existing.rows.length !== ids.length) {
      return res.status(404).json({ error: 'Una o más ventas no existen' });
    }
    if (existing.rows.some((s) => s.tipo_venta !== 'ENVIO')) {
      return res.status(400).json({ error: 'Solo las ventas de tipo envío tienen tipo de envío' });
    }

    // Los tipos "sin cobro" dejan precio, total y comisión en 0 (con respaldo para restaurar).
    const updatedRows = await aplicarTipoEnvio(pool, ids, delivery_type);

    for (const before of existing.rows) {
      await logAudit({
        userId: user.id,
        action: 'cambiar_tipo_envio_lote',
        tableName: 'sales',
        recordId: before.id,
        oldValues: { delivery_type: before.delivery_type },
        newValues: { delivery_type }
      });
    }

    res.json({ message: `${updatedRows.length} envío(s) actualizado(s)`, sales: updatedRows });

  } catch (err) {
    console.error('Error al actualizar tipo de envío por lote:', err);
    res.status(500).json({ error: 'Error al actualizar tipo de envío' });
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
      client_id, address, comuna, phone,
      transferencia_verificada, payment_breakdown, motivo: rawMotivo,
    } = req.body;
    let { product_name, quantity, price } = req.body;
    let { vendor_id } = req.body;

    if (user.role === 'escaneo') {
      return res.status(403).json({ error: 'El usuario de escaneo no puede editar ventas' });
    }

    if (delivery_status !== undefined && !DELIVERY_STATUSES.includes(delivery_status)) {
      return res.status(400).json({ error: `Estado inválido. Opciones: ${DELIVERY_STATUSES.join(', ')}` });
    }

    const saleResult = await pool.query('SELECT * FROM sales WHERE id = $1 AND deleted_at IS NULL', [id]);

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const sale = saleResult.rows[0];

    // Un envío con varios productos (líneas con su propio tipo de precio) no permite
    // cambiar producto/cantidad/monto: se ignoran esos campos para no desarmar las líneas.
    // Un envío sin cobro tampoco: su precio y comisión se mantienen en 0.
    if (sale.items || esSinCobro(sale.delivery_type)) {
      product_name = undefined;
      quantity = undefined;
      price = undefined;
    }

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

    // La comisión se recalcula si cambia el producto o la cantidad (usando la
    // comisión vigente del producto en ese momento, pudiendo quedar en null si
    // el nuevo producto no tiene comisión cargada); si no cambian, se conserva.
    let comision = sale.comision;
    if (product_name !== undefined || quantity !== undefined) {
      if (sale.price_type === 'mayor' && newQuantity < MIN_MAYOR) {
        return res.status(400).json({ error: MIN_MAYOR_MESSAGE });
      }
      const unitProducto = sale.precio_producto !== null && sale.precio_producto !== undefined ? Number(sale.precio_producto) / newQuantity : newPrice;
      const comisionUnitaria = await lookupComisionUnitaria(pool, product_name || sale.product_name, sale.price_type, unitProducto);
      comision = comisionUnitaria !== null ? comisionUnitaria * newQuantity : null;
    }

    // Pago mixto: esta edición solo permite marcar/desmarcar "transferencia verificada"
    // por línea del detalle, nunca cambiar los métodos o montos ya registrados.
    let breakdownJson = null;
    if (payment_breakdown !== undefined && sale.payment_method === 'mixto' && Array.isArray(sale.payment_breakdown)) {
      const incomingByMethod = Object.fromEntries(
        (Array.isArray(payment_breakdown) ? payment_breakdown : []).map((leg) => [leg.method, leg])
      );
      const reconciled = sale.payment_breakdown.map((leg) => ({
        ...leg,
        transferencia_verificada: leg.method === 'transferencia'
          ? !!incomingByMethod[leg.method]?.transferencia_verificada
          : leg.transferencia_verificada,
      }));
      breakdownJson = JSON.stringify(reconciled);
    }

    // Motivo de cancelación/reprogramación: solo se toca si esta edición cambia el estado de entrega.
    const statusChanging = delivery_status !== undefined && delivery_status !== sale.delivery_status;
    let motivoValue = null;
    if (statusChanging) {
      const resolved = resolveMotivo(delivery_status, rawMotivo, sale.tipo_venta !== 'ENVIO_REGION');
      if (resolved.error) return res.status(400).json({ error: resolved.error });
      motivoValue = resolved.motivo;
    }

    const deliveringNow = delivery_status === 'entregado' && sale.delivery_status !== 'entregado';
    const undeliveringNow = delivery_status !== undefined && delivery_status !== 'entregado' && sale.delivery_status === 'entregado';
    const newStatus = status || (deliveringNow ? 'completado' : (undeliveringNow ? 'pendiente' : null));
    const deliveredAt = deliveringNow ? new Date() : null;
    const clearDeliveredAt = undeliveringNow && !deliveringNow;

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
           delivered_at = CASE WHEN $16 THEN NULL ELSE COALESCE($13, delivered_at) END,
           transferencia_verificada = COALESCE($14, transferencia_verificada),
           comision = $17,
           payment_breakdown = COALESCE($18, payment_breakdown),
           motivo_estado = CASE WHEN $19::boolean THEN $20 ELSE motivo_estado END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $15
       RETURNING *`,
      [
        newStatus, delivery_status, notes,
        product_name, quantity !== undefined ? newQuantity : null, price !== undefined ? newPrice : null, total,
        vendor_id, client_id, address, comuna, phone,
        deliveredAt, transferencia_verificada !== undefined ? !!transferencia_verificada : null, id,
        clearDeliveredAt, comision, breakdownJson,
        statusChanging, motivoValue,
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
    await recalcularCierresQueContienen(sale.created_at, user.id);

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
    const { status, motivo: rawMotivo } = req.body;

    if (!DELIVERY_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Estado inválido. Opciones: ${DELIVERY_STATUSES.join(', ')}` });
    }

    const saleResult = await pool.query('SELECT * FROM sales WHERE id = $1 AND deleted_at IS NULL', [id]);

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const sale = saleResult.rows[0];

    if (!['ENVIO', 'ENVIO_REGION'].includes(sale.tipo_venta)) {
      return res.status(400).json({ error: 'Solo las ventas de tipo envío tienen estado de paquete' });
    }

    if (user.role === 'vendedor' && sale.vendor_id !== user.id) {
      return res.status(403).json({ error: 'No tienes permiso para editar esta venta' });
    }

    const { motivo, error: motivoError } = resolveMotivo(status, rawMotivo, sale.tipo_venta !== 'ENVIO_REGION');
    if (motivoError) {
      return res.status(400).json({ error: motivoError });
    }

    // Al entregar el paquete, la venta queda completada (se refleja en el dashboard)
    const newSaleStatus = status === 'entregado' ? 'completado' : sale.status;
    const deliveredAt = status === 'entregado' ? new Date() : sale.delivered_at;

    const result = await pool.query(
      `UPDATE sales
       SET delivery_status = $1,
           status = $2,
           delivered_at = $3,
           motivo_estado = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, newSaleStatus, deliveredAt, id, motivo]
    );

    await logAudit({
      userId: user.id,
      action: 'cambiar_estado_paquete',
      tableName: 'sales',
      recordId: Number(id),
      oldValues: { delivery_status: sale.delivery_status, motivo_estado: sale.motivo_estado },
      newValues: { delivery_status: status, motivo_estado: motivo }
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
// PUT - Cambiar el tipo de envío (delivery/solo envío pagado/etc.) de un paquete.
// Independiente de delivery_status: no lo pisa ni es pisado por él. Solo operador/admin/caja.
// ============================================
router.put('/:id/delivery-type', authenticateToken, requireManage('Solo operadores pueden cambiar el tipo de envío'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { delivery_type } = req.body;

    if (!DELIVERY_TYPES.includes(delivery_type)) {
      return res.status(400).json({ error: `Tipo de envío inválido. Opciones: ${DELIVERY_TYPES.join(', ')}` });
    }

    const saleResult = await pool.query('SELECT * FROM sales WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    const sale = saleResult.rows[0];
    if (sale.tipo_venta !== 'ENVIO') {
      return res.status(400).json({ error: 'Solo las ventas de tipo envío tienen tipo de envío' });
    }

    const [updated] = await aplicarTipoEnvio(pool, [Number(id)], delivery_type);

    await logAudit({
      userId: user.id,
      action: 'cambiar_tipo_envio',
      tableName: 'sales',
      recordId: Number(id),
      oldValues: { delivery_type: sale.delivery_type },
      newValues: { delivery_type }
    });

    res.json({ message: 'Tipo de envío actualizado', sale: updated });

  } catch (err) {
    console.error('Error al actualizar tipo de envío:', err);
    res.status(500).json({ error: 'Error al actualizar tipo de envío' });
  }
});

// ============================================
// PUT - Asignar courier (Delivery Santiago; solo admin/operador)
// ============================================
router.put('/:id/courier', authenticateToken, requireRole(['admin', 'operador', 'caja'], 'No tienes permiso para asignar courier'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { courier_id } = req.body;

    const saleResult = await pool.query('SELECT * FROM sales WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    const sale = saleResult.rows[0];

    if (!['ENVIO', 'ENVIO_PREPAGADO'].includes(sale.tipo_venta)) {
      return res.status(400).json({ error: 'Solo los envíos de Delivery Santiago pueden tener courier asignado' });
    }

    let courierId = null;
    if (courier_id !== null && courier_id !== undefined && courier_id !== '') {
      const courierCheck = await pool.query('SELECT id FROM couriers WHERE id = $1', [courier_id]);
      if (courierCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Courier inválido' });
      }
      courierId = courierCheck.rows[0].id;
    }

    const result = await pool.query(
      `UPDATE sales SET courier_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [courierId, id]
    );

    await logAudit({
      userId: user.id,
      action: 'asignar_courier',
      tableName: 'sales',
      recordId: Number(id),
      oldValues: { courier_id: sale.courier_id },
      newValues: { courier_id: courierId }
    });

    res.json({ message: 'Courier actualizado', sale: result.rows[0] });

  } catch (err) {
    console.error('Error al asignar courier:', err);
    res.status(500).json({ error: 'Error al asignar courier' });
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
// PUT - Corregir la forma de pago de una venta (solo admin). Sirve para arreglar un error de
// caja de cualquier día: si la venta pertenece a un cierre ya cerrado, ese cierre se recalcula.
// ============================================
router.put('/:id/payment', authenticateToken, requireAdmin('Solo un admin puede corregir la forma de pago'), async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { payment_method, payment_breakdown, transferencia_verificada } = req.body;

    if (!PAYMENT_METHODS.includes(payment_method) && payment_method !== 'mixto') {
      return res.status(400).json({ error: `Forma de pago inválida. Opciones: ${[...PAYMENT_METHODS, 'mixto'].join(', ')}` });
    }

    const saleResult = await pool.query('SELECT * FROM sales WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    const sale = saleResult.rows[0];
    if (esSinCobro(sale.delivery_type)) {
      return res.status(400).json({ error: 'Un envío sin cobro no tiene forma de pago' });
    }

    let breakdownJson = null;
    let verificada = false;
    if (payment_method === 'mixto') {
      const error = validatePaymentBreakdown(payment_breakdown, sale.total);
      if (error) return res.status(400).json({ error });
      const normalizado = normalizePaymentBreakdown(payment_breakdown);
      breakdownJson = JSON.stringify(normalizado);
      verificada = normalizado.every((l) => l.method !== 'transferencia' || l.transferencia_verificada);
    } else if (payment_method === 'transferencia') {
      verificada = !!transferencia_verificada;
    }

    const result = await pool.query(
      `UPDATE sales SET payment_method = $1, payment_breakdown = $2, transferencia_verificada = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [payment_method, breakdownJson, verificada, id]
    );

    await logAudit({
      userId: user.id, action: 'corregir_forma_pago', tableName: 'sales', recordId: Number(id),
      oldValues: { payment_method: sale.payment_method, payment_breakdown: sale.payment_breakdown, transferencia_verificada: sale.transferencia_verificada },
      newValues: { payment_method: result.rows[0].payment_method, payment_breakdown: result.rows[0].payment_breakdown, transferencia_verificada: result.rows[0].transferencia_verificada },
    });
    await recalcularCierresQueContienen(sale.created_at, user.id);

    res.json({ message: 'Forma de pago corregida', sale: result.rows[0] });

  } catch (err) {
    console.error('Error al corregir forma de pago:', err);
    res.status(500).json({ error: 'Error al corregir forma de pago' });
  }
});

// ============================================
// PUT - Restaurar venta desde la papelera (solo admin)
// ============================================
router.put('/:id/restore', authenticateToken, requireAdmin('Solo un admin puede restaurar ventas'), async (req, res) => {
  try {

    const { id } = req.params;
    const result = await pool.query(
      `UPDATE sales SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró en la papelera' });
    }

    await logAudit({ userId: req.user.id, action: 'restaurar_venta', tableName: 'sales', recordId: Number(id) });
    await recalcularCierresQueContienen(result.rows[0].created_at, req.user.id);

    res.json({ message: 'Venta restaurada', sale: result.rows[0] });

  } catch (err) {
    console.error('Error al restaurar venta:', err);
    res.status(500).json({ error: 'Error al restaurar venta' });
  }
});

// ============================================
// DELETE - Enviar a la papelera (solo admin)
// ============================================
router.delete('/:id', authenticateToken, requireAdmin('Solo un admin puede eliminar ventas o envíos'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const result = await pool.query(
      `UPDATE sales SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING id, created_at`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    await logAudit({ userId: user.id, action: 'eliminar_venta', tableName: 'sales', recordId: Number(id) });
    // Si la venta era de un día ya cerrado, su cierre se recalcula sin ella.
    await recalcularCierresQueContienen(result.rows[0].created_at, user.id);

    res.json({ message: 'Venta enviada a la papelera' });

  } catch (err) {
    console.error('Error al eliminar venta:', err);
    res.status(500).json({ error: 'Error al eliminar venta' });
  }
});

// ============================================
// DELETE - Eliminar definitivamente desde la papelera (solo admin)
// ============================================
router.delete('/:id/permanent', authenticateToken, requireAdmin('Solo un admin puede eliminar definitivamente'), async (req, res) => {
  try {
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
