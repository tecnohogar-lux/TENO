import { Link } from 'react-router-dom';
import MetricsCard from './MetricsCard';
import useIsMobile from '../hooks/useIsMobile';
import Badge from './Badge';
import SalesTrendChart from './SalesTrendChart';
import { formatCurrency, formatDate } from '../utils/format';
import { SALE_STATUS_LABELS, DELIVERY_STATUS_LABELS, saleStatusLabel, deliveryStatusLabel, isSinCobro } from '../utils/labels';

// Desglose del "Monto generado hoy": de dónde salió el dinero del día.
function montoHoySubtext(ventasHoy) {
  const d = ventasHoy.desglose;
  if (!d) return undefined;
  return `Caja ${formatCurrency(d.caja)} · Ingresos ${formatCurrency(d.ingresos)} · Entregas ${formatCurrency(d.entregas)}`;
}

function ComparisonCard({ comparison, period, onPeriodChange }) {
  if (!comparison) return null;
  const up = comparison.variacion_pct >= 0;
  const label = period === 'month' ? 'mes anterior' : 'semana anterior';
  return (
    <div className="card comparison-card">
      <div className="comparison-card__head">
        <div className="comparison-card__label">Ventas vs. {label}</div>
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
      <div className="comparison-card__value">{formatCurrency(comparison.semana_actual.total)}</div>
      <div className="comparison-card__delta" style={{ color: up ? 'var(--color-success)' : 'var(--color-danger)' }}>
        {up ? '+' : ''}{comparison.variacion_pct}% vs {formatCurrency(comparison.semana_anterior.total)}
      </div>
    </div>
  );
}

// En teléfono se muestran las 5 últimas ventas (cada una ocupa un bloque compacto) y un enlace al resto.
const ULTIMAS_VENTAS_MOVIL = 5;

function VendedorDashboard({ data, comparison, period, onPeriodChange }) {
  const movil = useIsMobile();
  const ventas = movil ? data.ultimas_ventas.slice(0, ULTIMAS_VENTAS_MOVIL) : data.ultimas_ventas;
  return (
    <>
      <div className="dash-metricas">
        <MetricsCard fila label="Ventas hoy" value={data.ventas_hoy.cantidad} />
        <ComparisonCard comparison={comparison} period={period} onPeriodChange={onPeriodChange} />
      </div>

      <SalesTrendChart data={data.tendencia_14_dias} />

      <div className="card dash-tabla">
        <h3 className="dash-seccion__titulo">Últimas ventas</h3>
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
            {ventas.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: 'var(--color-text-muted)' }}>Sin ventas registradas</td>
              </tr>
            ) : (
              ventas.map((s) => (
                <tr key={s.id}>
                  <td data-label="Producto">{s.product_name}</td>
                  <td data-label="Cliente">{s.client_name}</td>
                  <td data-label="Total">{isSinCobro(s) ? '—' : formatCurrency(s.total)}</td>
                  <td data-label="Estado"><Badge label={saleStatusLabel(s.status)} color={SALE_STATUS_LABELS[s.status]?.color} /></td>
                  <td data-label="Fecha">{formatDate(s.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {movil && data.ultimas_ventas.length > ULTIMAS_VENTAS_MOVIL && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Link to="/sales" className="btn btn-secondary">Ver todas</Link>
          </div>
        )}
      </div>
    </>
  );
}

function VentasPosSection({ ventasPos }) {
  return (
    <div className="dash-seccion">
      <h3 className="dash-seccion__titulo">Ventas POS (tienda)</h3>
      <div className="dash-metricas dash-metricas--seccion">
        <MetricsCard label="Ventas hoy" value={ventasPos.cantidad} />
        <MetricsCard label="Monto generado hoy" value={formatCurrency(ventasPos.total)} />
      </div>
    </div>
  );
}

// Solo estados reales del paquete: "solo envío", "solo entrega" y "cambio de producto" son tipos de envío y
// nunca son un estado (aparecían siempre en cero y sin nombre).
function EnviosPorEstadoSection({ rows }) {
  const estados = rows.filter((e) => DELIVERY_STATUS_LABELS[e.estado]);
  return (
    <div className="dash-seccion">
      <h3 className="dash-seccion__titulo">Envíos por estado</h3>
      <div className="dash-metricas dash-metricas--estados dash-metricas--seccion">
        {estados.map((e) => (
          <MetricsCard key={e.estado} label={deliveryStatusLabel(e.estado)} value={e.cantidad} />
        ))}
      </div>
    </div>
  );
}

function OperadorDashboard({ data, comparison, period, onPeriodChange }) {
  const hayEfectivo = data.efectivo_caja !== null && data.efectivo_caja !== undefined;
  return (
    <>
      <div className="dash-metricas">
        <MetricsCard label="Ventas hoy" value={data.ventas_hoy.cantidad} />
        <MetricsCard ancho label="Monto generado hoy" value={formatCurrency(data.ventas_hoy.total)} subtext={montoHoySubtext(data.ventas_hoy)} />
        <MetricsCard label="Entregas pendientes" value={data.entregas_pendientes} />
        <MetricsCard fila={!hayEfectivo} label="Ventas entregadas (ayer)" value={data.ventas_entregadas_ayer} />
        {hayEfectivo && <MetricsCard label="Efectivo en caja" value={formatCurrency(data.efectivo_caja)} />}
        <ComparisonCard comparison={comparison} period={period} onPeriodChange={onPeriodChange} />
      </div>

      <SalesTrendChart data={data.tendencia_14_dias} />

      <div className="card dash-tabla">
        <h3 className="dash-seccion__titulo">Top productos del mes</h3>
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
      <div className="dash-metricas">
        <MetricsCard label="Ventas hoy" value={data.ventas_hoy.cantidad} />
        <MetricsCard ancho label="Monto generado hoy" value={formatCurrency(data.ventas_hoy.total)} subtext={montoHoySubtext(data.ventas_hoy)} />
        <MetricsCard label="Ventas del mes" value={formatCurrency(data.ventas_mes.total)} />
        <MetricsCard label="Entregas pendientes" value={data.entregas_pendientes} />
        <MetricsCard label="Ventas entregadas (ayer)" value={data.ventas_entregadas_ayer} />
        {data.efectivo_caja !== null && data.efectivo_caja !== undefined && (
          <MetricsCard fila label="Efectivo en caja" value={formatCurrency(data.efectivo_caja)} />
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
