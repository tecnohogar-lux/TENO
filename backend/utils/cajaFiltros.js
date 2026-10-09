// backend/utils/cajaFiltros.js
// Qué ventas cuentan en los totales de la caja y del cierre de caja.
//  - Venta de tienda: cuando está completada.
//  - Envío prepagado: desde que se registra (el cliente ya pagó en el mostrador), aunque todavía no se
//    haya entregado; solo deja de contar si la venta se cancela.
// Los deliveries (ENVIO) y los envíos a regiones no pasan por caja (se excluyen aparte).

// Condición SQL. `alias` incluye el punto, ej. 's.'
const cuentaEnCajaSql = (alias = '') =>
  `(${alias}status = 'completado' OR (${alias}tipo_venta = 'ENVIO_PREPAGADO' AND ${alias}status <> 'cancelado'))`;

// Misma regla para una fila ya leída en JS.
const cuentaEnCaja = (venta) =>
  venta.status === 'completado' || (venta.tipo_venta === 'ENVIO_PREPAGADO' && venta.status !== 'cancelado');

module.exports = { cuentaEnCajaSql, cuentaEnCaja };
