import { useState } from 'react';
import Layout from '../components/Layout';
import Pagination from '../components/Pagination';
import MetricsCard from '../components/MetricsCard';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useConfirm from '../hooks/useConfirm';
import { formatCurrency, formatDate } from '../utils/format';

const PAGE_SIZE = 25;
const emptyForm = { nombre: '', monto: '' };

export default function GastosPage() {
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useFetch(`/api/gastos?page=${page}&limit=${PAGE_SIZE}`, { deps: [page] });
  const { post, del, loading: saving, error: saveError } = useApi();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await post('/api/gastos', form);
    if (result.success) {
      setForm(emptyForm);
      setShowForm(false);
      refetch();
    }
  }

  async function handleDelete(g) {
    const ok = await confirm(`¿Eliminar el gasto "${g.nombre}"?`, { title: 'Eliminar gasto', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    const result = await del(`/api/gastos/${g.id}`);
    if (result.success) refetch();
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Gastos y egresos</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : 'Nuevo gasto'}
        </button>
      </div>

      {data && (
        <div style={{ marginBottom: 24 }}>
          <MetricsCard label="Total gastado" value={formatCurrency(data.total_monto)} />
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24 }}>
          {saveError && <div className="alert alert-error">{saveError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16 }}>
            <div className="form-field">
              <label>Nombre</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Monto</label>
              <input type="number" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 12 }}>
            {saving ? 'Guardando...' : 'Registrar gasto'}
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
                <th>Nombre</th>
                <th>Monto</th>
                <th>Registrado por</th>
                <th>Fecha</th>
                <th style={{ width: 100 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.gastos.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--color-text-muted)' }}>Sin gastos registrados</td>
                </tr>
              ) : (
                data.gastos.map((g) => (
                  <tr key={g.id}>
                    <td data-label="Nombre">{g.nombre}</td>
                    <td data-label="Monto">{formatCurrency(g.monto)}</td>
                    <td data-label="Registrado por">{g.created_by_name || '-'}</td>
                    <td data-label="Fecha">{formatDate(g.created_at)}</td>
                    <td data-label="Acciones">
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                        onClick={() => handleDelete(g)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        </div>
      )}

      {confirmDialog}
    </Layout>
  );
}
