// backend/utils/costosVenta.js
// Costo de compra de una venta (lo que le cuesta a la empresa comprar los productos), para el Excel de
// Reportes. Cada producto se busca por su id (que la venta guarda y no cambia aunque se renombre el
// producto); si la venta es antigua y no tiene id, por su nombre actual y, por último, por un nombre
// anterior del producto. costo_tienda en las líneas SOL, costo en el resto. Es un dato interno: solo
// se le entrega a admin/operador/caja.
const pool = require('../config/database');

function lineasDe(venta) {
  if (Array.isArray(venta.items) && venta.items.length > 0) return venta.items;
  return [{ product_id: venta.product_id, product_name: venta.product_name, quantity: venta.quantity, price_type: venta.price_type }];
}

const clave = (nombre) => String(nombre || '').trim().toLowerCase();

// Agrega `costo_total` (costo unitario x cantidad, sumado por línea) a cada venta.
// Si alguna línea no está en el catálogo o no tiene costo cargado, queda null (un costo parcial confundiría).
async function agregarCostos(ventas) {
  const ids = new Set();
  const nombres = new Set();
  for (const v of ventas) {
    for (const l of lineasDe(v)) {
      if (l.product_id) ids.add(Number(l.product_id));
      if (l.product_name) nombres.add(clave(l.product_name)); // respaldo si el producto con ese id ya no existe
    }
  }

  const porId = new Map();
  const porNombre = new Map();
  const porNombreAnterior = new Map();
  if (ids.size > 0) {
    const r = await pool.query('SELECT id, costo, costo_tienda FROM products WHERE id = ANY($1::int[])', [[...ids]]);
    for (const p of r.rows) porId.set(p.id, p);
  }
  if (nombres.size > 0) {
    const r = await pool.query(
      'SELECT id, LOWER(TRIM(title)) AS titulo, costo, costo_tienda FROM products WHERE LOWER(TRIM(title)) = ANY($1::text[]) ORDER BY id DESC',
      [[...nombres]]
    );
    for (const p of r.rows) porNombre.set(p.titulo, p); // el de menor id queda al final y gana
    const h = await pool.query(
      `SELECT LOWER(TRIM(h.nombre)) AS nombre, p.costo, p.costo_tienda
       FROM producto_nombres_anteriores h JOIN products p ON p.id = h.product_id
       WHERE LOWER(TRIM(h.nombre)) = ANY($1::text[]) ORDER BY h.id ASC`,
      [[...nombres]]
    );
    for (const p of h.rows) porNombreAnterior.set(p.nombre, p); // el más reciente gana
  }

  const producto = (l) => (l.product_id ? porId.get(Number(l.product_id)) : null)
    || porNombre.get(clave(l.product_name))
    || porNombreAnterior.get(clave(l.product_name));

  return ventas.map((v) => {
    let total = 0;
    for (const l of lineasDe(v)) {
      const p = producto(l);
      const unitario = p ? (l.price_type === 'sol' && p.costo_tienda !== null ? p.costo_tienda : p.costo) : null;
      if (unitario === null || unitario === undefined) return { ...v, costo_total: null };
      total += parseFloat(unitario) * Number(l.quantity);
    }
    return { ...v, costo_total: Math.round(total * 100) / 100 };
  });
}

module.exports = { agregarCostos };
