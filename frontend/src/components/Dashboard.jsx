import MetricsCard from './MetricsCard';
import Badge from './Badge';
import SalesTrendChart from './SalesTrendChart';
import { formatCurrency, formatDate } from '../utils/format';
import { SALE_STATUS_LABELS, saleStatusLabel, deliveryStatusLabel } from '../utils/labels';

function ComparisonCard({ comparison, period, onPeriodChange }) {
  if (!comparison) return null;
  const up = comparison.variacion_pct >= 0;
  const label = period === 'month' ? 'mes anterior' : 'semana anterior';
  return (
    <div className="card" style={{ padding: 20, flex: '1 1 220px', minWidth: 200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Ventas vs. {label}</div>
        {onPeriodChange && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              onClick={() => onPeriodChange('week')}
              style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, border: '1px solid var(--color-border)', background: period === 'week' ? 'var(--color-accent)' : 'transparent', color: period === 'week' ? '#fff' : 'var(--color-text-muted)', cursor: 'pointer' }}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => onPeriodChange('month')}
              style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, border: '1px solid var(--color-border)', background: period === 'month' ? 'var(--color-accent)' : 'transparent', color: period === 'month' ? '#fff' : 'var(--color-text-muted)', cursor: 'pointer' }}
            >
              Mes
            </button>
          </div>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--color-text)' }}>{formatCurrency(comparison.semana_actual.total)}</div>
      <div style={{ fontSize: 12, marginTop: 6, color: up ? 'var(--color-success)' : 'var(--color-danger)' }}>
        {up ? '+' : ''}{comparison.variacion_pct}% vs {formatCurrency(comparison.semana_anterior.total)}
      </div>
    </div>
  );
}

function VendedorDashboard({ data, comparison, period, onPeriodChange }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
        <MetricsCard label="Ventas hoy" value={data.ventas_hoy.cantidad} />
        <ComparisonCard comparison={comparison} period={period} onPeriodChange={onPeriodChange} />
      </div>

      <SalesTrendChart data={data.tendencia_14_dias} />

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Últimas ventas</h3>
        <table className="responsive-stack">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {data.ultimas_ventas.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: 'var(--color-text-muted)' }}>Sin ventas registradas</td>
              </tr>
            ) : (
              data.ultimas_ventas.map((s) => (
                <tr key={s.id}>
                  <td data-label="Producto">{s.product_name}</td>
                  <td data-label="Cliente">{s.client_name}</td>
                  <td data-label="Total">{formatCurrency(s.total)}</td>
                  <td data-label="Estado"><Badge label={saleStatusLabel(s.status)} color={SALE_STATUS_LABELS[s.status]?.color} /></td>
                  <td data-label="Fecha">{formatDate(s.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function VentasPosSection({ ventasPos }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Ventas POS (tienda)</h3>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <MetricsCard label="Ventas hoy" value={ventasPos.cantidad} />
        <MetricsCard label="Monto generado hoy" value={formatCurrency(ventasPos.total)} />
      </div>
    </div>
  );
}

function EnviosPorEstadoSection({ rows }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Envíos por estado</h3>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {rows.map((e) => (
          <MetricsCard key={e.estado} label={deliveryStatusLabel(e.estado)} value={e.cantidad} />
        ))}
      </div>
    </div>
  );
}

function OperadorDashboard({ data, comparison, period, onPeriodChange }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
        <MetricsCard label="Ventas hoy" value={data.ventas_hoy.cantidad} />
        <MetricsCard label="Monto generado hoy" value={formatCurrency(data.ventas_hoy.total)} />
        <MetricsCard label="Entregas pendientes" value={data.entregas_pendientes} />
        <MetricsCard label="Ventas entregadas (ayer)" value={data.ventas_entregadas_ayer} />
        {data.efectivo_caja !== null && data.efectivo_caja !== undefined && (
          <MetricsCard label="Efectivo en caja" value={formatCurrency(data.efectivo_caja)} />
        )}
        <ComparisonCard comparison={comparison} period={period} onPeriodChange={onPeriodChange} />
      </div>

      <SalesTrendChart data={data.tendencia_14_dias} />

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Top productos del mes</h3>
        <table className="responsive-stack">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.top_productos.map((p) => (
              <tr key={p.nombre}>
                <td data-label="Producto">{p.nombre}</td>
                <td data-label="Cantidad">{p.cantidad}</td>
                <td data-label="Total">{formatCurrency(p.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <VentasPosSection ventasPos={data.ventas_pos} />
      <EnviosPorEstadoSection rows={data.estado_ordenes} />
    </>
  );
}

function AdminDashboard({ data, comparison, period, onPeriodChange }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
        <MetricsCard label="Ventas hoy" value={data.ventas_hoy.cantidad} />
        <MetricsCard label="Monto generado hoy" value={formatCurrency(data.ventas_hoy.total)} />
        <MetricsCard label="Ventas del mes" value={formatCurrency(data.ventas_mes.total)} />
        <MetricsCard label="Entregas pendientes" value={data.entregas_pendientes} />
        <MetricsCard label="Ventas entregadas (ayer)" value={data.ventas_entregadas_ayer} />
        {data.efectivo_caja !== null && data.efectivo_caja !== undefined && (
          <MetricsCard label="Efectivo en caja" value={formatCurrency(data.efectivo_caja)} />
        )}
        <ComparisonCard comparison={comparison} period={period} onPeriodChange={onPeriodChange} />
      </div>

      <SalesTrendChart data={data.tendencia_14_dias} />

      <VentasPosSection ventasPos={data.ventas_pos} />
      <EnviosPorEstadoSection rows={data.estado_ordenes} />
    </>
  );
}

export default function Dashboard({ data, comparison, period, onPeriodChange }) {
  if (data.role === 'vendedor') return <VendedorDashboard data={data} comparison={comparison} period={period} onPeriodChange={onPeriodChange} />;
  if (data.role === 'operador') return <OperadorDashboard data={data} comparison={comparison} period={period} onPeriodChange={onPeriodChange} />;
  return <AdminDashboard data={data} comparison={comparison} period={period} onPeriodChange={onPeriodChange} />;
}
