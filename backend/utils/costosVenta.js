// backend/utils/costosVenta.js
// Costo de compra de una venta (lo que le cuesta a la empresa comprar los productos), para el Excel de
// Reportes. Se busca cada producto por nombre en el catálogo: costo_tienda en las líneas SOL, costo en
// el resto. Es un dato interno: solo se le entrega a admin/operador/caja.
const pool = require('../config/database');

function lineasDe(venta) {
  if (Array.isArray(venta.items) && venta.items.length > 0) return venta.items;
  return [{ product_name: venta.product_name, quantity: venta.quantity, price_type: venta.price_type }];
}

// Agrega `costo_total` (costo unitario x cantidad, sumado por línea) a cada venta.
// Si alguna línea no está en el catálogo o no tiene costo cargado, queda null (un costo parcial confundiría).
async function agregarCostos(ventas) {
  const nombres = new Set();
  for (const v of ventas) for (const l of lineasDe(v)) if (l.product_name) nombres.add(String(l.product_name).toLowerCase());
  const costos = new Map();
  if (nombres.size > 0) {
    const r = await pool.query(
      'SELECT LOWER(title) AS titulo, costo, costo_tienda FROM products WHERE LOWER(title) = ANY($1::text[])',
      [[...nombres]]
    );
    for (const p of r.rows) costos.set(p.titulo, p);
  }

  return ventas.map((v) => {
    let total = 0;
    for (const l of lineasDe(v)) {
      const p = costos.get(String(l.product_name || '').toLowerCase());
      const unitario = p ? (l.price_type === 'sol' && p.costo_tienda !== null ? p.costo_tienda : p.costo) : null;
      if (unitario === null || unitario === undefined) return { ...v, costo_total: null };
      total += parseFloat(unitario) * Number(l.quantity);
    }
    return { ...v, costo_total: Math.round(total * 100) / 100 };
  });
}

module.exports = { agregarCostos };
