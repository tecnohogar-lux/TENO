// Los formateadores Intl se crean UNA sola vez. Construir uno cuesta mucho (y mucho más en Safari de iPhone):
// una tabla con cientos de filas llama a estas funciones miles de veces, y crearlos en cada llamada la dejaba lentísima.
const formatoMoneda = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

const formatoFecha = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const formatoHora = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatCurrency(value) {
  const number = Number(value) || 0;
  return formatoMoneda.format(number);
}

export function formatDate(value) {
  if (!value) return '-';
  return formatoFecha.format(new Date(value));
}

// Solo la hora (24 h), por ejemplo "14:35".
export function formatHora(value) {
  if (!value) return '-';
  return formatoHora.format(new Date(value));
}
