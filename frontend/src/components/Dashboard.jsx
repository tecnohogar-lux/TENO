import MetricsCard from './MetricsCard';
import Badge from './Badge';
import { formatCurrency, formatDate } from '../utils/format';
import { SALE_STATUS_LABELS, saleStatusLabel, deliveryStatusLabel } from '../utils/labels';

function ComparisonCard({ comparison }) {
  if (!comparison) return null;
  const up = comparison.variacion_pct >= 0;
  return (
    <div className="card" style={{ padding: 20, flex: '1 1 200px', minWidth: 180 }}>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>Ventas vs. mes anterior</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--color-text)' }}>{formatCurrency(comparison.mes_actual.total)}</div>
      <div style={{ fontSize: 12, marginTop: 6, color: up ? 'var(--color-success)' : 'var(--color-danger)' }}>
        {up ? '+' : ''}{comparison.variacion_pct}% vs {formatCurrency(comparison.mes_anterior.total)}
      </div>
    </div>
  );
}

function VendedorDashboard({ data, comparison }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
        <MetricsCard label="Ventas hoy" value={data.ventas_hoy.cantidad} />
        <MetricsCard label="Monto generado hoy" value={formatCurrency(data.ventas_hoy.total)} />
        <MetricsCard label="Clientes activos" value={data.clientes_unicos} />
        <ComparisonCard comparison={comparison} />
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Últimas ventas</h3>
        <table>
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
                  <td>{s.product_name}</td>
                  <td>{s.client_name}</td>
                  <td>{formatCurrency(s.total)}</td>
                  <td><Badge label={saleStatusLabel(s.status)} color={SALE_STATUS_LABELS[s.status]?.color} /></td>
                  <td>{formatDate(s.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function OrderStatusTable({ title, rows }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>{title}</h3>
      <table>
        <thead>
          <tr>
            <th>Estado</th>
            <th>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={2} style={{ color: 'var(--color-text-muted)' }}>Sin datos</td>
            </tr>
          ) : (
            rows.map((e) => (
              <tr key={e.estado}>
                <td>{deliveryStatusLabel(e.estado)}</td>
                <td>{e.cantidad}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function OperadorDashboard({ data, comparison }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
        <MetricsCard label="Ventas hoy" value={data.ventas_hoy.cantidad} />
        <MetricsCard label="Monto generado hoy" value={formatCurrency(data.ventas_hoy.total)} />
        <MetricsCard label="Clientes activos" value={data.total_clientes} />
        <MetricsCard label="Entregas pendientes" value={data.entregas_pendientes} />
        <ComparisonCard comparison={comparison} />
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
        <div className="card" style={{ padding: 20, flex: '1 1 320px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Vendedores activos</h3>
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Ventas hoy</th>
                <th>Total hoy</th>
              </tr>
            </thead>
            <tbody>
              {data.vendedores_activos.map((v) => (
                <tr key={v.id}>
                  <td>{v.nombre}</td>
                  <td>{v.ventas_hoy}</td>
                  <td>{formatCurrency(v.total_hoy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ padding: 20, flex: '1 1 320px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Top productos del mes</h3>
          <table>
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
                  <td>{p.nombre}</td>
                  <td>{p.cantidad}</td>
                  <td>{formatCurrency(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <OrderStatusTable title="Estado de órdenes (mes)" rows={data.estado_ordenes} />
    </>
  );
}

function AdminDashboard({ data, comparison }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
        <MetricsCard label="Ventas hoy" value={data.ventas_hoy.cantidad} />
        <MetricsCard label="Monto generado hoy" value={formatCurrency(data.ventas_hoy.total)} />
        <MetricsCard label="Clientes activos" value={data.clientes_totales} />
        <MetricsCard label="Ventas del mes" value={formatCurrency(data.ventas_mes.total)} />
        <MetricsCard label="Entregas pendientes" value={data.entregas_pendientes} />
        <MetricsCard label="Vendedores" value={data.usuarios.total_vendedores} />
        <MetricsCard label="Operadores" value={data.usuarios.total_operadores} />
        <ComparisonCard comparison={comparison} />
      </div>

      <OrderStatusTable title="Estado de órdenes (mes)" rows={data.estado_ordenes} />
    </>
  );
}

export default function Dashboard({ data, comparison }) {
  if (data.role === 'vendedor') return <VendedorDashboard data={data} comparison={comparison} />;
  if (data.role === 'operador') return <OperadorDashboard data={data} comparison={comparison} />;
  return <AdminDashboard data={data} comparison={comparison} />;
}
