// Lógica compartida por Caja y Envíos para ventas con varias líneas de producto,
// cada una con su propio tipo de precio (sol / marketplace / mayor).
const MIN_MAYOR = 6;
const MIN_MAYOR_MESSAGE = `Venta al mayor: el mínimo es ${MIN_MAYOR} unidades por producto`;

// Comisión unitaria de un producto según el tipo de precio de la línea.
//  - sol / marketplace: comisión guardada en el producto.
//  - mayor (precio libre): 25% de (precio - costo), sin negativos.
// Sin coincidencia en el catálogo (producto libre) o sin costo cargado => null.
async function lookupComisionUnitaria(dbClient, productName, priceType = 'marketplace', unitPrice = null) {
  if (!productName) return null;

  if (priceType === 'mayor') {
    const r = await dbClient.query('SELECT costo FROM products WHERE LOWER(title) = LOWER($1) LIMIT 1', [productName]);
    const costo = r.rows[0]?.costo;
    if (costo === undefined || costo === null || unitPrice === null) return null;
    return Math.max(0, Math.round((Number(unitPrice) - parseFloat(costo)) * 0.25 * 100) / 100);
  }

  const columna = priceType === 'sol' ? 'comision_venta_tienda' : 'comision_venta';
  const result = await dbClient.query(
    `SELECT ${columna} as comision FROM products WHERE LOWER(title) = LOWER($1) LIMIT 1`,
    [productName]
  );
  const valor = result.rows[0]?.comision;
  return valor !== undefined && valor !== null ? parseFloat(valor) : null;
}

// Suma de las comisiones de todas las líneas (null si ninguna tiene comisión).
async function comisionDeLineas(dbClient, lines) {
  let comision = null;
  for (const l of lines) {
    const unit = await lookupComisionUnitaria(dbClient, l.product_name, l.price_type, l.price);
    if (unit !== null) comision = (comision || 0) + unit * l.quantity;
  }
  return comision;
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
async function summarizeLines(dbClient, lines) {
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
    comision: await comisionDeLineas(dbClient, lines),
  };
}

module.exports = { MIN_MAYOR, MIN_MAYOR_MESSAGE, lookupComisionUnitaria, comisionDeLineas, validateLines, summarizeLines };
