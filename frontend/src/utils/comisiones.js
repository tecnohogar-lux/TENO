// Una venta genera comisión solo cuando quedó cerrada: tienda/retiro completado, o delivery entregado.
// Las canceladas, pendientes o reprogramadas no cuentan (misma regla que /api/sales/comisiones).
export function cuentaParaComision(s) {
  if (s.status !== 'completado' || s.delivery_status === 'cancelado') return false;
  return s.tipo_venta === 'TIENDA' || s.delivery_status === 'entregado';
}

// Comisión que cuenta de una venta (0 si no cuenta o no tiene).
export function comisionContada(s) {
  if (!cuentaParaComision(s) || s.comision === null || s.comision === undefined) return 0;
  return Number(s.comision);
}
