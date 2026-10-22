// Fechas de una venta/etiqueta para las tablas y reportes.
//  - fechaRegistro: cuándo se creó la etiqueta. En una venta que salió de un retiro en tienda es el día
//    en que se registró el retiro (la venta nace recién cuando el cliente paga en Caja).
//  - fechaSalida: envíos -> cuándo se puso en camino; venta de un retiro -> el día en que el cliente
//    fue a retirar. Vacío si todavía no ocurre.
const TIPOS_ENVIO = ['ENVIO', 'ENVIO_PREPAGADO', 'ENVIO_REGION'];

export function fechaRegistro(s) {
  return s.retiro_registrado_at || s.created_at;
}

export function fechaSalida(s) {
  if (TIPOS_ENVIO.includes(s.tipo_venta)) return s.en_camino_at || null;
  return s.retiro_retirado_at || null;
}

// Rótulo de la columna según el tipo de registro (envío o retiro en tienda).
export const ETIQUETA_FECHA_SALIDA = 'En camino / Retirado';

// ---- Envíos reprogramados (Delivery Santiago) ----
// Un envío reprogramado lleva la marca "Delivery Reprogramado" mientras siga pendiente.
export function esReprogramadoPendiente(s) {
  return !!s.reprogramado_para && !['entregado', 'cancelado'].includes(s.delivery_status);
}

// "YYYY-MM-DD" -> "DD-MM-YYYY" sin pasar por Date (no hay desfase de zona horaria).
export function formatDia(ymd) {
  if (!ymd) return '-';
  const [y, m, d] = String(ymd).slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}

// Hoy en Chile, "YYYY-MM-DD".
export function hoyChileYmd() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function sumarDiasYmd(ymd, n) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
