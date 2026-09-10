import { useState } from 'react';
import Layout from '../components/Layout';
import Pagination from '../components/Pagination';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useConfirm from '../hooks/useConfirm';
import { formatDate } from '../utils/format';

const PAGE_SIZE = 25;
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AnotacionesPage() {
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useFetch(`/api/anotaciones?page=${page}&limit=${PAGE_SIZE}`, { deps: [page] });
  const { post, put, del, loading: saving, error: saveError } = useApi();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fecha: todayISO(), texto: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await post('/api/anotaciones', form);
    if (result.success) {
      setForm({ fecha: todayISO(), texto: '' });
      setShowForm(false);
      refetch();
    }
  }

  function openEdit(a) {
    setEditingId(a.id);
    setEditForm({ fecha: a.fecha?.slice(0, 10) || todayISO(), texto: a.texto });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    const result = await put(`/api/anotaciones/${editingId}`, editForm);
    if (result.success) {
      setEditingId(null);
      refetch();
    }
  }

  async function handleDelete(a) {
    const ok = await confirm('¿Eliminar esta anotación?', { title: 'Eliminar anotación', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    const result = await del(`/api/anotaciones/${a.id}`);
    if (result.success) refetch();
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Anotaciones diarias</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, fontSize: 13 }}>
            Bitácora interna, solo visible para Admin y Operador.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : 'Nueva anotación'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24 }}>
          {saveError && <div className="alert alert-error">{saveError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16 }}>
            <div className="form-field">
              <label>Fecha</label>
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Texto</label>
              <textarea
                value={form.texto}
                onChange={(e) => setForm({ ...form, texto: e.target.value })}
                rows={3}
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontFamily: 'inherit', fontSize: 14, resize: 'vertical' }}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 12 }}>
            {saving ? 'Guardando...' : 'Guardar anotación'}
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
                <th style={{ width: 110 }}>Fecha</th>
                <th>Texto</th>
                <th>Autor</th>
                <th style={{ width: 140 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.anotaciones.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ color: 'var(--color-text-muted)' }}>Sin anotaciones</td>
                </tr>
              ) : (
                data.anotaciones.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Fecha">{a.fecha?.slice(0, 10)}</td>
                    <td data-label="Texto">{a.texto}</td>
                    <td data-label="Autor">{a.created_by_name || '-'}</td>
                    <td data-label="Acciones">
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => openEdit(a)}>Editar</button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                          onClick={() => handleDelete(a)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        </div>
      )}

      {editingId && editForm && (
        <div className="modal-overlay">
          <form className="modal-panel" onSubmit={handleEditSubmit}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Editar anotación</h3>
            {saveError && <div className="alert alert-error">{saveError}</div>}
            <div className="form-field">
              <label>Fecha</label>
              <input type="date" value={editForm.fecha} onChange={(e) => setEditForm({ ...editForm, fecha: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Texto</label>
              <textarea
                value={editForm.texto}
                onChange={(e) => setEditForm({ ...editForm, texto: e.target.value })}
                rows={4}
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontFamily: 'inherit', fontSize: 14, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingId(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {confirmDialog}
    </Layout>
  );
}
