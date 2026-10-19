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
