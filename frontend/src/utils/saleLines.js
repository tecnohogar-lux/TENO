// Venta con varios productos: las líneas vienen en `items`. Una venta de un solo producto
// no trae items; se arma su única línea a partir de los datos de la venta.
export function saleLines(sale) {
  if (Array.isArray(sale.items) && sale.items.length > 0) return sale.items;
  const qty = Number(sale.quantity) || 1;
  const productos = sale.precio_producto !== null && sale.precio_producto !== undefined ? Number(sale.precio_producto) : Number(sale.total);
  return [{ product_name: sale.product_name, quantity: qty, price: productos / qty, price_type: sale.price_type }];
}
