// Recepción de Pagos: textos, colores y fechas.

export const TIPO_CUENTA = {
  por_pagar: { label: 'Debemos pagar', corto: 'Por pagar', color: '#b3423a', soft: 'rgba(179, 66, 58, 0.12)', accion: 'Registrar pago' },
  por_cobrar: { label: 'Nos deben', corto: 'Por cobrar', color: '#2f8a5b', soft: 'rgba(47, 138, 91, 0.12)', accion: 'Registrar pago recibido' },
};

export const ESTADO_CUENTA = {
  pendiente: { label: 'Pendiente', color: '#6f6b62' },
  parcial: { label: 'Pago parcial', color: '#b98a2e' },
  pagada: { label: 'Pagada', color: '#4c7a52' },
  anulada: { label: 'Anulada', color: '#8a8fa3' },
};

// Filtros rápidos por estado (el valor viaja tal cual al servidor; '' = todas menos las anuladas).
export const ESTADO_FILTROS = [
  { value: 'abiertas', label: 'Abiertas' },
  { value: 'vencida', label: 'Vencidas' },
  { value: 'pagada', label: 'Pagadas' },
  { value: '', label: 'Todas' },
  { value: 'anulada', label: 'Anuladas' },
];

// "YYYY-MM-DD" -> "dd/mm/aaaa" sin pasar por Date (evita el desfase de zona horaria).
export function fechaCorta(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

// "YYYY-MM-DD" -> "dd/mm"
export function diaMes(iso) {
  if (!iso) return '';
  const [, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}`;
}

export function rangoPeriodo(desde, hasta) {
  if (!desde || !hasta) return '';
  return `${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
}

// Fecha de hoy (calendario local del usuario) como YYYY-MM-DD, para los campos de fecha.
export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
