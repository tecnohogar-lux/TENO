import { formatCurrency, formatDate } from './format';
import { deliveryStatusLabel, saleStatusLabel, tipoVentaLabel, paymentMethodLabel } from './labels';

export function buildSaleShareText(sale) {
  const lines = [
    '*TecnoHogar*',
    `Tipo: ${tipoVentaLabel(sale.tipo_venta)}`,
    `Producto: ${sale.product_name}`,
    `Cantidad: ${sale.quantity}`,
    `Cliente: ${sale.client_name}`,
  ];

  if (sale.tipo_venta === 'ENVIO') {
    if (sale.comuna) lines.push(`Comuna: ${sale.comuna}`);
    if (sale.address) lines.push(`Dirección: ${sale.address}`);
    lines.push(`Estado envío: ${deliveryStatusLabel(sale.delivery_status)}`);
  } else if (sale.payment_method) {
    lines.push(`Forma de pago: ${paymentMethodLabel(sale.payment_method)}`);
  }

  if (sale.phone) lines.push(`Teléfono: ${sale.phone}`);
  lines.push(`Total: ${formatCurrency(sale.total)}`);
  lines.push(`Estado: ${saleStatusLabel(sale.status)}`);
  lines.push(`Fecha: ${formatDate(sale.created_at)}`);

  return lines.join('\n');
}

function normalizePhoneCL(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('56')) return digits;
  if (digits.length === 9) return '56' + digits;
  return digits;
}

export async function shareSaleViaWhatsApp(sale) {
  const text = buildSaleShareText(sale);

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // el portapapeles puede no estar disponible; no es crítico
  }

  const phone = normalizePhoneCL(sale.phone);
  const url = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;

  window.open(url, '_blank');
}
