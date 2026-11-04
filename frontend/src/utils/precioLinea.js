import { productPrice } from './priceType';

// Precio de un producto cambiado a mano en una venta puntual (sin tocar el catálogo).
// Solo admin, operador y caja pueden hacerlo. Cada línea del carrito guarda `precio_catalogo` (el precio del
// catálogo al agregarla); si el precio de la línea difiere de ese, queda `precio_modificado` y el servidor calcula
// la comisión con el precio de venta (25% de precio - costo).

// La línea admite cambiar el precio: producto del catálogo con precio SOL/MARKETPLACE (la venta al mayor y los
// productos libres ya tienen precio libre).
export function lineaEditable(item) {
  return item.price_type !== 'mayor' && item.precio_catalogo !== undefined && item.precio_catalogo !== null;
}

// Devuelve la línea con el nuevo precio (puede venir '' mientras se escribe) y la marca de modificado.
export function conPrecio(item, valor) {
  const precio = valor === '' ? '' : Number(valor);
  const modificado = precio !== '' && Math.abs(precio - Number(item.precio_catalogo)) > 0.005;
  const { precio_original: _descartado, ...resto } = item;
  return { ...resto, price: precio, precio_modificado: modificado };
}

// Campos de una línea que se mandan al servidor.
export function lineaParaEnviar(item) {
  return {
    ...item,
    price: Number(item.price),
    ...(item.precio_modificado ? { precio_modificado: true, precio_original: Number(item.precio_catalogo) } : { precio_modificado: false }),
  };
}

// Vuelve a cotizar con el catálogo actual las líneas de un borrador recuperado. Las líneas de catálogo con
// el precio de siempre toman el precio nuevo; las de precio modificado lo conservan (y se revisa si sigue
// siendo distinto del catálogo nuevo); la venta al mayor y los productos libres no se tocan.
export function repreciarLineas(lineas, productos) {
  return lineas.map((l) => {
    if (!lineaEditable(l)) return l;
    const producto = productos.find((p) => (l.product_id ? String(p.id) === String(l.product_id) : p.title === l.product_name));
    if (!producto) return l;
    const catalogo = productPrice(producto, l.price_type);
    if (!Number.isFinite(catalogo) || Math.abs(catalogo - Number(l.precio_catalogo)) <= 0.005) return l;
    return conPrecio({ ...l, precio_catalogo: catalogo }, l.precio_modificado ? l.price : catalogo);
  });
}

// Al cargar líneas ya guardadas (retiro, venta): el precio del catálogo es el original si se había modificado.
export function precioCatalogoDeGuardada(linea) {
  if (linea.precio_modificado && linea.precio_original !== undefined && linea.precio_original !== null) return Number(linea.precio_original);
  return linea.price_type === 'mayor' || !linea.product_id ? null : Number(linea.price);
}
