import { useState } from 'react';
import Layout from '../components/Layout';
import Pagination from '../components/Pagination';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useAuth from '../hooks/useAuth';
import useConfirm from '../hooks/useConfirm';
import useDebouncedValue from '../hooks/useDebouncedValue';

const emptyForm = { name: '', address: '', phone: '', email: '' };
const PAGE_SIZE = 25;

export default function ClientsPage() {
  const { user } = useAuth();
  const canManage = user.role === 'operador' || user.role === 'admin';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const { data, loading, error, refetch } = useFetch(
    `/api/clients?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(debouncedSearch)}`,
    { deps: [page, debouncedSearch] }
  );
  const { post, put, del, loading: saving, error: saveError } = useApi();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingClient, setEditingClient] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [actionError, setActionError] = useState('');

  function handleSearchChange(value) {
    setSearch(value);
    setPage(1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await post('/api/clients', form);
    if (result.success) {
      setForm(emptyForm);
      setShowForm(false);
      refetch();
    }
  }

  function openEdit(c) {
    setEditingClient(c);
    setEditForm({ name: c.name, address: c.address || '', phone: c.phone || '', email: c.email || '' });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    const result = await put(`/api/clients/${editingClient.id}`, editForm);
    if (result.success) {
      setEditingClient(null);
      refetch();
    }
  }

  async function handleDelete(c) {
    setActionError('');
    const ok = await confirm(`¿Eliminar el cliente "${c.name}"?`, { title: 'Eliminar cliente', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    const result = await del(`/api/clients/${c.id}`);
    if (result.success) refetch();
    else if (result.error) setActionError(result.error);
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Clientes</h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            placeholder="Buscar por nombre, email o teléfono..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', width: 260, background: 'var(--color-surface)', color: 'var(--color-text)' }}
          />
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancelar' : 'Nuevo cliente'}
          </button>
        </div>
      </div>

      {actionError && <div className="alert alert-error">{actionError}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24 }}>
          {saveError && <div className="alert alert-error">{saveError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-field">
              <label>Nombre</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Teléfono</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Dirección</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cliente'}
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
                <th>Email</th>
                <th>Teléfono</th>
                <th>Dirección</th>
                <th>Creado por</th>
                {canManage && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {data.clients.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} style={{ color: 'var(--color-text-muted)' }}>Sin clientes que coincidan</td>
                </tr>
              ) : (
                data.clients.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Nombre">{c.name}</td>
                    <td data-label="Email">{c.email || '-'}</td>
                    <td data-label="Teléfono">{c.phone || '-'}</td>
                    <td data-label="Dirección">{c.address || '-'}</td>
                    <td data-label="Creado por">{c.created_by_name}</td>
                    {canManage && (
                      <td data-label="Acciones">
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => openEdit(c)}>
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
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        </div>
      )}

      {editingClient && editForm && (
        <div className="modal-overlay">
          <form className="modal-panel" onSubmit={handleEditSubmit}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Editar cliente</h3>
            {saveError && <div className="alert alert-error">{saveError}</div>}
            <div className="form-field">
              <label>Nombre</label>
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Email</label>
              <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Teléfono</label>
              <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Dirección</label>
              <input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingClient(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {confirmDialog}
    </Layout>
  );
}
