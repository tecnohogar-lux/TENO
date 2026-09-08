import { useState } from 'react';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import { formatCurrency, formatDate } from '../utils/format';
import { SALE_STATUS_LABELS, DELIVERY_STATUS_LABELS, TIPO_VENTA_LABELS, saleStatusLabel, deliveryStatusLabel, tipoVentaLabel } from '../utils/labels';

const emptyForm = { client_id: '', product_name: '', quantity: '', price: '', address: '', phone: '', notes: '' };

export default function SalesPage() {
  const { data, loading, error, refetch } = useFetch('/api/sales');
  const { post, loading: saving, error: saveError } = useApi();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await post('/api/sales', {
      ...form,
      client_id: Number(form.client_id),
      quantity: Number(form.quantity),
      price: Number(form.price),
    });
    if (result.success) {
      setForm(emptyForm);
      setShowForm(false);
      refetch();
    }
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Ventas</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : 'Nueva venta'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24 }}>
          {saveError && <div className="alert alert-error">{saveError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-field">
              <label>ID Cliente</label>
              <input value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Producto</label>
              <input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Cantidad</label>
              <input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Precio unitario</label>
              <input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Dirección</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Teléfono</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="form-field">
            <label>Notas</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar venta'}
          </button>
        </form>
      )}

      {loading && (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      {data && (
        <div className="card" style={{ padding: 20 }}>
          <table>
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
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {data.sales.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ color: 'var(--color-text-muted)' }}>Sin ventas registradas</td>
                </tr>
              ) : (
                data.sales.map((s) => (
                  <tr key={s.id}>
                    <td>{s.product_name}</td>
                    <td>{s.client_name}</td>
                    <td>{s.vendor_name}</td>
                    <td>
                      <Badge label={tipoVentaLabel(s.tipo_venta)} color={TIPO_VENTA_LABELS[s.tipo_venta]?.color} />
                    </td>
                    <td>{s.quantity}</td>
                    <td>{formatCurrency(s.total)}</td>
                    <td>
                      <Badge label={saleStatusLabel(s.status)} color={SALE_STATUS_LABELS[s.status]?.color} />
                    </td>
                    <td>
                      {s.tipo_venta === 'ENVIO' ? (
                        <Badge label={deliveryStatusLabel(s.delivery_status)} color={DELIVERY_STATUS_LABELS[s.delivery_status]?.color} />
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                      )}
                    </td>
                    <td>{formatDate(s.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
