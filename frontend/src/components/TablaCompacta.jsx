import Badge from './Badge';
import { DELIVERY_STATUS_LABELS, deliveryStatusLabel } from '../utils/labels';
import { formatCurrency } from '../utils/format';

// Vista compacta de una lista de órdenes: cliente, vendedor, producto y día/mes, nada más.
// En computador el producto va cortado a 15 caracteres; en teléfono cada orden ocupa dos líneas y
// el título del producto usa todo el espacio libre (estilos en .tabla-compacta, globals.css).

function productoCompacto(row) {
  const items = Array.isArray(row.items) ? row.items : [];
  const largo = String((items.length > 0 ? items[0].product_name : row.product_name) || '').trim();
  if (!largo) return { largo: '-', corto: '-', extra: 0 };
  const corto = largo.length > 15 ? `${largo.slice(0, 15).trimEnd()}...` : largo;
  return { largo, corto, extra: Math.max(items.length - 1, 0) };
}

function hora(value) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function diaMes(value) {
  if (!value) return '-';
  const d = new Date(value);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// rows: cualquier lista con client_name, vendor_name, created_at y (items o product_name).
// conEstado: agrega el estado del envío (Delivery Santiago) entre el producto y la fecha.
// conTotal: agrega el total de la venta y muestra la hora en vez del día/mes (ventas de caja de hoy).
export default function TablaCompacta({ rows, vacio = 'Sin registros', conEstado = false, conTotal = false }) {
  const columnaExtra = conEstado || conTotal;
  const columnas = columnaExtra ? 5 : 4;
  return (
    <table className={`tabla-compacta${columnaExtra ? ' tabla-compacta--estado' : ''}`}>
      <thead>
        <tr>
          <th>Cliente</th>
          <th>Vendedor</th>
          <th>Producto</th>
          {conEstado && <th>Estado</th>}
          {conTotal && <th>Total</th>}
          <th>{conTotal ? 'Hora' : 'Fecha'}</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columnas} style={{ color: 'var(--color-text-muted)' }}>{vacio}</td>
          </tr>
        ) : (
          rows.map((r) => {
            const p = productoCompacto(r);
            const detalle = Array.isArray(r.items) && r.items.length > 0
              ? r.items.map((i) => `${i.product_name} x${i.quantity}`).join(', ')
              : r.product_name;
            return (
              <tr key={r.id}>
                <td data-label="Cliente">{r.client_name}</td>
                <td data-label="Vendedor">{r.vendor_name}</td>
                <td data-label="Producto" title={detalle}>
                  <span className="pc-corto">{p.corto}</span>
                  <span className="pc-largo">{p.largo}</span>
                  {p.extra > 0 && <span className="pc-extra">+{p.extra}</span>}
                </td>
                {conEstado && (
                  <td data-label="Estado">
                    <Badge label={deliveryStatusLabel(r.delivery_status)} color={DELIVERY_STATUS_LABELS[r.delivery_status]?.color} />
                  </td>
                )}
                {conTotal && <td data-label="Total" style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{formatCurrency(r.total)}</td>}
                <td data-label={conTotal ? 'Hora' : 'Fecha'} style={{ whiteSpace: 'nowrap' }}>{conTotal ? hora(r.created_at) : diaMes(r.created_at)}</td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
