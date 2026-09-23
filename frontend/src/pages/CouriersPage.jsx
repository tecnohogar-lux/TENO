import { useState } from 'react';
import Layout from '../components/Layout';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useConfirm from '../hooks/useConfirm';
import { formatDate } from '../utils/format';

export default function CouriersPage() {
  const { data, loading, error, refetch } = useFetch('/api/couriers');
  const { post, del, loading: saving, error: saveError } = useApi();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await post('/api/couriers', { name });
    if (result.success) {
      setName('');
      setShowForm(false);
      refetch();
    }
  }

  async function handleDelete(c) {
    const ok = await confirm(`¿Eliminar el courier "${c.name}"?`, { title: 'Eliminar courier', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    const result = await del(`/api/couriers/${c.id}`);
    if (result.success) refetch();
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Couriers</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, fontSize: 13 }}>
            Couriers disponibles para asignar a los envíos de Delivery Santiago.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : 'Nuevo courier'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24, maxWidth: 420 }}>
          {saveError && <div className="alert alert-error">{saveError}</div>}
          <div className="form-field">
            <label>Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Agregar courier'}
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
        <div className="card" style={{ padding: 20, maxWidth: 600 }}>
          <table className="responsive-stack">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Agregado</th>
                <th style={{ width: 100 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.couriers.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ color: 'var(--color-text-muted)' }}>Sin couriers registrados</td>
                </tr>
              ) : (
                data.couriers.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Nombre">{c.name}</td>
                    <td data-label="Agregado">{formatDate(c.created_at)}</td>
                    <td data-label="Acciones">
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                        onClick={() => handleDelete(c)}
                      >
                        Eliminar
                      </button>
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
