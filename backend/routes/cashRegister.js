// backend/routes/cashRegister.js
// Cierre de Caja: una sola caja global por día. Admin/Operador abren y cierran.
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');

const requireAdminOperador = requireRole(['admin', 'operador'], 'No tienes permiso para acceder a Cierre de Caja');
const FORMAS_PAGO = ['efectivo', 'debito', 'credito', 'transferencia', 'link_pago'];

// Cuánto dinero debería existir por cada forma de pago en el período (para
// cuadrar caja: solo el efectivo se cuenta físicamente, el resto se verifica
// contra el extracto bancario/POS correspondiente).
async function obtenerTotalesPorFormaPago(desde, hasta) {
  const result = await pool.query(
    `SELECT payment_method, COALESCE(SUM(total), 0) as total
     FROM sales
     WHERE deleted_at IS NULL AND status = 'completado' AND created_at >= $1 AND created_at <= $2
       AND payment_method IS NOT NULL
     GROUP BY payment_method`,
    [desde, hasta]
  );

  const porFormaPago = Object.fromEntries(FORMAS_PAGO.map((m) => [m, 0]));
  for (const row of result.rows) {
    if (row.payment_method in porFormaPago) porFormaPago[row.payment_method] = parseFloat(row.total);
  }
  return porFormaPago;
}

// Calcula los totales del período [desde, hasta] para una caja (abierta o ya cerrada).
async function calcularTotales(desde, hasta, saldoInicial) {
  const ventas = await pool.query(
    `SELECT COALESCE(SUM(total) FILTER (WHERE status = 'completado'), 0) as total_vendido,
            COALESCE(SUM(total) FILTER (WHERE status = 'completado' AND payment_method = 'efectivo'), 0) as efectivo_ventas
     FROM sales
     WHERE deleted_at IS NULL AND created_at >= $1 AND created_at <= $2`,
    [desde, hasta]
  );

  const gastosResult = await pool.query(
    `SELECT COALESCE(SUM(monto), 0) as total_gastos FROM gastos WHERE created_at >= $1 AND created_at <= $2`,
    [desde, hasta]
  );

  const total_vendido = parseFloat(ventas.rows[0].total_vendido);
  const efectivo_ventas = parseFloat(ventas.rows[0].efectivo_ventas);
  const total_gastos = parseFloat(gastosResult.rows[0].total_gastos);
  const saldo_real = parseFloat(saldoInicial) + efectivo_ventas - total_gastos;

  return { total_vendido, efectivo_ventas, total_gastos, saldo_real };
}

// Ventas del período separadas por canal (Tienda / Envío RM / Envíos a Región), con filtros opcionales.
async function obtenerVentasPeriodo(desde, hasta, filtros = {}) {
  const conditions = ['s.deleted_at IS NULL', 's.created_at >= $1', 's.created_at <= $2'];
  const params = [desde, hasta];

  if (filtros.order_id) {
    params.push(Number(filtros.order_id));
    conditions.push(`s.id = $${params.length}`);
  }
  if (filtros.cliente) {
    params.push(`%${filtros.cliente}%`);
    conditions.push(`c.name ILIKE $${params.length}`);
  }
  if (filtros.vendedor) {
    params.push(`%${filtros.vendedor}%`);
    conditions.push(`u.name ILIKE $${params.length}`);
  }
  if (filtros.fecha) {
    params.push(filtros.fecha);
    conditions.push(`DATE(s.created_at) = $${params.length}`);
  }
  if (filtros.producto) {
    params.push(`%${filtros.producto}%`);
    conditions.push(`s.product_name ILIKE $${params.length}`);
  }
  if (filtros.estado) {
    params.push(filtros.estado);
    conditions.push(`COALESCE(s.delivery_status, s.status) = $${params.length}`);
  }
  if (filtros.forma_pago) {
    params.push(filtros.forma_pago);
    conditions.push(`s.payment_method = $${params.length}`);
  }

  const result = await pool.query(
    `SELECT s.*, u.name as vendor_name, c.name as client_name,
            CASE
              WHEN s.tipo_venta = 'TIENDA' THEN 'tienda'
              WHEN s.tipo_venta = 'ENVIO_REGION' THEN 'envio_region'
              ELSE 'envio_rm'
            END as canal
     FROM sales s
     JOIN users u ON s.vendor_id = u.id
     JOIN clients c ON s.client_id = c.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY s.created_at DESC`,
    params
  );

  const porCanal = { tienda: { cantidad: 0, total: 0 }, envio_rm: { cantidad: 0, total: 0 }, envio_region: { cantidad: 0, total: 0 } };
  for (const s of result.rows) {
    porCanal[s.canal].cantidad += 1;
    if (s.status === 'completado') porCanal[s.canal].total += parseFloat(s.total);
  }

  return { ventas: result.rows, por_canal: porCanal };
}

// ============================================
// GET - Caja actualmente abierta (o null), con totales calculados en vivo
// ============================================
router.get('/current', authenticateToken, requireAdminOperador, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cc.*, ou.name as opened_by_name
       FROM cierre_caja cc
       LEFT JOIN users ou ON cc.opened_by = ou.id
       WHERE cc.closed_at IS NULL
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.json({ caja: null });
    }

    const caja = result.rows[0];
    const totales = await calcularTotales(caja.opened_at, new Date(), caja.saldo_inicial);
    const por_forma_pago = await obtenerTotalesPorFormaPago(caja.opened_at, new Date());

    res.json({ caja: { ...caja, ...totales }, por_forma_pago });

  } catch (err) {
    console.error('Error al obtener caja actual:', err);
    res.status(500).json({ error: 'Error al obtener caja actual' });
  }
});

// ============================================
// POST - Abrir caja
// ============================================
router.post('/open', authenticateToken, requireAdminOperador, async (req, res) => {
  try {
    const user = req.user;
    const { saldo_inicial } = req.body;

    const result = await pool.query(
      `INSERT INTO cierre_caja (opened_by, saldo_inicial) VALUES ($1, $2) RETURNING *`,
      [user.id, saldo_inicial || 0]
    );

    await logAudit({ userId: user.id, action: 'abrir_caja', tableName: 'cierre_caja', recordId: result.rows[0].id, newValues: result.rows[0] });

    res.status(201).json({ message: 'Caja abierta', caja: result.rows[0] });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ya hay una caja abierta' });
    }
    console.error('Error al abrir caja:', err);
    res.status(500).json({ error: 'Error al abrir caja' });
  }
});

// ============================================
// POST - Cerrar caja
// ============================================
router.post('/:id/close', authenticateToken, requireAdminOperador, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { efectivo_contado, notas } = req.body;

    if (efectivo_contado === undefined || efectivo_contado === null || efectivo_contado === '') {
      return res.status(400).json({ error: 'Efectivo contado requerido' });
    }

    const cajaResult = await pool.query('SELECT * FROM cierre_caja WHERE id = $1 AND closed_at IS NULL', [id]);
    if (cajaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Caja no encontrada o ya cerrada' });
    }
    const caja = cajaResult.rows[0];

    const cerradoEn = new Date();
    const { total_vendido, total_gastos, saldo_real } = await calcularTotales(caja.opened_at, cerradoEn, caja.saldo_inicial);
    const diferencia = parseFloat(efectivo_contado) - saldo_real;

    const result = await pool.query(
      `UPDATE cierre_caja
       SET closed_at = $1, closed_by = $2, total_vendido = $3, total_gastos = $4,
           saldo_real = $5, efectivo_contado = $6, diferencia = $7, notas = $8
       WHERE id = $9 AND closed_at IS NULL
       RETURNING *`,
      [cerradoEn, user.id, total_vendido, total_gastos, saldo_real, efectivo_contado, diferencia, notas || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'La caja ya fue cerrada por otra solicitud' });
    }

    await logAudit({ userId: user.id, action: 'cerrar_caja', tableName: 'cierre_caja', recordId: Number(id), oldValues: caja, newValues: result.rows[0] });

    const por_forma_pago = await obtenerTotalesPorFormaPago(caja.opened_at, cerradoEn);

    res.json({ message: 'Caja cerrada', caja: result.rows[0], por_forma_pago });

  } catch (err) {
    console.error('Error al cerrar caja:', err);
    res.status(500).json({ error: 'Error al cerrar caja' });
  }
});

// ============================================
// GET - Historial de cierres (paginado)
// ============================================
router.get('/history', authenticateToken, requireAdminOperador, async (req, res) => {
  try {
    const { page, limit } = req.query;

    const countResult = await pool.query('SELECT COUNT(*) as count FROM cierre_caja WHERE closed_at IS NOT NULL');
    const total = parseInt(countResult.rows[0].count);

    let query = `
      SELECT cc.*, ou.name as opened_by_name, cu.name as closed_by_name
      FROM cierre_caja cc
      LEFT JOIN users ou ON cc.opened_by = ou.id
      LEFT JOIN users cu ON cc.closed_by = cu.id
      WHERE cc.closed_at IS NOT NULL
      ORDER BY cc.closed_at DESC
    `;
    const params = [];

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
      cierres: result.rows
    });

  } catch (err) {
    console.error('Error al obtener historial de caja:', err);
    res.status(500).json({ error: 'Error al obtener historial de caja' });
  }
});

// ============================================
// GET - Detalle de una caja (abierta o cerrada): resumen + ventas del período con filtros
// ============================================
router.get('/:id', authenticateToken, requireAdminOperador, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT cc.*, ou.name as opened_by_name, cu.name as closed_by_name
       FROM cierre_caja cc
       LEFT JOIN users ou ON cc.opened_by = ou.id
       LEFT JOIN users cu ON cc.closed_by = cu.id
       WHERE cc.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caja no encontrada' });
    }

    const caja = result.rows[0];
    const hasta = caja.closed_at || new Date();

    const { order_id, cliente, vendedor, fecha, producto, estado, forma_pago } = req.query;
    const { ventas, por_canal } = await obtenerVentasPeriodo(caja.opened_at, hasta, { order_id, cliente, vendedor, fecha, producto, estado, forma_pago });

    const totalesEnVivo = caja.closed_at ? null : await calcularTotales(caja.opened_at, hasta, caja.saldo_inicial);
    const por_forma_pago = await obtenerTotalesPorFormaPago(caja.opened_at, hasta);

    res.json({ caja: totalesEnVivo ? { ...caja, ...totalesEnVivo } : caja, ventas, por_canal, por_forma_pago });

  } catch (err) {
    console.error('Error al obtener detalle de caja:', err);
    res.status(500).json({ error: 'Error al obtener detalle de caja' });
  }
});

module.exports = router;
