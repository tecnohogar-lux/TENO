import useFetch from '../hooks/useFetch';
import { PAYMENT_METHODS, paymentMethodLabel, DELIVERY_TYPE_OPTIONS, deliveryTypeLabel } from '../utils/labels';

// Filtros compartidos por Historial de Ventas y Delivery Santiago. Se mandan al servidor
// (los valores vacíos no se envían), así que listado, resumen y paginación van de acuerdo.
export const EMPTY_FILTERS = {
  canal: '', vendedor_id: '', operador_id: '', cliente: '', desde: '', hasta: '', forma_pago: '', tipo_envio: '', courier_id: '',
};

export const CANAL_OPTIONS = [
  { value: 'envio', label: 'Delivery Santiago' },
  { value: 'retiro', label: 'Retiro en tienda' },
  { value: 'directa', label: 'Venta directa en caja' },
  { value: 'region', label: 'Envío a regiones' },
  { value: 'prepagado', label: 'Envío prepagado' },
];

export function filtersToQuery(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  return params.toString();
}

export function countActiveFilters(filters) {
  return Object.values(filters).filter(Boolean).length;
}

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' };

function Field({ label, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

// `fields`: qué filtros mostrar (según el módulo y el rol).
export default function SalesFilters({ filters, onChange, fields, canManage }) {
  const { data: usersData } = useFetch('/api/users', { enabled: canManage && (fields.includes('vendedor_id') || fields.includes('operador_id')) });
  const { data: couriersData } = useFetch('/api/couriers', { enabled: canManage && fields.includes('courier_id') });

  const users = usersData?.users || [];
  const vendedores = users.filter((u) => u.role === 'vendedor');
  const operadores = users.filter((u) => ['admin', 'operador', 'caja'].includes(u.role));

  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value });
  const show = (key) => fields.includes(key);

  return (
    <div className="card" style={{ padding: 16, marginBottom: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
        {show('canal') && (
          <Field label="Tipo de venta">
            <select value={filters.canal} onChange={set('canal')}>
              <option value="">Todos</option>
              {CANAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        )}
        {show('vendedor_id') && (
          <Field label="Vendedor">
            <select value={filters.vendedor_id} onChange={set('vendedor_id')}>
              <option value="">Todos</option>
              {vendedores.map((u) => <option key={u.id} value={u.id}>{u.name}{u.is_active ? '' : ' (inactivo)'}</option>)}
            </select>
          </Field>
        )}
        {show('operador_id') && (
          <Field label="Operador (registró)">
            <select value={filters.operador_id} onChange={set('operador_id')}>
              <option value="">Todos</option>
              {operadores.map((u) => <option key={u.id} value={u.id}>{u.name}{u.is_active ? '' : ' (inactivo)'}</option>)}
            </select>
          </Field>
        )}
        {show('cliente') && (
          <Field label="Cliente">
            <input placeholder="Nombre del cliente" value={filters.cliente} onChange={set('cliente')} />
          </Field>
        )}
        {show('desde') && (
          <Field label="Desde">
            <input type="date" value={filters.desde} max={filters.hasta || undefined} onChange={set('desde')} />
          </Field>
        )}
        {show('hasta') && (
          <Field label="Hasta">
            <input type="date" value={filters.hasta} min={filters.desde || undefined} onChange={set('hasta')} />
          </Field>
        )}
        {show('forma_pago') && (
          <Field label="Tipo de pago">
            <select value={filters.forma_pago} onChange={set('forma_pago')}>
              <option value="">Todos</option>
              {[...PAYMENT_METHODS, 'mixto'].map((m) => <option key={m} value={m}>{paymentMethodLabel(m)}</option>)}
            </select>
          </Field>
        )}
        {show('tipo_envio') && (
          <Field label="Tipo de envío">
            <select value={filters.tipo_envio} onChange={set('tipo_envio')}>
              <option value="">Todos</option>
              {DELIVERY_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{deliveryTypeLabel(t)}</option>)}
            </select>
          </Field>
        )}
        {show('courier_id') && (
          <Field label="Courier">
            <select value={filters.courier_id} onChange={set('courier_id')}>
              <option value="">Todos</option>
              {(couriersData?.couriers || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        <div>
          <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => onChange(EMPTY_FILTERS)} disabled={countActiveFilters(filters) === 0}>
            Limpiar filtros
          </button>
        </div>
      </div>
    </div>
  );
}
