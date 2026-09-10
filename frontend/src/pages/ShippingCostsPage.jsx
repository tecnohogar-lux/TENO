import { useState } from 'react';
import Layout from '../components/Layout';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useAuth from '../hooks/useAuth';
import useConfirm from '../hooks/useConfirm';
import { formatCurrency } from '../utils/format';

export default function ShippingCostsPage() {
  const { user } = useAuth();
  const canManage = user.role === 'admin' || user.role === 'operador';
  const { data, loading, error, refetch } = useFetch('/api/shipping-costs');
  const { post, put, del, loading: saving, error: saveError } = useApi();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ comuna: '', precio: '' });
  const [editingId, setEditingId] = useState(null);
  const [editPrecio, setEditPrecio] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await post('/api/shipping-costs', form);
    if (result.success) {
      setForm({ comuna: '', precio: '' });
      setShowForm(false);
      refetch();
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    const result = await put(`/api/shipping-costs/${editingId}`, { precio: editPrecio });
    if (result.success) {
      setEditingId(null);
      refetch();
    }
  }

  async function handleDelete(c) {
    const ok = await confirm(`¿Eliminar el costo de envío de "${c.comuna}"?`, { title: 'Eliminar comuna', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    const result = await del(`/api/shipping-costs/${c.id}`);
    if (result.success) refetch();
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Costos de envío</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, fontSize: 13 }}>
            Precios por comuna para envíos dentro de la Región Metropolitana.
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancelar' : 'Nueva comuna'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24 }}>
          {saveError && <div className="alert alert-error">{saveError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16 }}>
            <div className="form-field">
              <label>Comuna</label>
              <input value={form.comuna} onChange={(e) => setForm({ ...form, comuna: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Precio</label>
              <input type="number" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 12 }}>
            {saving ? 'Guardando...' : 'Guardar'}
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
          <table className="responsive-stack">
            <thead>
              <tr>
                <th>Comuna</th>
                <th>Precio</th>
                {canManage && <th style={{ width: 160 }}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {data.costos.map((c) => (
                <tr key={c.id}>
                  <td data-label="Comuna">{c.comuna}</td>
                  <td data-label="Precio">
                    {editingId === c.id ? (
                      <form onSubmit={handleEditSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                        <input
                          type="number"
                          value={editPrecio}
                          onChange={(e) => setEditPrecio(e.target.value)}
                          style={{ width: 100, padding: '4px 8px' }}
                          autoFocus
                        />
                        <button type="submit" className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} disabled={saving}>Guardar</button>
                        <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setEditingId(null)}>Cancelar</button>
                      </form>
                    ) : (
                      formatCurrency(c.precio)
                    )}
                  </td>
                  {canManage && (
                    <td data-label="Acciones">
                      {editingId !== c.id && (
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => { setEditingId(c.id); setEditPrecio(String(c.precio)); }}>
                            Editar
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                            onClick={() => handleDelete(c)}
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDialog}
    </Layout>
  );
}
