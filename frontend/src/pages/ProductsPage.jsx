import { useRef, useState } from 'react';
import UrlOpenButton from '../components/UrlOpenButton';
import Layout from '../components/Layout';
import Pagination from '../components/Pagination';
import Badge from '../components/Badge';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useAuth from '../hooks/useAuth';
import useConfirm from '../hooks/useConfirm';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { formatCurrency } from '../utils/format';

const emptyForm = { title: '', sku: '', price: '', cover_image_url: '', caracteristicas: '' };
const PAGE_SIZE = 25;

export default function ProductsPage() {
  const { user } = useAuth();
  const canManage = user.role === 'operador' || user.role === 'admin';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const { data, loading, error, refetch } = useFetch(
    `/api/products?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(debouncedSearch)}`,
    { deps: [page, debouncedSearch] }
  );
  const { post, put, del, loading: saving, error: saveError } = useApi();
  const { post: postImport, loading: importing, error: importError } = useApi();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewingProduct, setViewingProduct] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [showImportInfo, setShowImportInfo] = useState(false);
  const [actionError, setActionError] = useState('');
  const fileInputRef = useRef(null);

  function handleSearchChange(value) {
    setSearch(value);
    setPage(1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await post('/api/products', { ...form, price: Number(form.price) });
    if (result.success) {
      setForm(emptyForm);
      setShowForm(false);
      refetch();
    }
  }

  function openEdit(p) {
    setEditingProduct(p);
    setEditForm({ title: p.title, sku: p.sku || '', price: p.price, cover_image_url: p.cover_image_url || '', caracteristicas: p.caracteristicas || '' });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    const result = await put(`/api/products/${editingProduct.id}`, { ...editForm, price: Number(editForm.price) });
    if (result.success) {
      setEditingProduct(null);
      refetch();
    }
  }

  async function handleDelete(p) {
    setActionError('');
    const ok = await confirm(`¿Eliminar el producto "${p.title}"?`, { title: 'Eliminar producto', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    const result = await del(`/api/products/${p.id}`);
    if (result.success) refetch();
    else if (result.error) setActionError(result.error);
  }

  async function toggleAgotado(p) {
    setActionError('');
    const result = await put(`/api/products/${p.id}/agotado`, { agotado: !p.agotado });
    if (result.success) refetch();
    else if (result.error) setActionError(result.error);
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', file);
    const result = await postImport('/api/products/import/excel', formData);
    if (result.success) {
      setImportResult(result.data);
      refetch();
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openImportInfo() {
    setImportResult(null);
    setShowImportInfo(true);
  }

  function chooseImportFile() {
    setShowImportInfo(false);
    fileInputRef.current?.click();
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Productos</h1>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            placeholder="Buscar por título o SKU..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', width: 220, background: 'var(--color-surface)', color: 'var(--color-text)' }}
          />
          {canManage && (
            <>
              <button className="btn btn-secondary" onClick={openImportInfo} disabled={importing}>
                {importing ? 'Importando...' : 'Importar Excel'}
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display: 'none' }} />
              <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
                {showForm ? 'Cancelar' : 'Nuevo producto'}
              </button>
            </>
          )}
        </div>
      </div>

      {actionError && <div className="alert alert-error">{actionError}</div>}
      {importError && <div className="alert alert-error" style={{ whiteSpace: 'pre-line' }}>{importError}</div>}
      {importResult && (
        <div className="card" style={{ padding: 16, marginBottom: 24, fontSize: 14 }}>
          {importResult.products_created} productos importados de {importResult.total_rows_processed} filas.
          {importResult.errors?.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: 'var(--color-danger)' }}>
              {importResult.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24 }}>
          {saveError && <div className="alert alert-error">{saveError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-field">
              <label>Título</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>SKU</label>
              <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Precio</label>
              <input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>URL imagen</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ flex: 1 }} value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} />
                <UrlOpenButton url={form.cover_image_url} />
              </div>
            </div>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>Características</label>
              <textarea rows={2} value={form.caracteristicas} onChange={(e) => setForm({ ...form, caracteristicas: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar producto'}
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
                <th>Título</th>
                <th>SKU</th>
                <th>Precio</th>
                <th>Características</th>
                <th>Estado</th>
                {canManage && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {data.products.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} style={{ color: 'var(--color-text-muted)' }}>Sin productos que coincidan</td>
                </tr>
              ) : (
                data.products.map((p) => (
                  <tr key={p.id} onClick={() => setViewingProduct(p)} style={{ cursor: 'pointer' }}>
                    <td data-label="Título">{p.title}</td>
                    <td data-label="SKU">{p.sku || '-'}</td>
                    <td data-label="Precio">{formatCurrency(p.price)}</td>
                    <td data-label="Características" style={{ fontSize: 13, color: 'var(--color-text-muted)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.caracteristicas || '-'}</td>
                    <td data-label="Estado">
                      {p.agotado ? <Badge label="Agotado" color="var(--color-danger)" /> : <Badge label="Disponible" color="var(--color-success)" />}
                    </td>
                    {canManage && (
                      <td data-label="Acciones" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => openEdit(p)}>
                            Editar
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => toggleAgotado(p)}>
                            {p.agotado ? 'Marcar disponible' : 'Marcar agotado'}
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                            onClick={() => handleDelete(p)}
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

      {editingProduct && editForm && (
        <div className="modal-overlay">
          <form className="modal-panel" onSubmit={handleEditSubmit}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Editar producto</h3>
            {saveError && <div className="alert alert-error">{saveError}</div>}
            <div className="form-field">
              <label>Título</label>
              <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>SKU</label>
              <input value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Precio</label>
              <input type="number" min="0" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>URL imagen</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ flex: 1 }} value={editForm.cover_image_url} onChange={(e) => setEditForm({ ...editForm, cover_image_url: e.target.value })} />
                <UrlOpenButton url={editForm.cover_image_url} />
              </div>
            </div>
            <div className="form-field">
              <label>Características</label>
              <textarea rows={2} value={editForm.caracteristicas} onChange={(e) => setEditForm({ ...editForm, caracteristicas: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingProduct(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {viewingProduct && (
        <div className="modal-overlay" onClick={() => setViewingProduct(null)}>
          <div className="modal-panel" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>{viewingProduct.title}</h3>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>SKU: {viewingProduct.sku || '-'}</div>
              </div>
              {viewingProduct.agotado ? <Badge label="Agotado" color="var(--color-danger)" /> : <Badge label="Disponible" color="var(--color-success)" />}
            </div>

            {viewingProduct.cover_image_url && (
              <div style={{ marginBottom: 16, textAlign: 'center' }}>
                <img
                  src={viewingProduct.cover_image_url}
                  alt={viewingProduct.title}
                  style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 'var(--radius-sm)', objectFit: 'contain' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div style={{ marginTop: 8 }}>
                  <UrlOpenButton url={viewingProduct.cover_image_url} title="Abrir imagen en una pestaña nueva" />
                </div>
              </div>
            )}

            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>{formatCurrency(viewingProduct.price)}</div>

            <div className="form-field" style={{ marginBottom: 0 }}>
              <label>Características</label>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 260,
                  overflowY: 'auto',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                }}
              >
                {viewingProduct.caracteristicas || 'Sin características registradas.'}
              </div>
            </div>

            <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 20 }} onClick={() => setViewingProduct(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {showImportInfo && (
        <div className="modal-overlay" onClick={() => setShowImportInfo(false)}>
          <div className="modal-panel" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Formato del Excel a importar</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 0 }}>
              La primera fila debe ser exactamente este encabezado, en este orden. Si no coincide, o si alguna fila tiene datos inválidos, se rechaza el archivo completo y no se importa nada.
            </p>
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table className="responsive-stack" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Columna A</th>
                    <th>Columna B</th>
                    <th>Columna C</th>
                    <th>Columna D</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td data-label="Columna A"><strong>Título</strong></td>
                    <td data-label="Columna B"><strong>SKU</strong></td>
                    <td data-label="Columna C"><strong>Precio</strong></td>
                    <td data-label="Columna D"><strong>URL Imagen</strong></td>
                  </tr>
                  <tr>
                    <td data-label="Columna A">Producto Demo</td>
                    <td data-label="Columna B">SKU-001</td>
                    <td data-label="Columna C">15990</td>
                    <td data-label="Columna D">https://...</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 20px', paddingLeft: 20, lineHeight: 1.6 }}>
              <li><strong>Título</strong>: obligatorio.</li>
              <li><strong>SKU</strong>: opcional.</li>
              <li><strong>Precio</strong>: obligatorio, número mayor a 0.</li>
              <li><strong>URL Imagen</strong>: opcional.</li>
              <li>Las filas completamente vacías se ignoran; el resto necesita título y precio válidos.</li>
            </ul>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={chooseImportFile}>
                Seleccionar archivo
              </button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowImportInfo(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog}
    </Layout>
  );
}
