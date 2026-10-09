// backend/routes/cashRegister.js
// Apertura/Cierre de Caja: una sola caja global por día. Admin/Operador abren y cierran.
// El módulo de Caja (ventas) requiere que haya una caja abierta aquí (ver routes/caja.js).
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');
const { formaPagoCondition } = require('../utils/paymentBreakdown');
const { conCobroSql } = require('../utils/sinCobro');
const { cuentaEnCaja } = require('../utils/cajaFiltros');
const { obtenerTotalesPorFormaPago, calcularTotales, recalcularCierre } = require('../utils/cierreCaja');

const requireAdminOperador = requireRole(['admin', 'operador', 'caja'], 'No tienes permiso para acceder a Apertura/Cierre de Caja');
const requireAdmin = requireRole(['admin'], 'Solo un admin puede corregir cierres de caja');

// Ventas del período separadas por canal (Tienda / Envío prepagado), con filtros opcionales.
// Solo entra lo que pasa por caja: los deliveries (Delivery Santiago) y los envíos a regiones no.
async function obtenerVentasPeriodo(desde, hasta, filtros = {}) {
  // Delivery Santiago (ENVIO) y Envíos a Regiones no entran a la caja: el delivery se cobra al entregar y las
  // regiones se llevan aparte. El envío prepagado sí entra (se cobra en el mostrador). Los envíos sin cobro
  // (solo envío, solo entrega, cambio de producto) tampoco.
  const conditions = ['s.deleted_at IS NULL', `s.tipo_venta NOT IN ('ENVIO', 'ENVIO_REGION')`, conCobroSql('s.'), 's.created_at >= $1', 's.created_at <= $2'];
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
    conditions.push(formaPagoCondition(params, filtros.forma_pago));
  }

  const result = await pool.query(
    `SELECT s.*, u.name as vendor_name, c.name as client_name, ru.name as registered_by_name,
            CASE
              WHEN s.tipo_venta = 'TIENDA' THEN 'tienda'
              ELSE 'prepagado'
            END as canal
     FROM sales s
     JOIN users u ON s.vendor_id = u.id
     JOIN clients c ON s.client_id = c.id
     LEFT JOIN users ru ON s.registered_by = ru.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY s.created_at DESC`,
    params
  );

  const porCanal = { tienda: { cantidad: 0, total: 0 }, prepagado: { cantidad: 0, total: 0 } };
  for (const s of result.rows) {
    porCanal[s.canal].cantidad += 1;
    if (cuentaEnCaja(s)) porCanal[s.canal].total += parseFloat(s.total);
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
    const ahora = new Date();
    const por_forma_pago = await obtenerTotalesPorFormaPago(caja.opened_at, ahora);
    const totales = await calcularTotales(caja.opened_at, ahora, caja.saldo_inicial, por_forma_pago);

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
    const por_forma_pago = await obtenerTotalesPorFormaPago(caja.opened_at, cerradoEn);
    const { total_vendido, total_gastos, total_ingresos, saldo_real } = await calcularTotales(caja.opened_at, cerradoEn, caja.saldo_inicial, por_forma_pago);
    const diferencia = parseFloat(efectivo_contado) - saldo_real;

    const result = await pool.query(
      `UPDATE cierre_caja
       SET closed_at = $1, closed_by = $2, total_vendido = $3, total_gastos = $4,
           saldo_real = $5, efectivo_contado = $6, diferencia = $7, notas = $8, total_ingresos = $10
       WHERE id = $9 AND closed_at IS NULL
       RETURNING *`,
      [cerradoEn, user.id, total_vendido, total_gastos, saldo_real, efectivo_contado, diferencia, notas || null, id, total_ingresos]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'La caja ya fue cerrada por otra solicitud' });
    }

    await logAudit({ userId: user.id, action: 'cerrar_caja', tableName: 'cierre_caja', recordId: Number(id), oldValues: caja, newValues: result.rows[0] });

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
    const { page, limit, desde, hasta } = req.query;

    const conditions = ['cc.closed_at IS NOT NULL'];
    const params = [];
    if (desde) {
      params.push(desde);
      conditions.push(`cc.closed_at >= $${params.length}::date`);
    }
    if (hasta) {
      params.push(hasta);
      conditions.push(`cc.opened_at < ($${params.length}::date + INTERVAL '1 day')`);
    }
    const where = conditions.join(' AND ');

    const countResult = await pool.query(`SELECT COUNT(*) as count FROM cierre_caja cc WHERE ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    let query = `
      SELECT cc.*, ou.name as opened_by_name, cu.name as closed_by_name
      FROM cierre_caja cc
      LEFT JOIN users ou ON cc.opened_by = ou.id
      LEFT JOIN users cu ON cc.closed_by = cu.id
      WHERE ${where}
      ORDER BY cc.closed_at DESC
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

    const por_forma_pago = await obtenerTotalesPorFormaPago(caja.opened_at, hasta);
    const totalesEnVivo = caja.closed_at ? null : await calcularTotales(caja.opened_at, hasta, caja.saldo_inicial, por_forma_pago);

    const gastos = await pool.query(
      `SELECT g.*, u.name as created_by_name FROM gastos g LEFT JOIN users u ON g.created_by = u.id
       WHERE g.created_at >= $1 AND g.created_at <= $2 ORDER BY g.created_at ASC`,
      [caja.opened_at, hasta]
    );
    const ingresos = await pool.query(
      `SELECT i.*, u.name as created_by_name FROM ingresos_caja i LEFT JOIN users u ON i.created_by = u.id
       WHERE i.created_at >= $1 AND i.created_at <= $2 ORDER BY i.created_at ASC`,
      [caja.opened_at, hasta]
    );

    res.json({
      caja: totalesEnVivo ? { ...caja, ...totalesEnVivo } : caja,
      ventas, por_canal, por_forma_pago,
      gastos: gastos.rows,
      ingresos: ingresos.rows,
    });

  } catch (err) {
    console.error('Error al obtener detalle de caja:', err);
    res.status(500).json({ error: 'Error al obtener detalle de caja' });
  }
});

// ============================================
// PUT - Corregir un cierre ya cerrado (solo admin): saldo inicial, efectivo contado y notas.
// Los totales y la diferencia se recalculan con lo que hay hoy en el período del cierre.
// ============================================
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { saldo_inicial, efectivo_contado, notas } = req.body;

    const cajaResult = await pool.query('SELECT * FROM cierre_caja WHERE id = $1', [id]);
    if (cajaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Caja no encontrada' });
    }
    const caja = cajaResult.rows[0];
    if (!caja.closed_at) {
      return res.status(400).json({ error: 'Solo se pueden corregir cierres ya cerrados. La caja abierta se cierra desde su panel.' });
    }

    const parseMonto = (v, label) => {
      const n = Number(v);
      if (v === '' || v === null || !Number.isFinite(n) || n < 0) throw { status: 400, message: `${label} debe ser un número igual o mayor a 0` };
      return n;
    };
    let nuevoSaldoInicial = caja.saldo_inicial;
    let nuevoContado = caja.efectivo_contado;
    try {
      if (saldo_inicial !== undefined) nuevoSaldoInicial = parseMonto(saldo_inicial, 'El saldo inicial');
      if (efectivo_contado !== undefined) nuevoContado = parseMonto(efectivo_contado, 'El efectivo contado');
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }
    const nuevasNotas = notas !== undefined ? (String(notas).trim() || null) : caja.notas;

    await pool.query(
      `UPDATE cierre_caja SET saldo_inicial = $1, efectivo_contado = $2, notas = $3 WHERE id = $4`,
      [nuevoSaldoInicial, nuevoContado, nuevasNotas, id]
    );
    const actualizado = await recalcularCierre({ ...caja, saldo_inicial: nuevoSaldoInicial, efectivo_contado: nuevoContado }, user.id);

    await logAudit({
      userId: user.id, action: 'corregir_cierre_caja', tableName: 'cierre_caja', recordId: Number(id),
      oldValues: { saldo_inicial: caja.saldo_inicial, efectivo_contado: caja.efectivo_contado, notas: caja.notas, saldo_real: caja.saldo_real, diferencia: caja.diferencia },
      newValues: { saldo_inicial: actualizado.saldo_inicial, efectivo_contado: actualizado.efectivo_contado, notas: actualizado.notas, saldo_real: actualizado.saldo_real, diferencia: actualizado.diferencia },
    });

    res.json({ message: 'Cierre corregido', caja: actualizado });

  } catch (err) {
    console.error('Error al corregir cierre de caja:', err);
    res.status(500).json({ error: 'Error al corregir cierre de caja' });
  }
});

// ============================================
// POST - Recalcular los totales de un cierre ya cerrado (solo admin)
// ============================================
router.post('/:id/recalcular', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const cajaResult = await pool.query('SELECT * FROM cierre_caja WHERE id = $1 AND closed_at IS NOT NULL', [req.params.id]);
    if (cajaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cierre no encontrado' });
    }
    const actualizado = await recalcularCierre(cajaResult.rows[0], req.user.id);
    res.json({ message: 'Cierre recalculado', caja: actualizado });

  } catch (err) {
    console.error('Error al recalcular cierre de caja:', err);
    res.status(500).json({ error: 'Error al recalcular cierre de caja' });
  }
});

module.exports = router;
