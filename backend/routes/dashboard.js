// backend/routes/dashboard.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

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
  // Ventas de hoy
  const hoy = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
     FROM sales 
     WHERE vendor_id = $1 AND DATE(created_at) = CURRENT_DATE`,
    [userId]
  );

  // Ventas del mes
  const mes = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
     FROM sales 
     WHERE vendor_id = $1 
     AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`,
    [userId]
  );

  // Últimas ventas
  const ultimas = await pool.query(
    `SELECT s.id, s.product_name, s.total, s.status, s.created_at, c.name as client_name
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
  // Ventas de hoy
  const hoy = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
     FROM sales 
     WHERE DATE(created_at) = CURRENT_DATE`
  );

  // Ventas del mes
  const mes = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
     FROM sales 
     WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`
  );

  // Vendedores activos
  const vendedores = await pool.query(
    `SELECT u.id, u.name, COUNT(s.id) as ventas_hoy, COALESCE(SUM(s.total), 0) as total_hoy
     FROM users u
     LEFT JOIN sales s ON u.id = s.vendor_id AND DATE(s.created_at) = CURRENT_DATE
     WHERE u.role = 'vendedor' AND u.is_active = true
     GROUP BY u.id, u.name
     ORDER BY ventas_hoy DESC`
  );

  // Top productos
  const productos = await pool.query(
    `SELECT product_name, COUNT(*) as cantidad, COALESCE(SUM(total), 0) as total
     FROM sales
     WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
     GROUP BY product_name
     ORDER BY cantidad DESC
     LIMIT 5`
  );

  // Clientes totales
  const clientes = await pool.query(
    `SELECT COUNT(*) as count FROM clients`
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
    total_clientes: parseInt(clientes.rows[0].count)
  };
}

// ============================================
// Dashboard ADMIN - control total
// ============================================
async function getDashboardAdmin() {
  // Usuarios activos
  const usuarios = await pool.query(
    `SELECT role, COUNT(*) as count FROM users WHERE is_active = true GROUP BY role`
  );

  // Ventas de hoy
  const hoy = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
     FROM sales 
     WHERE DATE(created_at) = CURRENT_DATE`
  );

  // Ventas del mes
  const mes = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
     FROM sales 
     WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`
  );

  // Clientes totales
  const clientes = await pool.query(
    `SELECT COUNT(*) as count FROM clients`
  );

  // Estado de entregas
  const entregas = await pool.query(
    `SELECT delivery_status, COUNT(*) as count 
     FROM sales 
     WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
     GROUP BY delivery_status`
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
    estado_entregas: entregas.rows.map(e => ({
      estado: e.delivery_status,
      cantidad: parseInt(e.count)
    }))
  };
}

module.exports = router;