import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import MetricsCard from '../components/MetricsCard';
import Pagination from '../components/Pagination';
import Badge from '../components/Badge';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import { formatCurrency, formatDate } from '../utils/format';
import { saleStatusLabel, deliveryStatusLabel, tipoVentaLabel, paymentMethodLabel, TIPO_VENTA_LABELS } from '../utils/labels';

const emptyFilters = { order_id: '', cliente: '', vendedor: '', fecha: '', producto: '', estado: '', forma_pago: '' };

function buildQuery(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  return params.toString();
}

export default function CashRegisterPage() {
  const { data: currentData, loading: loadingCurrent, error: errorCurrent, refetch: refetchCurrent } = useFetch('/api/cash-register/current');
  const { post, loading: opening, error: openError } = useApi();
  const { post: closePost, loading: closing, error: closeError } = useApi();

  const [saldoInicial, setSaldoInicial] = useState('');
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [efectivoContado, setEfectivoContado] = useState('');
  const [notas, setNotas] = useState('');
  const [closedResult, setClosedResult] = useState(null);

  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);

  const caja = currentData?.caja || null;
  const detailQuery = caja ? `/api/cash-register/${caja.id}?${buildQuery(appliedFilters)}` : null;
  const { data: detailData, loading: loadingDetail, refetch: refetchDetail } = useFetch(detailQuery || '/api/cash-register/current', {
    enabled: !!detailQuery,
    deps: [caja?.id, appliedFilters],
  });

  const [historyPage, setHistoryPage] = useState(1);
  const { data: historyData, refetch: refetchHistory } = useFetch(`/api/cash-register/history?page=${historyPage}&limit=10`, { deps: [historyPage] });

  async function handleOpen(e) {
    e.preventDefault();
    const result = await post('/api/cash-register/open', { saldo_inicial: saldoInicial || 0 });
    if (result.success) {
      setSaldoInicial('');
      refetchCurrent();
    }
  }

  async function handleClose(e) {
    e.preventDefault();
    const result = await closePost(`/api/cash-register/${caja.id}/close`, { efectivo_contado: efectivoContado, notas });
    if (result.success) {
      setClosedResult(result.data.caja);
      setShowCloseForm(false);
      setEfectivoContado('');
      setNotas('');
      refetchCurrent();
      refetchHistory();
    }
  }

  function applyFilters(e) {
    e.preventDefault();
    setAppliedFilters(filters);
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  }

  return (
    <Layout>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Cierre de Caja</h1>
      <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 24 }}>
        Una sola caja global por día. Cualquier Operador o Admin puede abrirla y cerrarla.
      </p>

      {closedResult && (
        <div className="card" style={{ padding: 20, marginBottom: 24, borderLeft: '4px solid var(--color-success)' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Caja cerrada correctamente</h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <MetricsCard label="Saldo real" value={formatCurrency(closedResult.saldo_real)} />
            <MetricsCard label="Efectivo contado" value={formatCurrency(closedResult.efectivo_contado)} />
            <MetricsCard
              label="Diferencia"
              value={formatCurrency(closedResult.diferencia)}
              subtext={Number(closedResult.diferencia) === 0 ? 'Cuadra exacto' : (Number(closedResult.diferencia) > 0 ? 'Sobra efectivo' : 'Falta efectivo')}
            />
          </div>
        </div>
      )}

      {loadingCurrent && (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      )}
      {errorCurrent && <div className="alert alert-error">{errorCurrent}</div>}

      {currentData && !caja && (
        <div className="card" style={{ padding: 20, maxWidth: 420, marginBottom: 32 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>No hay una caja abierta</h3>
          {openError && <div className="alert alert-error">{openError}</div>}
          <form onSubmit={handleOpen}>
            <div className="form-field">
              <label>Saldo inicial</label>
              <input type="number" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} placeholder="0" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={opening} style={{ marginTop: 8 }}>
              {opening ? 'Abriendo...' : 'Abrir caja'}
            </button>
          </form>
        </div>
      )}

      {caja && (
        <>
          <div className="card" style={{ padding: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Caja abierta</h3>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  Apertura: {formatDate(caja.opened_at)} · Responsable: {caja.opened_by_name || '-'}
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => setShowCloseForm((v) => !v)}>
                {showCloseForm ? 'Cancelar' : 'Cerrar caja'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 20 }}>
              <MetricsCard label="Saldo inicial" value={formatCurrency(caja.saldo_inicial)} />
              <MetricsCard label="Total vendido" value={formatCurrency(caja.total_vendido)} />
              <MetricsCard label="Total gastos" value={formatCurrency(caja.total_gastos)} />
              <MetricsCard label="Saldo real (efectivo esperado)" value={formatCurrency(caja.saldo_real)} />
            </div>

            {showCloseForm && (
              <form onSubmit={handleClose} className="card" style={{ padding: 16, marginTop: 20, background: 'var(--color-bg)' }}>
                {closeError && <div className="alert alert-error">{closeError}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16 }}>
                  <div className="form-field">
                    <label>Efectivo contado</label>
                    <input type="number" value={efectivoContado} onChange={(e) => setEfectivoContado(e.target.value)} required />
                  </div>
                  <div className="form-field">
                    <label>Notas</label>
                    <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={closing} style={{ marginTop: 8 }}>
                  {closing ? 'Cerrando...' : 'Confirmar cierre'}
                </button>
              </form>
            )}
          </div>

          {detailData && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Ventas del período por canal</h3>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <MetricsCard label="Tienda" value={detailData.por_canal.tienda.cantidad} subtext={formatCurrency(detailData.por_canal.tienda.total)} />
                <MetricsCard label="Envío RM" value={detailData.por_canal.envio_rm.cantidad} subtext={formatCurrency(detailData.por_canal.envio_rm.total)} />
                <MetricsCard label="Envíos a Región" value={detailData.por_canal.envio_region.cantidad} subtext={formatCurrency(detailData.por_canal.envio_region.total)} />
              </div>

              <form onSubmit={applyFilters} className="card" style={{ padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <input placeholder="N° de pedido" value={filters.order_id} onChange={(e) => setFilters({ ...filters, order_id: e.target.value })} />
                  <input placeholder="Cliente" value={filters.cliente} onChange={(e) => setFilters({ ...filters, cliente: e.target.value })} />
                  <input placeholder="Vendedor" value={filters.vendedor} onChange={(e) => setFilters({ ...filters, vendedor: e.target.value })} />
                  <input placeholder="Producto" value={filters.producto} onChange={(e) => setFilters({ ...filters, producto: e.target.value })} />
                  <input type="date" value={filters.fecha} onChange={(e) => setFilters({ ...filters, fecha: e.target.value })} />
                  <select value={filters.forma_pago} onChange={(e) => setFilters({ ...filters, forma_pago: e.target.value })}>
                    <option value="">Forma de pago (todas)</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="link_pago">Link de pago</option>
                  </select>
                  <button type="submit" className="btn btn-primary">Filtrar</button>
                  <button type="button" className="btn btn-secondary" onClick={clearFilters}>Limpiar</button>
                </div>
              </form>

              {loadingDetail && (
                <div className="page-loading">
                  <div className="spinner" />
                </div>
              )}

              <div className="card" style={{ padding: 20 }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="responsive-stack">
                    <thead>
                      <tr>
                        <th>N°</th>
                        <th>Producto</th>
                        <th>Cliente</th>
                        <th>Vendedor</th>
                        <th>Tipo</th>
                        <th>Total</th>
                        <th>Estado</th>
                        <th>Pago</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailData.ventas.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ color: 'var(--color-text-muted)' }}>Sin ventas en este período</td>
                        </tr>
                      ) : (
                        detailData.ventas.map((s) => (
                          <tr key={s.id}>
                            <td data-label="N°">#{s.id}</td>
                            <td data-label="Producto">{s.product_name}</td>
                            <td data-label="Cliente">{s.client_name}</td>
                            <td data-label="Vendedor">{s.vendor_name}</td>
                            <td data-label="Tipo"><Badge label={tipoVentaLabel(s.tipo_venta)} color={TIPO_VENTA_LABELS[s.tipo_venta]?.color} /></td>
                            <td data-label="Total">{formatCurrency(s.total)}</td>
                            <td data-label="Estado">{s.tipo_venta === 'TIENDA' ? saleStatusLabel(s.status) : deliveryStatusLabel(s.delivery_status)}</td>
                            <td data-label="Pago">{paymentMethodLabel(s.payment_method)}</td>
                            <td data-label="Fecha">{formatDate(s.created_at)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Historial de cierres</h3>
      {historyData && (
        <div className="card" style={{ padding: 20 }}>
          <table className="responsive-stack">
            <thead>
              <tr>
                <th>Apertura</th>
                <th>Cierre</th>
                <th>Responsable</th>
                <th>Total vendido</th>
                <th>Saldo real</th>
                <th>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {historyData.cierres.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--color-text-muted)' }}>Sin cierres registrados todavía</td>
                </tr>
              ) : (
                historyData.cierres.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Apertura">{formatDate(c.opened_at)}</td>
                    <td data-label="Cierre">{formatDate(c.closed_at)}</td>
                    <td data-label="Responsable">{c.closed_by_name || '-'}</td>
                    <td data-label="Total vendido">{formatCurrency(c.total_vendido)}</td>
                    <td data-label="Saldo real">{formatCurrency(c.saldo_real)}</td>
                    <td data-label="Diferencia" style={{ color: Number(c.diferencia) === 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {formatCurrency(c.diferencia)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Pagination page={historyData.page} totalPages={historyData.totalPages} total={historyData.total} onPageChange={setHistoryPage} />
        </div>
      )}
    </Layout>
  );
}
