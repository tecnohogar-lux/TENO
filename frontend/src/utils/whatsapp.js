import { formatCurrency, formatDate } from './format';
import { deliveryStatusLabel, saleStatusLabel, tipoVentaLabel, paymentMethodLabel, paymentBreakdownLines } from './labels';

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
  } else if (sale.payment_method === 'mixto') {
    const detalle = paymentBreakdownLines(sale).map((l) => `${paymentMethodLabel(l.method)} ${formatCurrency(l.amount)}`).join(' + ');
    lines.push(`Forma de pago: Mixto (${detalle})`);
  } else if (sale.payment_method) {
    lines.push(`Forma de pago: ${paymentMethodLabel(sale.payment_method)}`);
  }

  if (sale.phone) lines.push(`Teléfono: ${sale.phone}`);
  lines.push(`Total: ${formatCurrency(sale.total)}`);
  lines.push(`Estado: ${saleStatusLabel(sale.status)}`);
  lines.push(`Fecha: ${formatDate(sale.created_at)}`);

  return lines.join('\n');
}

// WhatsApp de la tienda (+56 9 7692 1340): el botón siempre abre este chat, no el del cliente de la venta.
const STORE_WHATSAPP = '56976921340';

export async function shareSaleViaWhatsApp(sale) {
  const text = buildSaleShareText(sale);

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // el portapapeles puede no estar disponible; no es crítico
  }

  window.open(`https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank');
}
