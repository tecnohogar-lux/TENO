import { useMemo } from 'react';
import Badge from './Badge';
import TablaCompacta from './TablaCompacta';
import VistaToggle from './VistaToggle';
import useFetch from '../hooks/useFetch';
import useVistaCompacta from '../hooks/useVistaCompacta';
import { formatCurrency } from '../utils/format';
import { PAYMENT_METHODS, paymentBreakdownLines, paymentMethodLabel } from '../utils/labels';

function hora(value) {
  return new Date(value).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function tipoVenta(v) {
  if (v.tipo_venta === 'ENVIO_PREPAGADO') return { label: 'Envío prepagado', color: '#2f6fb0' };
  if (v.retiro_id) return { label: 'Retiro en tienda', color: '#7c4fb0' };
  return { label: 'Tienda', color: '#2f8a5b' };
}

function productos(v) {
  if (Array.isArray(v.items) && v.items.length > 0) return v.items.map((i) => `${i.product_name} x${i.quantity}`).join(', ');
  return `${v.product_name}${v.quantity > 1 ? ` x${v.quantity}` : ''}`;
}

function pagoTexto(v) {
  if (v.payment_method === 'mixto') return paymentBreakdownLines(v).map((l) => `${paymentMethodLabel(l.method)} ${formatCurrency(l.amount)}`).join(' + ');
  return paymentMethodLabel(v.payment_method);
}

// Ventas registradas en Caja durante el día en curso (tienda, retiros cobrados y envíos prepagados).
// Los deliveries no pasan por caja y no aparecen aquí. `refreshKey` cambia cada vez que se registra una venta.
export default function VentasCajaHoy({ refreshKey = 0 }) {
  const { data, loading, error } = useFetch(`/api/caja/ventas-hoy?r=${refreshKey}`, { deps: [refreshKey] });
  const [compacta, cambiarVista] = useVistaCompacta('teno_caja_vista');
  const ventas = data?.ventas || [];

  // Cuánto entró hoy por cada forma de pago (el pago mixto aporta a cada una su parte).
  const porPago = useMemo(() => {
    const totales = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, 0]));
    for (const v of ventas) {
      if (v.payment_method === 'mixto') paymentBreakdownLines(v).forEach((l) => { if (l.method in totales) totales[l.method] += Number(l.amount); });
      else if (v.payment_method in totales) totales[v.payment_method] += Number(v.total);
    }
    return totales;
  }, [ventas]);

  return (
    <section style={{ marginTop: 28 }} aria-label="Ventas de caja de hoy">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>Ventas de hoy en caja</h3>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {data ? `${ventas.length} venta(s) · ${formatCurrency(data.total)}` : 'Cargando...'}
          </div>
        </div>
        <VistaToggle compacta={compacta} onChange={cambiarVista} />
      </div>

      {data && ventas.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {PAYMENT_METHODS.filter((m) => porPago[m] > 0).map((m) => (
            <span key={m} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
              {paymentMethodLabel(m)} <strong>{formatCurrency(porPago[m])}</strong>
            </span>
          ))}
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {loading && !data && <div className="page-loading"><div className="spinner" /></div>}

      {data && compacta && (
        <div className="card" style={{ padding: 20 }}>
          <TablaCompacta rows={ventas} vacio="Todavía no hay ventas en caja hoy" conTotal />
        </div>
      )}

      {data && !compacta && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="responsive-stack">
              <thead>
                <tr>
                  <th>N°</th><th>Hora</th><th>Cliente</th><th>Vendedor</th><th>Productos</th><th>Tipo</th><th>Total</th><th>Pago</th><th>Registró</th>
                </tr>
              </thead>
              <tbody>
                {ventas.length === 0 ? (
                  <tr><td colSpan={9} style={{ color: 'var(--color-text-muted)' }}>Todavía no hay ventas en caja hoy</td></tr>
                ) : ventas.map((v) => {
                  const t = tipoVenta(v);
                  return (
                    <tr key={v.id}>
                      <td data-label="N°" style={{ whiteSpace: 'nowrap' }}>#{v.id}</td>
                      <td data-label="Hora" style={{ whiteSpace: 'nowrap' }}>{hora(v.created_at)}</td>
                      <td data-label="Cliente">{v.client_name}</td>
                      <td data-label="Vendedor">{v.vendor_name}</td>
                      <td data-label="Productos" style={{ fontSize: 13 }}>{productos(v)}</td>
                      <td data-label="Tipo"><Badge label={t.label} color={t.color} /></td>
                      <td data-label="Total" style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{formatCurrency(v.total)}</td>
                      <td data-label="Pago" style={{ fontSize: 13 }}>
                        {pagoTexto(v)}
                        {v.payment_method === 'transferencia' && !v.transferencia_verificada && (
                          <div style={{ fontSize: 11, color: 'var(--color-warning)' }}>Transferencia sin verificar</div>
                        )}
                      </td>
                      <td data-label="Registró" style={{ fontSize: 13 }}>{v.registered_by_name || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
