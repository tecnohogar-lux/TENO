// backend/utils/cierreCaja.js
// Cálculo de los totales de una caja (abierta o cerrada) y recálculo de los cierres ya guardados
// cuando se corrige una operación de su período (venta, gasto o ingreso).
const pool = require('../config/database');
const { totalesPorFormaPago } = require('./paymentBreakdown');
const { conCobroSql } = require('./sinCobro');
const { cuentaEnCajaSql } = require('./cajaFiltros');
const { logAudit } = require('./auditLog');

// Cuánto dinero debería existir por cada forma de pago en el período (para cuadrar caja:
// solo el efectivo se cuenta físicamente, el resto se verifica contra el extracto bancario/POS).
// Las ventas con pago mixto aportan a cada forma de pago solo el monto de su línea.
async function obtenerTotalesPorFormaPago(desde, hasta) {
  return totalesPorFormaPago(pool, desde, hasta);
}

// Calcula los totales del período [desde, hasta] para una caja (abierta o ya cerrada).
// porFormaPago se puede pasar ya calculado para no repetir la misma consulta.
async function calcularTotales(desde, hasta, saldoInicial, porFormaPago = null) {
  const ventas = await pool.query(
    `SELECT COALESCE(SUM(total) FILTER (WHERE ${cuentaEnCajaSql()}), 0) as total_vendido
     FROM sales
     WHERE deleted_at IS NULL AND tipo_venta NOT IN ('ENVIO', 'ENVIO_REGION') AND ${conCobroSql()} AND created_at >= $1 AND created_at <= $2`,
    [desde, hasta]
  );
  if (!porFormaPago) porFormaPago = await obtenerTotalesPorFormaPago(desde, hasta);

  const gastosResult = await pool.query(
    `SELECT COALESCE(SUM(monto), 0) as total_gastos FROM gastos WHERE created_at >= $1 AND created_at <= $2`,
    [desde, hasta]
  );

  // Ingresos a caja (pagos de deudas, abonos...): efectivo sin venta asociada, solo suma al saldo.
  const ingresosResult = await pool.query(
    `SELECT COALESCE(SUM(monto), 0) as total_ingresos FROM ingresos_caja WHERE created_at >= $1 AND created_at <= $2`,
    [desde, hasta]
  );

  const total_vendido = parseFloat(ventas.rows[0].total_vendido);
  const efectivo_ventas = porFormaPago.efectivo;
  const total_gastos = parseFloat(gastosResult.rows[0].total_gastos);
  const total_ingresos = parseFloat(ingresosResult.rows[0].total_ingresos);
  const saldo_real = parseFloat(saldoInicial) + efectivo_ventas + total_ingresos - total_gastos;

  return { total_vendido, efectivo_ventas, total_gastos, total_ingresos, saldo_real };
}

const num = (v) => (v === null || v === undefined ? null : Number(v));

// Recalcula y guarda los totales de un cierre YA CERRADO a partir de lo que hay hoy en su período
// (se conserva el efectivo contado: la diferencia se vuelve a calcular contra el nuevo saldo real).
// Devuelve la fila actualizada.
async function recalcularCierre(caja, userId = null) {
  const por = await obtenerTotalesPorFormaPago(caja.opened_at, caja.closed_at);
  const t = await calcularTotales(caja.opened_at, caja.closed_at, caja.saldo_inicial, por);
  const contado = num(caja.efectivo_contado);
  const diferencia = contado === null ? null : contado - t.saldo_real;

  const result = await pool.query(
    `UPDATE cierre_caja
     SET total_vendido = $1, total_gastos = $2, total_ingresos = $3, saldo_real = $4, diferencia = $5
     WHERE id = $6
     RETURNING *`,
    [t.total_vendido, t.total_gastos, t.total_ingresos, t.saldo_real, diferencia, caja.id]
  );
  const nueva = result.rows[0];

  const cambio = ['total_vendido', 'total_gastos', 'total_ingresos', 'saldo_real', 'diferencia']
    .some((k) => num(caja[k]) !== num(nueva[k]));
  if (cambio) {
    await logAudit({
      userId, action: 'recalcular_cierre_caja', tableName: 'cierre_caja', recordId: caja.id,
      oldValues: { total_vendido: caja.total_vendido, total_gastos: caja.total_gastos, total_ingresos: caja.total_ingresos, saldo_real: caja.saldo_real, diferencia: caja.diferencia },
      newValues: { total_vendido: nueva.total_vendido, total_gastos: nueva.total_gastos, total_ingresos: nueva.total_ingresos, saldo_real: nueva.saldo_real, diferencia: nueva.diferencia },
    });
  }
  return nueva;
}

// Cuando se corrige una operación de un día pasado (venta, gasto, ingreso), el cierre que la
// contiene quedaría con totales viejos: se recalcula. Nunca rompe la operación principal.
async function recalcularCierresQueContienen(fecha, userId = null) {
  if (!fecha) return;
  try {
    const cierres = await pool.query(
      `SELECT * FROM cierre_caja WHERE closed_at IS NOT NULL AND opened_at <= $1 AND closed_at >= $1`,
      [fecha]
    );
    for (const caja of cierres.rows) await recalcularCierre(caja, userId);
  } catch (err) {
    console.error('Error al recalcular cierres de caja:', err.message);
  }
}

module.exports = { obtenerTotalesPorFormaPago, calcularTotales, recalcularCierre, recalcularCierresQueContienen };
