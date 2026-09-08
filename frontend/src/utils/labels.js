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

export const TIPO_VENTA_LABELS = {
  ENVIO: { label: 'Envío', color: '#3a6ea5' },
  TIENDA: { label: 'Tienda', color: '#4c7a52' },
};

export const PAYMENT_METHOD_LABELS = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};

export function saleStatusLabel(value) {
  return SALE_STATUS_LABELS[value]?.label || value || '-';
}

export function deliveryStatusLabel(value) {
  if (value === 'completado_tienda') return 'Completado en tienda';
  return DELIVERY_STATUS_LABELS[value]?.label || value || '-';
}

export function tipoVentaLabel(value) {
  return TIPO_VENTA_LABELS[value]?.label || value || '-';
}

export function paymentMethodLabel(value) {
  return PAYMENT_METHOD_LABELS[value] || value || '-';
}
