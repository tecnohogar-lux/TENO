// Tipo de precio de una venta/retiro: SOL = precios tienda, MARKETPLACE = precios normales del producto.
export const PRICE_TYPE_LABELS = {
  sol: { label: 'SOL', color: '#b85c1f' },
  marketplace: { label: 'MARKETPLACE', color: '#3a6ea5' },
  mayor: { label: 'MAYOR', color: '#7a4a9e' },
  mixto: { label: 'MIXTO', color: '#6f6b62' },
};

// Venta al mayor: mínimo de unidades por producto (el precio es libre).
export const MIN_MAYOR = 6;

export function priceTypeLabel(type) {
  return PRICE_TYPE_LABELS[type]?.label || PRICE_TYPE_LABELS.marketplace.label;
}

// Precio unitario de un producto del catálogo según el tipo de precio elegido.
export function productPrice(product, priceType) {
  if (!product) return 0;
  if (priceType === 'sol' && product.precio_tienda !== null && product.precio_tienda !== undefined) {
    return Number(product.precio_tienda);
  }
  return Number(product.price);
}
