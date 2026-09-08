import { useMemo, useState } from 'react';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import LabelPrint from '../components/LabelPrint';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import { formatCurrency, formatDate } from '../utils/format';
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_OPTIONS, deliveryStatusLabel } from '../utils/labels';

export default function ShippingPage() {
  const { data, loading, error, refetch } = useFetch('/api/sales');
  const { put, error: saveError } = useApi();
  const [statusFilter, setStatusFilter] = useState('todos');
  const [printSale, setPrintSale] = useState(null);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addressForm, setAddressForm] = useState({ address: '', phone: '' });

  const shipments = useMemo(() => {
    const all = (data?.sales || []).filter((s) => s.tipo_venta === 'ENVIO');
    if (statusFilter === 'todos') return all;
    return all.filter((s) => s.delivery_status === statusFilter);
  }, [data, statusFilter]);

  async function handleStatusChange(sale, newStatus) {
    const result = await put(`/api/sales/${sale.id}/status`, { status: newStatus });
    if (result.success) refetch();
  }

  function openAddressEdit(sale) {
    setEditingAddress(sale);
    setAddressForm({ address: sale.address || '', phone: sale.phone || '' });
  }

  async function handleAddressSubmit(e) {
    e.preventDefault();
    const result = await put(`/api/sales/${editingAddress.id}/address`, addressForm);
    if (result.success) {
      setEditingAddress(null);
      refetch();
    }
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Envíos</h1>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)' }}>
          <option value="todos">Todos los estados</option>
          {DELIVERY_STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{deliveryStatusLabel(opt)}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      )}
      {(error || saveError) && <div className="alert alert-error">{error || saveError}</div>}

      {data && (
        <div className="card" style={{ padding: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cliente</th>
                <th>Dirección</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {shipments.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ color: 'var(--color-text-muted)' }}>Sin envíos que coincidan con el filtro</td>
                </tr>
              ) : (
                shipments.map((s) => (
                  <tr key={s.id}>
                    <td>{s.product_name}</td>
                    <td>{s.client_name}</td>
                    <td>{s.address || '-'}</td>
                    <td>{formatCurrency(s.total)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <Badge label={deliveryStatusLabel(s.delivery_status)} color={DELIVERY_STATUS_LABELS[s.delivery_status]?.color} />
                        <select
                          value={s.delivery_status}
                          onChange={(e) => handleStatusChange(s, e.target.value)}
                          style={{ fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--color-border)' }}
                        >
                          {DELIVERY_STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{deliveryStatusLabel(opt)}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td>{formatDate(s.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => openAddressEdit(s)}>
                          Editar dirección
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setPrintSale(s)}>
                          Imprimir etiqueta
                        </button>
                        {s.delivery_status !== 'entregado' && (
                          <button className="btn btn-primary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => handleStatusChange(s, 'entregado')}>
                            Marcar entregado
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
      )}

      {printSale && <LabelPrint sale={printSale} onClose={() => setPrintSale(null)} />}

      {editingAddress && (
        <div className="modal-overlay">
          <form className="modal-panel" onSubmit={handleAddressSubmit}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Editar dirección</h3>
            <div className="form-field">
              <label>Dirección</label>
              <input value={addressForm.address} onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Teléfono</label>
              <input value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Guardar</button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingAddress(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
}
