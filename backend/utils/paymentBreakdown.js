// backend/utils/paymentBreakdown.js
// Pago mixto: una venta puede pagarse con más de una forma de pago a la vez
// (ej. parte efectivo + parte transferencia). payment_method queda en 'mixto'
// y el detalle (método, monto, verificación) se guarda en payment_breakdown (JSON).
const PAYMENT_METHODS = ['efectivo', 'debito', 'credito', 'transferencia', 'link_pago'];

// Valida el detalle de un pago mixto contra el total de la venta.
// Devuelve un mensaje de error (string) o null si es válido.
function validatePaymentBreakdown(breakdown, total) {
  if (!Array.isArray(breakdown) || breakdown.length < 2) {
    return 'El pago mixto necesita al menos 2 formas de pago con montos.';
  }
  const seen = new Set();
  let sum = 0;
  for (const leg of breakdown) {
    if (!leg || !PAYMENT_METHODS.includes(leg.method)) {
      return `Forma de pago inválida en el detalle mixto. Opciones: ${PAYMENT_METHODS.join(', ')}`;
    }
    if (seen.has(leg.method)) {
      return `La forma de pago "${leg.method}" está repetida en el detalle mixto.`;
    }
    seen.add(leg.method);
    const amount = Number(leg.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return `El monto para "${leg.method}" debe ser mayor a 0.`;
    }
    sum += amount;
  }
  if (Math.abs(sum - Number(total)) > 0.5) {
    return `La suma de los montos del pago mixto ($${sum}) no coincide con el total de la venta ($${total}).`;
  }
  return null;
}

// Normaliza el detalle a guardar en la BD: solo method/amount/transferencia_verificada.
function normalizePaymentBreakdown(breakdown) {
  return breakdown.map((leg) => ({
    method: leg.method,
    amount: Number(leg.amount),
    transferencia_verificada: leg.method === 'transferencia' ? !!leg.transferencia_verificada : undefined,
  }));
}

// Totales por forma de pago en [desde, hasta], considerando tanto ventas con
// un solo método como las líneas de ventas con pago mixto (payment_method='mixto').
async function totalesPorFormaPago(pool, desde, hasta) {
  const result = await pool.query(
    `SELECT method, COALESCE(SUM(amount), 0) as total FROM (
       SELECT payment_method AS method, total AS amount
       FROM sales
       WHERE deleted_at IS NULL AND status = 'completado' AND payment_method IS NOT NULL
         AND payment_method != 'mixto' AND created_at >= $1 AND created_at <= $2
       UNION ALL
       SELECT leg->>'method' AS method, (leg->>'amount')::numeric AS amount
       FROM sales, json_array_elements(payment_breakdown) AS leg
       WHERE deleted_at IS NULL AND status = 'completado' AND payment_method = 'mixto'
         AND created_at >= $1 AND created_at <= $2
     ) combined
     GROUP BY method`,
    [desde, hasta]
  );

  const totales = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, 0]));
  for (const row of result.rows) {
    if (row.method in totales) totales[row.method] = parseFloat(row.total);
  }
  return totales;
}

// SQL para filtrar ventas que incluyan una forma de pago dada, sea como pago
// único o como una de las líneas de un pago mixto. Agrega el parámetro al final.
function formaPagoCondition(params, metodo) {
  params.push(metodo);
  const idx = params.length;
  return `(s.payment_method = $${idx} OR (s.payment_method = 'mixto' AND EXISTS (
    SELECT 1 FROM json_array_elements(s.payment_breakdown) leg WHERE leg->>'method' = $${idx}
  )))`;
}

// true si la venta tiene alguna línea de transferencia sin verificar (pago único
// o mixto) — usado para no pagar comisión hasta confirmar el pago recibido.
function tieneTransferenciaSinVerificar(sale) {
  if (sale.payment_method === 'transferencia') return !sale.transferencia_verificada;
  if (sale.payment_method === 'mixto' && Array.isArray(sale.payment_breakdown)) {
    return sale.payment_breakdown.some((leg) => leg.method === 'transferencia' && !leg.transferencia_verificada);
  }
  return false;
}

module.exports = {
  PAYMENT_METHODS,
  validatePaymentBreakdown,
  normalizePaymentBreakdown,
  totalesPorFormaPago,
  formaPagoCondition,
  tieneTransferenciaSinVerificar,
};
