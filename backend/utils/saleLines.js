// Lógica compartida por Caja y Envíos para ventas con varias líneas de producto,
// cada una con su propio tipo de precio (sol / marketplace / mayor).
const MIN_MAYOR = 6;
const MIN_MAYOR_MESSAGE = `Venta al mayor: el mínimo es ${MIN_MAYOR} unidades por producto`;

// Diferencia mínima para considerar que un precio cambió (evita falsos cambios por decimales).
const TOLERANCIA_PRECIO = 0.005;

// Precio unitario de un producto del catálogo según el tipo de precio (SOL usa el precio tienda).
function precioDeCatalogo(producto, priceType) {
  return parseFloat(priceType === 'sol' && producto.precio_tienda !== null && producto.precio_tienda !== undefined ? producto.precio_tienda : producto.price);
}

// Porcentaje de comisión estándar: el que tienen todos los vendedores salvo que un admin les fije otro.
const COMISION_ESTANDAR = 25;

// Porcentaje de comisión propio de un vendedor (users.comision_porcentaje), o null si usa el estándar.
async function porcentajeComisionVendedor(dbClient, vendorId) {
  if (!vendorId) return null;
  const r = await dbClient.query('SELECT comision_porcentaje FROM users WHERE id = $1', [vendorId]);
  const valor = r.rows[0]?.comision_porcentaje;
  return valor !== undefined && valor !== null ? Number(valor) : null;
}

// Fracción de (precio - costo) que se paga de comisión, con el porcentaje del vendedor (null = estándar).
function fraccionComision(porcentaje) {
  return (porcentaje === null || porcentaje === undefined ? COMISION_ESTANDAR : Number(porcentaje)) / 100;
}

// Comisión unitaria de un producto según el tipo de precio de la línea y el porcentaje del vendedor
// (`porcentaje`: null = estándar, 25%).
//  - sol / marketplace: comisión guardada en el producto (25% de la rentabilidad). Con otro porcentaje se
//    calcula como ese porcentaje de la rentabilidad del producto.
//  - mayor (precio libre) o precio modificado en esa venta: porcentaje de (precio de venta - costo), sin negativos.
// Sin coincidencia en el catálogo (producto libre) o sin costo cargado => null.
// Si se conoce el id del producto se busca por id (sigue funcionando aunque el producto se haya renombrado);
// si no, por nombre.
async function lookupComisionUnitaria(dbClient, productName, priceType = 'marketplace', unitPrice = null, productId = null, precioModificado = false, porcentaje = null) {
  if (!productName && !productId) return null;
  const donde = productId ? 'id = $1' : 'LOWER(title) = LOWER($1)';
  const clave = productId || productName;
  const fraccion = fraccionComision(porcentaje);

  if (priceType === 'mayor' || precioModificado) {
    const r = await dbClient.query(`SELECT costo, costo_tienda FROM products WHERE ${donde} LIMIT 1`, [clave]);
    // Mismo costo que se guarda en la venta (costoDeLineas): costo tienda en SOL, costo en el resto.
    const p = r.rows[0];
    const costo = priceType === 'sol' && p?.costo_tienda !== null && p?.costo_tienda !== undefined ? p.costo_tienda : p?.costo;
    if (costo === undefined || costo === null || unitPrice === null) return null;
    return Math.max(0, Math.round((Number(unitPrice) - parseFloat(costo)) * fraccion * 100) / 100);
  }

  const sol = priceType === 'sol';
  const estandar = fraccion === COMISION_ESTANDAR / 100;
  const columna = estandar
    ? (sol ? 'comision_venta_tienda' : 'comision_venta')
    : (sol ? 'rentabilidad_tienda' : 'rentabilidad');
  const result = await dbClient.query(
    `SELECT ${columna} as valor FROM products WHERE ${donde} LIMIT 1`,
    [clave]
  );
  const valor = result.rows[0]?.valor;
  if (valor === undefined || valor === null) return null;
  return estandar ? parseFloat(valor) : Math.round(parseFloat(valor) * fraccion * 100) / 100;
}

// Suma de las comisiones de todas las líneas (null si ninguna tiene comisión).
async function comisionDeLineas(dbClient, lines, porcentaje = null) {
  let comision = null;
  for (const l of lines) {
    const unit = await lookupComisionUnitaria(dbClient, l.product_name, l.price_type, l.price, l.product_id || null, !!l.precio_modificado, porcentaje);
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

// Precio de cada línea frente al catálogo. Solo admin/operador/caja (`puedeEditarPrecio`) pueden vender un producto
// a un precio distinto del catálogo; esa línea debe venir marcada `precio_modificado` y queda con su
// `precio_original` (el del catálogo). Un vendedor que mande un precio distinto recibe un error: el precio de
// sus productos es siempre el del catálogo. No aplica a venta al mayor ni a productos libres (precio libre).
async function aplicarPrecios(dbClient, rawLines, { puedeEditarPrecio = false } = {}) {
  const resultado = [];
  for (const l of rawLines) {
    const { precio_modificado: _marca, precio_original: _original, ...linea } = l;
    if (linea.price_type !== 'mayor') {
      const id = await buscarProductoId(dbClient, linea.product_name);
      const r = id ? await dbClient.query('SELECT price, precio_tienda FROM products WHERE id = $1', [id]) : { rows: [] };
      if (r.rows.length > 0) {
        const catalogo = precioDeCatalogo(r.rows[0], linea.price_type);
        if (Math.abs(Number(linea.price) - catalogo) > TOLERANCIA_PRECIO) {
          if (!puedeEditarPrecio) {
            throw { status: 400, message: `No puedes cambiar el precio de "${linea.product_name}". Recarga la página: el precio vigente es el del catálogo.` };
          }
          if (_marca === true) {
            const original = Number(_original);
            resultado.push({ ...linea, precio_modificado: true, precio_original: Number.isFinite(original) && original > 0 ? original : catalogo });
            continue;
          }
        }
      }
    }
    resultado.push(linea);
  }
  return resultado;
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
async function summarizeLines(dbClient, rawLines, opciones = {}) {
  const lines = await adjuntarProductIds(dbClient, await aplicarPrecios(dbClient, rawLines, opciones));
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
    comision: await comisionDeLineas(dbClient, lines, opciones.porcentajeComision ?? null),
    costoTotal: await costoDeLineas(dbClient, lines),
    // Alguna línea se vendió a un precio distinto del catálogo. precioOriginal (precio unitario) solo en ventas de un producto.
    precioModificado: lines.some((l) => l.precio_modificado),
    precioOriginal: lines.length === 1 && lines[0].precio_modificado ? lines[0].precio_original : null,
  };
}

module.exports = { MIN_MAYOR, MIN_MAYOR_MESSAGE, TOLERANCIA_PRECIO, COMISION_ESTANDAR, porcentajeComisionVendedor, fraccionComision, precioDeCatalogo, lookupComisionUnitaria, comisionDeLineas, validateLines, summarizeLines, buscarProductoId, adjuntarProductIds, aplicarPrecios, costoDeLineas };
