import { useState } from 'react';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useAuth from '../hooks/useAuth';
import useConfirm from '../hooks/useConfirm';
import { formatDate } from '../utils/format';

const TIPO_LABELS = {
  manual: { label: 'Noticia', color: '#1b2a82' },
  producto_creado: { label: 'Producto creado', color: '#4c7a52' },
  producto_editado: { label: 'Producto editado', color: '#3a6ea5' },
  producto_agotado: { label: 'Producto agotado', color: '#b3423a' },
  producto_disponible: { label: 'Producto disponible', color: '#4c7a52' },
  producto_eliminado: { label: 'Producto eliminado', color: '#6f6b62' },
};

export default function NoticiasPage() {
  const { user } = useAuth();
  const canManage = user.role === 'admin' || user.role === 'operador';
  const [limit, setLimit] = useState(10);
  const { data, loading, error, refetch } = useFetch(`/api/noticias?limit=${limit}`, { deps: [limit] });
  const { post, put, del, loading: saving, error: saveError } = useApi();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [texto, setTexto] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTexto, setEditTexto] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await post('/api/noticias', { texto });
    if (result.success) {
      setTexto('');
      setShowForm(false);
      refetch();
    }
  }

  function openEdit(n) {
    setEditingId(n.id);
    setEditTexto(n.texto);
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    const result = await put(`/api/noticias/${editingId}`, { texto: editTexto });
    if (result.success) {
      setEditingId(null);
      refetch();
    }
  }

  async function handleDelete(n) {
    const ok = await confirm('¿Eliminar esta noticia?', { title: 'Eliminar noticia', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    const result = await del(`/api/noticias/${n.id}`);
    if (result.success) refetch();
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Noticias</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, fontSize: 13 }}>
            Novedades de productos y anuncios del equipo. Se eliminan automáticamente a los 30 días.
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancelar' : 'Nueva noticia'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24 }}>
          {saveError && <div className="alert alert-error">{saveError}</div>}
          <div className="form-field">
            <label>Texto</label>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              required
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontFamily: 'inherit', fontSize: 14, resize: 'vertical' }}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 12 }}>
            {saving ? 'Publicando...' : 'Publicar'}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.noticias.length === 0 ? (
            <div className="card" style={{ padding: 20, color: 'var(--color-text-muted)' }}>Sin noticias</div>
          ) : (
            data.noticias.map((n) => (
              <div key={n.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                  <Badge label={(TIPO_LABELS[n.tipo] || {}).label || n.tipo} color={(TIPO_LABELS[n.tipo] || {}).color} />
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{formatDate(n.created_at)}</span>
                </div>
                <div style={{ fontSize: 14 }}>{n.texto}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>
                  {n.created_by_name ? `Por ${n.created_by_name}` : 'Sistema'}
                </div>
                {canManage && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {n.tipo === 'manual' && (
                      <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => openEdit(n)}>
                        Editar
                      </button>
                    )}
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px', fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                      onClick={() => handleDelete(n)}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))
          )}

          {data.noticias.length < data.total && (
            <button className="btn btn-secondary" onClick={() => setLimit((l) => l + 10)} style={{ alignSelf: 'center' }}>
              Ver más
            </button>
          )}
        </div>
      )}

      {editingId && (
        <div className="modal-overlay">
          <form className="modal-panel" onSubmit={handleEditSubmit}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Editar noticia</h3>
            {saveError && <div className="alert alert-error">{saveError}</div>}
            <textarea
              value={editTexto}
              onChange={(e) => setEditTexto(e.target.value)}
              rows={4}
              required
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontFamily: 'inherit', fontSize: 14, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
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
