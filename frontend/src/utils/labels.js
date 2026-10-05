export const SALE_STATUS_LABELS = {
  pendiente: { label: 'Pendiente', color: '#b98a2e' },
  completado: { label: 'Completado', color: '#4c7a52' },
  cancelado: { label: 'Cancelado', color: '#b3423a' },
};

export const DELIVERY_STATUS_LABELS = {
  listo_para_imprimir: { label: 'Listo para imprimir', color: '#6f6b62' },
  impreso: { label: 'Impreso', color: '#3a6ea5' },
  en_camino: { label: 'En camino', color: '#b98a2e' },
  entregado: { label: 'Entregado', color: '#4c7a52' },
  cancelado: { label: 'Cancelado', color: '#b3423a' },
  reprogramado: { label: 'Reprogramado', color: '#8a5fb0' },
};

export const DELIVERY_STATUS_OPTIONS = Object.keys(DELIVERY_STATUS_LABELS);

// Tipo de envío: independiente del estado de entrega (no lo pisa ni es pisado por
// él). Por defecto todo envío es 'delivery'; solo operador/admin/caja pueden
// cambiarlo a uno de los otros 3 (Delivery Santiago los separa en un botón aparte).
export const DELIVERY_TYPE_LABELS = {
  delivery: { label: 'Delivery', color: '#6f6b62' },
  solo_envio_pagado: { label: 'Solo envío (ya pago)', color: '#3a6ea5' },
  solo_entrega_incompleto: { label: 'Solo entrega (incompleto)', color: '#b98a2e' },
  cambio_producto: { label: 'Cambio de producto', color: '#8a5fb0' },
};

export const DELIVERY_TYPE_OPTIONS = Object.keys(DELIVERY_TYPE_LABELS);

export const TIPO_VENTA_LABELS = {
  ENVIO: { label: 'Envío', color: '#3a6ea5' },
  TIENDA: { label: 'Tienda', color: '#4c7a52' },
  ENVIO_PREPAGADO: { label: 'Envío prepagado', color: '#1b2a82' },
  ENVIO_REGION: { label: 'Envío a región', color: '#8a5fb0' },
};

export const PAYMENT_METHODS = ['efectivo', 'debito', 'credito', 'transferencia', 'link_pago'];

export const PAYMENT_METHOD_LABELS = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
  link_pago: 'Link de pago',
  mixto: 'Mixto',
};

export function saleStatusLabel(value) {
  return SALE_STATUS_LABELS[value]?.label || value || '-';
}

export function deliveryStatusLabel(value) {
  if (value === 'completado_tienda') return 'Completado en tienda';
  return DELIVERY_STATUS_LABELS[value]?.label || value || '-';
}

// Envíos "sin cobro" (solo envío ya pagado, solo entrega incompleta, cambio de producto):
// no se cobran, así que no se muestra su monto ni cuentan en métricas.
export function isSinCobro(sale) {
  return !!sale && !!sale.delivery_type && sale.delivery_type !== 'delivery';
}

export function deliveryTypeLabel(value) {
  return DELIVERY_TYPE_LABELS[value]?.label || value || '-';
}

export function tipoVentaLabel(value) {
  return TIPO_VENTA_LABELS[value]?.label || value || '-';
}

export function paymentMethodLabel(value) {
  return PAYMENT_METHOD_LABELS[value] || value || '-';
}

// Detalle de formas de pago de una venta: si tiene pago mixto devuelve cada
// línea (payment_breakdown); si no, una sola línea a partir de payment_method.
export function paymentBreakdownLines(sale) {
  if (Array.isArray(sale.payment_breakdown) && sale.payment_breakdown.length > 0) return sale.payment_breakdown;
  if (sale.payment_method) {
    return [{ method: sale.payment_method, amount: Number(sale.total), transferencia_verificada: sale.transferencia_verificada }];
  }
  return [];
}
