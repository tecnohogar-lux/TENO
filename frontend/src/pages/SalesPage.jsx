import { useState } from 'react';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import MetricsCard from '../components/MetricsCard';
import Pagination from '../components/Pagination';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useAuth from '../hooks/useAuth';
import useConfirm from '../hooks/useConfirm';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { formatCurrency, formatDate } from '../utils/format';
import { SALE_STATUS_LABELS, DELIVERY_STATUS_LABELS, TIPO_VENTA_LABELS, saleStatusLabel, deliveryStatusLabel, tipoVentaLabel, paymentMethodLabel } from '../utils/labels';
import { shareSaleViaWhatsApp } from '../utils/whatsapp';

const PAGE_SIZE = 25;

export default function SalesPage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const canManage = user.role === 'admin' || user.role === 'operador';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const { data, loading, error, refetch } = useFetch(
    `/api/sales?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(debouncedSearch)}`,
    { deps: [page, debouncedSearch] }
  );
  const { data: summary } = useFetch(
    `/api/sales/summary?search=${encodeURIComponent(debouncedSearch)}`,
    { deps: [debouncedSearch] }
  );
  const { put, del } = useApi();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [actionError, setActionError] = useState('');

  function handleSearchChange(value) {
    setSearch(value);
    setPage(1);
  }

  async function toggleTransferenciaVerificada(sale) {
    setActionError('');
    const result = await put(`/api/sales/${sale.id}`, { transferencia_verificada: !sale.transferencia_verificada });
    if (result.success) refetch();
    else if (result.error) setActionError(result.error);
  }

  async function handleDelete(sale) {
    setActionError('');
    const ok = await confirm(`¿Eliminar la venta "${sale.product_name}" de ${sale.client_name}? Podrás recuperarla desde la Papelera.`, {
      title: 'Eliminar venta',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    const result = await del(`/api/sales/${sale.id}`);
    if (result.success) refetch();
    else if (result.error) setActionError(result.error);
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Historial de Ventas</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, fontSize: 13 }}>
            Vista general de envíos y ventas en tienda. Para crear una etiqueta de envío ve a Delivery Santiago; para una venta en tienda ve a Caja.
          </p>
        </div>
        <input
          placeholder="Buscar por vendedor, cliente o producto..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', width: 300, background: 'var(--color-surface)', color: 'var(--color-text)' }}
        />
      </div>

      {actionError && <div className="alert alert-error">{actionError}</div>}

      {summary && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <MetricsCard label="Total ventas" value={summary.total} />
          {user.role !== 'vendedor' && <MetricsCard label="Monto generado" value={formatCurrency(summary.monto)} />}
          <MetricsCard label="Envíos" value={summary.envios} />
          <MetricsCard label="Tienda" value={summary.tienda} />
        </div>
      )}

      {loading && (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      {data && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ overflowX: 'auto' }}>
          <table className="responsive-stack">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Envío</th>
                <th>Pago</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.sales.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ color: 'var(--color-text-muted)' }}>Sin ventas que coincidan</td>
                </tr>
              ) : (
                data.sales.map((s) => (
                  <tr key={s.id}>
                    <td data-label="Producto">{s.product_name}</td>
                    <td data-label="Cliente">{s.client_name}</td>
                    <td data-label="Vendedor">{s.vendor_name}</td>
                    <td data-label="Tipo">
                      <Badge label={tipoVentaLabel(s.tipo_venta)} color={TIPO_VENTA_LABELS[s.tipo_venta]?.color} />
                    </td>
                    <td data-label="Cantidad">{s.quantity}</td>
                    <td data-label="Total">{formatCurrency(s.total)}</td>
                    <td data-label="Estado">
                      <Badge label={saleStatusLabel(s.status)} color={SALE_STATUS_LABELS[s.status]?.color} />
                    </td>
                    <td data-label="Envío">
                      {['ENVIO', 'ENVIO_PREPAGADO', 'ENVIO_REGION'].includes(s.tipo_venta) ? (
                        <Badge label={deliveryStatusLabel(s.delivery_status)} color={DELIVERY_STATUS_LABELS[s.delivery_status]?.color} />
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                      )}
                    </td>
                    <td data-label="Pago">
                      {s.payment_method ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                          <span>{paymentMethodLabel(s.payment_method)}</span>
                          {s.payment_method === 'transferencia' && (
                            canManage ? (
                              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text-muted)' }}>
                                <input type="checkbox" checked={!!s.transferencia_verificada} onChange={() => toggleTransferenciaVerificada(s)} />
                                Verificada
                              </label>
                            ) : (
                              <Badge
                                label={s.transferencia_verificada ? 'Verificada' : 'Sin verificar'}
                                color={s.transferencia_verificada ? 'var(--color-success)' : 'var(--color-warning)'}
                              />
                            )
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                      )}
                    </td>
                    <td data-label="Fecha">{formatDate(s.created_at)}</td>
                    <td data-label="Acciones">
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => shareSaleViaWhatsApp(s)}>
                          WhatsApp
                        </button>
                        {isAdmin && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                            onClick={() => handleDelete(s)}
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>

          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        </div>
      )}

      {confirmDialog}
    </Layout>
  );
}
