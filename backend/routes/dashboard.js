// backend/routes/dashboard.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// GET - Comparativo de ventas: mes actual vs mes anterior
// ============================================
router.get('/comparison', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const scopeClause = user.role === 'vendedor' ? 'AND vendor_id = $1' : '';
    const params = user.role === 'vendedor' ? [user.id] : [];

    const actual = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
       FROM sales
       WHERE status = 'completado'
       AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
       ${scopeClause}`,
      params
    );

    const anterior = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
       FROM sales
       WHERE status = 'completado'
       AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
       ${scopeClause}`,
      params
    );

    const totalActual = parseFloat(actual.rows[0].total);
    const totalAnterior = parseFloat(anterior.rows[0].total);
    const variacion_pct = totalAnterior === 0
      ? (totalActual > 0 ? 100 : 0)
      : ((totalActual - totalAnterior) / totalAnterior) * 100;

    res.json({
      mes_actual: {
        cantidad: parseInt(actual.rows[0].count),
        total: totalActual
      },
      mes_anterior: {
        cantidad: parseInt(anterior.rows[0].count),
        total: totalAnterior
      },
      variacion_pct: Math.round(variacion_pct * 10) / 10
    });

  } catch (err) {
    console.error('Error en comparativo mensual:', err);
    res.status(500).json({ error: 'Error al obtener comparativo mensual' });
  }
});

// ============================================
// GET - Dashboard según rol
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    if (user.role === 'vendedor') {
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
     WHERE vendor_id = $1 AND DATE(created_at) = CURRENT_DATE`,
    [userId]
  );

  // Ventas del mes
  const mes = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(total) FILTER (WHERE status = 'completado'), 0) as total
     FROM sales
     WHERE vendor_id = $1
     AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`,
    [userId]
  );

  // Últimas ventas
  const ultimas = await pool.query(
    `SELECT s.id, s.product_name, s.total, s.status, s.tipo_venta, s.delivery_status, s.created_at, c.name as client_name
     FROM sales s
     JOIN clients c ON s.client_id = c.id
     WHERE s.vendor_id = $1
     ORDER BY s.created_at DESC
     LIMIT 10`,
    [userId]
  );

  // Clientes únicos
  const clientes = await pool.query(
    `SELECT COUNT(DISTINCT client_id) as count FROM sales WHERE vendor_id = $1`,
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
    clientes_unicos: parseInt(clientes.rows[0].count),
    ultimas_ventas: ultimas.rows
  };
}

// ============================================
// Dashboard OPERADOR - todos los datos
// ============================================
async function getDashboardOperador() {
  const hoy = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(total) FILTER (WHERE status = 'completado'), 0) as total
     FROM sales
     WHERE DATE(created_at) = CURRENT_DATE`
  );

  const mes = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(total) FILTER (WHERE status = 'completado'), 0) as total
     FROM sales
     WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`
  );

  const vendedores = await pool.query(
    `SELECT u.id, u.name, COUNT(s.id) as ventas_hoy, COALESCE(SUM(s.total) FILTER (WHERE s.status = 'completado'), 0) as total_hoy
     FROM users u
     LEFT JOIN sales s ON u.id = s.vendor_id AND DATE(s.created_at) = CURRENT_DATE
     WHERE u.role = 'vendedor' AND u.is_active = true
     GROUP BY u.id, u.name
     ORDER BY ventas_hoy DESC`
  );

  const productos = await pool.query(
    `SELECT product_name, COUNT(*) as cantidad, COALESCE(SUM(total), 0) as total
     FROM sales
     WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
     GROUP BY product_name
     ORDER BY cantidad DESC
     LIMIT 5`
  );

  const clientes = await pool.query(`SELECT COUNT(*) as count FROM clients`);

  const entregasPendientes = await pool.query(
    `SELECT COUNT(*) as count FROM sales
     WHERE tipo_venta = 'ENVIO' AND delivery_status NOT IN ('entregado', 'cancelado')`
  );

  const estadoOrdenes = await pool.query(
    `SELECT COALESCE(delivery_status, 'completado_tienda') as estado, COUNT(*) as count
     FROM sales
     WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
     GROUP BY estado`
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
    vendedores_activos: vendedores.rows.map(v => ({
      id: v.id,
      nombre: v.name,
      ventas_hoy: parseInt(v.ventas_hoy),
      total_hoy: parseFloat(v.total_hoy)
    })),
    top_productos: productos.rows.map(p => ({
      nombre: p.product_name,
      cantidad: parseInt(p.cantidad),
      total: parseFloat(p.total)
    })),
    total_clientes: parseInt(clientes.rows[0].count),
    estado_ordenes: estadoOrdenes.rows.map(e => ({
      estado: e.estado,
      cantidad: parseInt(e.count)
    }))
  };
}

// ============================================
// Dashboard ADMIN - control total
// ============================================
async function getDashboardAdmin() {
  const usuarios = await pool.query(
    `SELECT role, COUNT(*) as count FROM users WHERE is_active = true GROUP BY role`
  );

  const hoy = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(total) FILTER (WHERE status = 'completado'), 0) as total
     FROM sales
     WHERE DATE(created_at) = CURRENT_DATE`
  );

  const mes = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(total) FILTER (WHERE status = 'completado'), 0) as total
     FROM sales
     WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`
  );

  const clientes = await pool.query(`SELECT COUNT(*) as count FROM clients`);

  const entregasPendientes = await pool.query(
    `SELECT COUNT(*) as count FROM sales
     WHERE tipo_venta = 'ENVIO' AND delivery_status NOT IN ('entregado', 'cancelado')`
  );

  const estadoOrdenes = await pool.query(
    `SELECT COALESCE(delivery_status, 'completado_tienda') as estado, COUNT(*) as count
     FROM sales
     WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
     GROUP BY estado`
  );

  return {
    role: 'admin',
    usuarios: {
      total_vendedores: usuarios.rows.find(r => r.role === 'vendedor')?.count || 0,
      total_operadores: usuarios.rows.find(r => r.role === 'operador')?.count || 0,
      total_admins: usuarios.rows.find(r => r.role === 'admin')?.count || 0
    },
    ventas_hoy: {
      cantidad: parseInt(hoy.rows[0].count),
      total: parseFloat(hoy.rows[0].total)
    },
    ventas_mes: {
      cantidad: parseInt(mes.rows[0].count),
      total: parseFloat(mes.rows[0].total)
    },
    clientes_totales: parseInt(clientes.rows[0].count),
    entregas_pendientes: parseInt(entregasPendientes.rows[0].count),
    estado_ordenes: estadoOrdenes.rows.map(e => ({
      estado: e.estado,
      cantidad: parseInt(e.count)
    }))
  };
}

module.exports = router;
