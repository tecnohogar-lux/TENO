// backend/routes/dashboard.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// GET - Comparativo de ventas: semana actual vs semana anterior
// ============================================
router.get('/comparison', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (user.role === 'escaneo') {
      return res.status(403).json({ error: 'El usuario de escaneo no tiene dashboard' });
    }
    const period = req.query.period === 'month' ? 'month' : 'week';
    const scopeClause = user.role === 'vendedor' ? 'AND vendor_id = $1' : '';
    const params = user.role === 'vendedor' ? [user.id] : [];

    const actual = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
       FROM sales
       WHERE status = 'completado' AND deleted_at IS NULL
       AND DATE_TRUNC('${period}', created_at) = DATE_TRUNC('${period}', CURRENT_DATE)
       ${scopeClause}`,
      params
    );

    const anterior = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
       FROM sales
       WHERE status = 'completado' AND deleted_at IS NULL
       AND DATE_TRUNC('${period}', created_at) = DATE_TRUNC('${period}', CURRENT_DATE - INTERVAL '1 ${period}')
       ${scopeClause}`,
      params
    );

    const totalActual = parseFloat(actual.rows[0].total);
    const totalAnterior = parseFloat(anterior.rows[0].total);
    const variacion_pct = totalAnterior === 0
      ? (totalActual > 0 ? 100 : 0)
      : ((totalActual - totalAnterior) / totalAnterior) * 100;

    res.json({
      period,
      semana_actual: {
        cantidad: parseInt(actual.rows[0].count),
        total: totalActual
      },
      semana_anterior: {
        cantidad: parseInt(anterior.rows[0].count),
        total: totalAnterior
      },
      variacion_pct: Math.round(variacion_pct * 10) / 10
    });

  } catch (err) {
    console.error('Error en comparativo:', err);
    res.status(500).json({ error: 'Error al obtener comparativo' });
  }
});

// ============================================
// GET - Dashboard según rol
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    if (user.role === 'escaneo') {
      return res.status(403).json({ error: 'El usuario de escaneo no tiene dashboard' });
    } else if (user.role === 'vendedor') {
      return res.json(await getDashboardVendedor(user.id));
    } else if (user.role === 'operador') {
      return res.json(await getDashboardOperador());
    } else {
      return res.json(await getDashboardAdmin());
    }

  } catch (err) {
    console.error('Error en dashboard:', err);
    res.status(500).json({ error: 'Error al obtener dashboard' });
  }
});

// ============================================
// Dashboard VENDEDOR - solo sus datos
// ============================================
async function getDashboardVendedor(userId) {
  // Ventas de hoy (todas las creadas hoy, sin importar estado)
  const hoy = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(total) FILTER (WHERE status = 'completado'), 0) as total
     FROM sales
     WHERE vendor_id = $1 AND deleted_at IS NULL AND DATE(created_at) = CURRENT_DATE`,
    [userId]
  );

  // Ventas del mes
  const mes = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(total) FILTER (WHERE status = 'completado'), 0) as total
     FROM sales
     WHERE vendor_id = $1 AND deleted_at IS NULL
     AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`,
    [userId]
  );

  // Últimas ventas
  const ultimas = await pool.query(
    `SELECT s.id, s.product_name, s.total, s.status, s.tipo_venta, s.delivery_status, s.created_at, c.name as client_name
     FROM sales s
     JOIN clients c ON s.client_id = c.id
     WHERE s.vendor_id = $1 AND s.deleted_at IS NULL
     ORDER BY s.created_at DESC
     LIMIT 10`,
    [userId]
  );

  return {
    role: 'vendedor',
    ventas_hoy: {
      cantidad: parseInt(hoy.rows[0].count),
      total: parseFloat(hoy.rows[0].total)
    },
    ventas_mes: {
      cantidad: parseInt(mes.rows[0].count),
      total: parseFloat(mes.rows[0].total)
    },
    tendencia_14_dias: await getTendencia14Dias(userId),
    ultimas_ventas: ultimas.rows
  };
}

async function getTendencia14Dias(vendorId = null) {
  const params = vendorId ? [vendorId] : [];
  const vendorFilter = vendorId ? 'AND s.vendor_id = $1' : '';
  const result = await pool.query(
    `SELECT gs.dia::date as fecha, COALESCE(SUM(s.total) FILTER (WHERE s.status = 'completado'), 0) as total
     FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') as gs(dia)
     LEFT JOIN sales s ON DATE(s.created_at) = gs.dia AND s.deleted_at IS NULL ${vendorFilter}
     GROUP BY gs.dia
     ORDER BY gs.dia`,
    params
  );
  return result.rows.map(r => ({ fecha: r.fecha.toISOString().slice(0, 10), total: parseFloat(r.total) }));
}

async function getVentasEntregadasAyer(scopeClause = '', params = []) {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM sales
     WHERE delivery_status = 'entregado' AND deleted_at IS NULL
     AND DATE(delivered_at) = CURRENT_DATE - INTERVAL '1 day'
     ${scopeClause}`,
    params
  );
  return parseInt(result.rows[0].count);
}

async function getVentasPosHoy() {
  const result = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM sales
     WHERE tipo_venta = 'TIENDA' AND status = 'completado' AND deleted_at IS NULL
     AND DATE(created_at) = CURRENT_DATE`
  );
  return { cantidad: parseInt(result.rows[0].count), total: parseFloat(result.rows[0].total) };
}

async function getEfectivoCaja() {
  const cajaResult = await pool.query('SELECT opened_at, saldo_inicial FROM cierre_caja WHERE closed_at IS NULL LIMIT 1');
  if (cajaResult.rows.length === 0) return null;

  const caja = cajaResult.rows[0];
  const ventasEfectivo = await pool.query(
    `SELECT COALESCE(SUM(total), 0) as total FROM sales
     WHERE status = 'completado' AND payment_method = 'efectivo' AND deleted_at IS NULL
     AND created_at >= $1`,
    [caja.opened_at]
  );

  return parseFloat(caja.saldo_inicial) + parseFloat(ventasEfectivo.rows[0].total);
}

const ESTADOS_ORDENES = [
  'listo_para_imprimir', 'impreso', 'en_camino', 'cancelado', 'reprogramado',
  'solo_envio_pagado', 'solo_entrega_incompleto', 'cambio_producto',
];

async function getEstadoOrdenes() {
  const estadoOrdenes = await pool.query(
    `SELECT delivery_status as estado, COUNT(*) as count
     FROM sales
     WHERE tipo_venta = 'ENVIO' AND delivery_status != 'entregado' AND deleted_at IS NULL
     GROUP BY delivery_status`
  );
  const counts = Object.fromEntries(estadoOrdenes.rows.map(e => [e.estado, parseInt(e.count)]));
  return ESTADOS_ORDENES.map(estado => ({ estado, cantidad: counts[estado] || 0 }));
}

// ============================================
// Dashboard OPERADOR - todos los datos
// ============================================
async function getDashboardOperador() {
  const hoy = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(total) FILTER (WHERE status = 'completado'), 0) as total
     FROM sales
     WHERE deleted_at IS NULL AND DATE(created_at) = CURRENT_DATE`
  );

  const mes = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(total) FILTER (WHERE status = 'completado'), 0) as total
     FROM sales
     WHERE deleted_at IS NULL
     AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`
  );

  const productos = await pool.query(
    `SELECT product_name, COUNT(*) as cantidad, COALESCE(SUM(total), 0) as total
     FROM sales
     WHERE deleted_at IS NULL
     AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
     GROUP BY product_name
     ORDER BY cantidad DESC
     LIMIT 5`
  );

  const entregasPendientes = await pool.query(
    `SELECT COUNT(*) as count FROM sales
     WHERE tipo_venta = 'ENVIO' AND delivery_status NOT IN ('entregado', 'cancelado') AND deleted_at IS NULL`
  );

  return {
    role: 'operador',
    ventas_hoy: {
      cantidad: parseInt(hoy.rows[0].count),
      total: parseFloat(hoy.rows[0].total)
    },
    ventas_mes: {
      cantidad: parseInt(mes.rows[0].count),
      total: parseFloat(mes.rows[0].total)
    },
    entregas_pendientes: parseInt(entregasPendientes.rows[0].count),
    ventas_entregadas_ayer: await getVentasEntregadasAyer(),
    ventas_pos: await getVentasPosHoy(),
    efectivo_caja: await getEfectivoCaja(),
    tendencia_14_dias: await getTendencia14Dias(),
    top_productos: productos.rows.map(p => ({
      nombre: p.product_name,
      cantidad: parseInt(p.cantidad),
      total: parseFloat(p.total)
    })),
    estado_ordenes: await getEstadoOrdenes()
  };
}

// ============================================
// Dashboard ADMIN - control total
// ============================================
async function getDashboardAdmin() {
  const hoy = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(total) FILTER (WHERE status = 'completado'), 0) as total
     FROM sales
     WHERE deleted_at IS NULL AND DATE(created_at) = CURRENT_DATE`
  );

  const mes = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(total) FILTER (WHERE status = 'completado'), 0) as total
     FROM sales
     WHERE deleted_at IS NULL
     AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`
  );

  const entregasPendientes = await pool.query(
    `SELECT COUNT(*) as count FROM sales
     WHERE tipo_venta = 'ENVIO' AND delivery_status NOT IN ('entregado', 'cancelado') AND deleted_at IS NULL`
  );

  return {
    role: 'admin',
    ventas_hoy: {
      cantidad: parseInt(hoy.rows[0].count),
      total: parseFloat(hoy.rows[0].total)
    },
    ventas_mes: {
      cantidad: parseInt(mes.rows[0].count),
      total: parseFloat(mes.rows[0].total)
    },
    entregas_pendientes: parseInt(entregasPendientes.rows[0].count),
    ventas_entregadas_ayer: await getVentasEntregadasAyer(),
    ventas_pos: await getVentasPosHoy(),
    efectivo_caja: await getEfectivoCaja(),
    tendencia_14_dias: await getTendencia14Dias(),
    estado_ordenes: await getEstadoOrdenes()
  };
}

module.exports = router;
