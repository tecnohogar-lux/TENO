// Lógica compartida por Caja y Envíos para ventas con varias líneas de producto,
// cada una con su propio tipo de precio (sol / marketplace / mayor).
const MIN_MAYOR = 6;
const MIN_MAYOR_MESSAGE = `Venta al mayor: el mínimo es ${MIN_MAYOR} unidades por producto`;

// Comisión unitaria de un producto según el tipo de precio de la línea.
//  - sol / marketplace: comisión guardada en el producto.
//  - mayor (precio libre): 25% de (precio - costo), sin negativos.
// Sin coincidencia en el catálogo (producto libre) o sin costo cargado => null.
// Si se conoce el id del producto se busca por id (sigue funcionando aunque el producto se haya renombrado);
// si no, por nombre.
async function lookupComisionUnitaria(dbClient, productName, priceType = 'marketplace', unitPrice = null, productId = null) {
  if (!productName && !productId) return null;
  const donde = productId ? 'id = $1' : 'LOWER(title) = LOWER($1)';
  const clave = productId || productName;

  if (priceType === 'mayor') {
    const r = await dbClient.query(`SELECT costo FROM products WHERE ${donde} LIMIT 1`, [clave]);
    const costo = r.rows[0]?.costo;
    if (costo === undefined || costo === null || unitPrice === null) return null;
    return Math.max(0, Math.round((Number(unitPrice) - parseFloat(costo)) * 0.25 * 100) / 100);
  }

  const columna = priceType === 'sol' ? 'comision_venta_tienda' : 'comision_venta';
  const result = await dbClient.query(
    `SELECT ${columna} as comision FROM products WHERE ${donde} LIMIT 1`,
    [clave]
  );
  const valor = result.rows[0]?.comision;
  return valor !== undefined && valor !== null ? parseFloat(valor) : null;
}

// Suma de las comisiones de todas las líneas (null si ninguna tiene comisión).
async function comisionDeLineas(dbClient, lines) {
  let comision = null;
  for (const l of lines) {
    const unit = await lookupComisionUnitaria(dbClient, l.product_name, l.price_type, l.price, l.product_id || null);
    if (unit !== null) comision = (comision || 0) + unit * l.quantity;
  }
  return comision;
}

// Id del producto del catálogo que corresponde a un nombre (sin distinguir mayúsculas), o null si es un
// producto libre. Se guarda en la venta para encontrar el producto aunque después se renombre.
async function buscarProductoId(dbClient, nombre) {
  if (!nombre || !String(nombre).trim()) return null;
  const r = await dbClient.query(
    'SELECT id FROM products WHERE LOWER(TRIM(title)) = LOWER(TRIM($1)) ORDER BY id LIMIT 1',
    [nombre]
  );
  return r.rows[0]?.id ?? null;
}

// Agrega product_id a cada línea (por su nombre actual en el catálogo; null si es un producto libre).
async function adjuntarProductIds(dbClient, lines) {
  const resultado = [];
  for (const l of lines) resultado.push({ ...l, product_id: await buscarProductoId(dbClient, l.product_name) });
  return resultado;
}

// Costo de compra de las líneas (costo unitario x cantidad, sumado), con el costo VIGENTE de cada producto.
// Se guarda en la venta cuando se crea para que un cambio posterior del costo no altere ventas ya hechas.
// costo_tienda en las líneas SOL, costo en el resto. null si alguna línea es un producto libre o no tiene costo.
async function costoDeLineas(dbClient, lines) {
  let total = 0;
  for (const l of lines) {
    if (!l.product_id) return null;
    const r = await dbClient.query('SELECT costo, costo_tienda FROM products WHERE id = $1', [l.product_id]);
    const p = r.rows[0];
    if (!p) return null;
    const unitario = l.price_type === 'sol' && p.costo_tienda !== null ? p.costo_tienda : p.costo;
    if (unitario === null || unitario === undefined) return null;
    total += parseFloat(unitario) * Number(l.quantity);
  }
  return Math.round(total * 100) / 100;
}

// Devuelve un mensaje de error si alguna línea es inválida, o null si todas lo son.
function validateLines(lines) {
  if (lines.some((l) => !l.product_name || !(l.quantity >= 1) || !(l.price > 0))) {
    return 'Cada producto necesita nombre, cantidad y precio';
  }
  if (lines.some((l) => l.price_type === 'mayor' && l.quantity < MIN_MAYOR)) return MIN_MAYOR_MESSAGE;
  return null;
}

// Resume una transacción: totales, nombre a mostrar, tipo de precio (o 'mixto') y comisión.
// Con más de una línea, las líneas se guardan en `itemsJson`; con una sola, queda como venta simple.
async function summarizeLines(dbClient, rawLines) {
  const lines = await adjuntarProductIds(dbClient, rawLines);
  const productosTotal = lines.reduce((sum, l) => sum + l.quantity * l.price, 0);
  const totalQty = lines.reduce((sum, l) => sum + l.quantity, 0);
  const nombre = lines.length === 1 ? lines[0].product_name : lines.map((l) => `${l.product_name} x${l.quantity}`).join(' + ');
  const tipos = new Set(lines.map((l) => l.price_type));

  return {
    productosTotal,
    totalQty,
    productName: nombre.length > 255 ? nombre.slice(0, 254) + '…' : nombre,
    priceType: tipos.size > 1 ? 'mixto' : lines[0].price_type,
    itemsJson: lines.length > 1 ? JSON.stringify(lines) : null,
    // Venta de un solo producto: su id va en sales.product_id (las de varios lo llevan en cada línea de items).
    productId: lines.length === 1 ? lines[0].product_id : null,
    comision: await comisionDeLineas(dbClient, lines),
    costoTotal: await costoDeLineas(dbClient, lines),
  };
}

module.exports = { MIN_MAYOR, MIN_MAYOR_MESSAGE, lookupComisionUnitaria, comisionDeLineas, validateLines, summarizeLines, buscarProductoId, adjuntarProductIds, costoDeLineas };
