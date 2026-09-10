import Layout from '../components/Layout';
import Badge from '../components/Badge';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useConfirm from '../hooks/useConfirm';
import { formatCurrency, formatDate } from '../utils/format';
import { SALE_STATUS_LABELS, TIPO_VENTA_LABELS, saleStatusLabel, tipoVentaLabel } from '../utils/labels';

export default function TrashPage() {
  const { data, loading, error, refetch } = useFetch('/api/sales/trash');
  const { put, del, error: actionError } = useApi();
  const { confirm, dialog: confirmDialog } = useConfirm();

  async function handleRestore(sale) {
    const result = await put(`/api/sales/${sale.id}/restore`, {});
    if (result.success) refetch();
  }

  async function handlePermanentDelete(sale) {
    const ok = await confirm(`¿Eliminar definitivamente "${sale.product_name}"? Ya no se podrá recuperar.`, {
      title: 'Eliminar definitivamente',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    const result = await del(`/api/sales/${sale.id}/permanent`);
    if (result.success) refetch();
  }

  return (
    <Layout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Papelera</h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, fontSize: 13 }}>
          Ventas y envíos eliminados. Puedes restaurarlos o borrarlos definitivamente.
        </p>
      </div>

      {loading && (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      )}
      {(error || actionError) && <div className="alert alert-error">{error || actionError}</div>}

      {data && (
        <div className="card" style={{ padding: 20 }}>
          <table className="responsive-stack">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Tipo</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Eliminado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.sales.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ color: 'var(--color-text-muted)' }}>La papelera está vacía</td>
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
                    <td data-label="Total">{formatCurrency(s.total)}</td>
                    <td data-label="Estado">
                      <Badge label={saleStatusLabel(s.status)} color={SALE_STATUS_LABELS[s.status]?.color} />
                    </td>
                    <td data-label="Eliminado">{formatDate(s.deleted_at)}</td>
                    <td data-label="Acciones">
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => handleRestore(s)}>
                          Restaurar
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                          onClick={() => handlePermanentDelete(s)}
                        >
                          Eliminar definitivamente
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {confirmDialog}
    </Layout>
  );
}
