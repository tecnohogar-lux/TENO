import { formatCurrency, formatDate } from './format';
import { saleLines } from './saleLines';
import { deliveryTypeLabel, isSinCobro, tipoVentaLabel } from './labels';

// Texto plano de una etiqueta, para pegarlo en un chat o un documento (botón "Copiar al portapapeles").
// Lleva lo mismo que la etiqueta impresa: tipo, número, comuna, productos, datos del cliente y total.

function bloqueProductos(lineas) {
  return ['Productos:', ...lineas.map((l) => `${l.quantity} x ${l.product_name}`)];
}

// Envío (Delivery Santiago o Envío a región) o venta: `sale` viene de /api/sales.
export function textoEtiquetaVenta(sale) {
  const esRegion = sale.tipo_venta === 'ENVIO_REGION';
  const esEnvio = esRegion || ['ENVIO', 'ENVIO_PREPAGADO'].includes(sale.tipo_venta);
  const titulo = esRegion ? 'Envío a región' : esEnvio ? deliveryTypeLabel(sale.delivery_type || 'delivery') : tipoVentaLabel(sale.tipo_venta);

  const lineas = [titulo.toUpperCase(), `Etiqueta #${sale.id}`];
  if (esEnvio) {
    if (esRegion && sale.region) lineas.push(`Región: ${sale.region}`);
    lineas.push(`Comuna: ${sale.comuna || '-'}`);
  }
  lineas.push('', ...bloqueProductos(saleLines(sale)), '');

  lineas.push(`Cliente: ${sale.client_name || '-'}`);
  if (esEnvio) {
    lineas.push(`Teléfono: ${sale.phone || '-'}`, `Dirección: ${sale.address || '-'}`);
    if (esRegion) lineas.push(`Email: ${sale.client_email || '-'}`);
  }
  if (sale.notes) lineas.push(`Notas: ${sale.notes}`);

  // Los envíos sin cobro (solo envío, solo entrega, cambio de producto) no llevan monto.
  if (!isSinCobro(sale)) lineas.push('', `TOTAL: ${formatCurrency(sale.total)}`);
  return lineas.join('\n');
}

// Retiro en tienda: `retiro` viene de /api/retiros-tienda.
export function textoEtiquetaRetiro(retiro) {
  const lineas = ['RETIRO EN TIENDA', `Retiro #${retiro.id}`, '', ...bloqueProductos(retiro.items || []), ''];
  lineas.push(`Cliente: ${retiro.client_name || '-'}`);
  if (retiro.vendor_name) lineas.push(`Vendedor: ${retiro.vendor_name}`);
  lineas.push(`Fecha de registro: ${formatDate(retiro.created_at)}`);
  if (retiro.notes) lineas.push(`Notas: ${retiro.notes}`);
  lineas.push('', `TOTAL: ${formatCurrency(retiro.total)}`);
  return lineas.join('\n');
}

// Copia el texto al portapapeles. Devuelve true si se pudo. Si el navegador no permite la API moderna
// (por ejemplo una dirección sin https), usa el método antiguo.
export async function copiarAlPortapapeles(texto) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch { /* se intenta el método antiguo */ }
  try {
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
