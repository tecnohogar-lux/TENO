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
import apiClient from '../api/client';

const emptyForm = { title: '', sku: '', price: '', costo: '', cover_image_url: '', caracteristicas: '' };
const PAGE_SIZE = 25;

// Vista previa en vivo del cálculo (el valor real siempre lo calcula el servidor).
function previewDerived(costo, price) {
  const c = parseFloat(costo);
  const p = parseFloat(price);
  if (isNaN(c) || isNaN(p)) return null;
  const rentabilidad = p - c;
  return { rentabilidad, comision_venta: rentabilidad * 0.25 };
}

export default function ProductsPage() {
  const { user } = useAuth();
  const canManage = user.role === 'operador' || user.role === 'admin' || user.role === 'caja';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const { data, loading, error, refetch } = useFetch(
    `/api/products?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(debouncedSearch)}`,
    { deps: [page, debouncedSearch] }
  );
  const { post, put, del, loading: saving, error: saveError } = useApi();
  const { post: postImport, loading: importing, error: importError } = useApi();
  const { post: postBulkEdit, loading: bulkEditing, error: bulkEditError } = useApi();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewingProduct, setViewingProduct] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [bulkEditResult, setBulkEditResult] = useState(null);
  const [showImportInfo, setShowImportInfo] = useState(false); // ventana de CARGA MASIVA
  const [showBulkEditInfo, setShowBulkEditInfo] = useState(false); // ventana de EDICIÓN MASIVA
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [downloaded, setDownloaded] = useState(''); // qué planilla se acaba de descargar (para recordar el respaldo)
  const [actionError, setActionError] = useState('');
  const fileInputRef = useRef(null);
  const bulkEditFileInputRef = useRef(null);

  // Selección para eliminar masivamente. Se limpia al cambiar la búsqueda para no
  // borrar por error productos que ya no se ven en pantalla.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectingAll, setSelectingAll] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  function handleSearchChange(value) {
    setSearch(value);
    setPage(1);
    setSelectedIds(new Set());
  }

  const pageProducts = data?.products || [];
  const allPageSelected = pageProducts.length > 0 && pageProducts.every((p) => selectedIds.has(p.id));

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageProducts.forEach((p) => next.delete(p.id));
      else pageProducts.forEach((p) => next.add(p.id));
      return next;
    });
  }

  async function selectAllMatching() {
    setSelectingAll(true);
    setActionError('');
    try {
      const { data: res } = await apiClient.get(`/api/products/ids?search=${encodeURIComponent(debouncedSearch)}`);
      setSelectedIds(new Set(res.ids));
    } catch (err) {
      setActionError(err.response?.data?.error || 'No se pudo seleccionar los productos');
    } finally {
      setSelectingAll(false);
    }
  }

  async function handleBulkDelete() {
    setActionError('');
    const n = selectedIds.size;
    const ok = await confirm(
      `Vas a eliminar DEFINITIVAMENTE ${n} producto${n === 1 ? '' : 's'}. Esta acción no se puede deshacer y no hay papelera de productos.`,
      { title: 'Eliminar productos', confirmLabel: `Eliminar ${n} producto${n === 1 ? '' : 's'}`, danger: true }
    );
    if (!ok) return;
    setBulkDeleting(true);
    try {
      await apiClient.post('/api/products/bulk-delete', { ids: [...selectedIds] });
      setSelectedIds(new Set());
      setPage(1);
      refetch();
    } catch (err) {
      setActionError(err.response?.data?.error || 'No se pudieron eliminar los productos');
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await post('/api/products', { ...form, price: Number(form.price), costo: form.costo === '' ? null : Number(form.costo) });
    if (result.success) {
      setForm(emptyForm);
      setShowForm(false);
      refetch();
    }
  }

  function openEdit(p) {
    setEditingProduct(p);
    setEditForm({ title: p.title, sku: p.sku || '', price: p.price, costo: p.costo ?? '', cover_image_url: p.cover_image_url || '', caracteristicas: p.caracteristicas || '' });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    const result = await put(`/api/products/${editingProduct.id}`, { ...editForm, price: Number(editForm.price), costo: editForm.costo === '' ? null : Number(editForm.costo) });
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
    if (result.success) {
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(p.id); return next; });
      refetch();
    }
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
    setDownloaded('');
    setShowImportInfo(true);
  }

  function chooseImportFile() {
    setShowImportInfo(false);
    fileInputRef.current?.click();
  }

  // Descarga un Excel generado por el servidor (plantilla de carga o planilla de productos).
  async function downloadExcel(endpoint, filename, kind) {
    setExportError('');
    setExporting(kind);
    try {
      const response = await apiClient.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setDownloaded(kind);
    } catch (err) {
      setExportError('No se pudo descargar el archivo');
    } finally {
      setExporting(false);
    }
  }

  function chooseBulkEditFile() {
    setShowBulkEditInfo(false);
    bulkEditFileInputRef.current?.click();
  }

  function openBulkEditInfo() {
    setBulkEditResult(null);
    setDownloaded('');
    setShowBulkEditInfo(true);
  }

  async function handleBulkEdit(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkEditResult(null);
    const formData = new FormData();
    formData.append('file', file);
    const result = await postBulkEdit('/api/products/bulk-edit/excel', formData);
    if (result.success) {
      setBulkEditResult(result.data);
      refetch();
    }
    if (bulkEditFileInputRef.current) bulkEditFileInputRef.current.value = '';
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
                {importing ? 'Cargando...' : 'CARGA MASIVA'}
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display: 'none' }} />
              <button className="btn btn-secondary" onClick={openBulkEditInfo} disabled={bulkEditing}>
                {bulkEditing ? 'Procesando...' : 'EDICIÓN MASIVA'}
              </button>
              <input ref={bulkEditFileInputRef} type="file" accept=".xlsx,.xls" onChange={handleBulkEdit} style={{ display: 'none' }} />
              <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
                {showForm ? 'Cancelar' : 'Nuevo producto'}
              </button>
            </>
          )}
        </div>
      </div>

      {actionError && <div className="alert alert-error">{actionError}</div>}
      {importError && <div className="alert alert-error" style={{ whiteSpace: 'pre-line' }}>{importError}</div>}
      {exportError && <div className="alert alert-error">{exportError}</div>}
      {bulkEditError && <div className="alert alert-error" style={{ whiteSpace: 'pre-line' }}>{bulkEditError}</div>}
      {importResult && (
        <div className="card" style={{ padding: 16, marginBottom: 24, fontSize: 14 }}>
          {importResult.products_created} producto(s) creado(s) de {importResult.total_rows_processed} filas
          {importResult.skipped_count > 0 ? ` (${importResult.skipped_count} omitida(s))` : ''}.
          {importResult.errors?.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: 'var(--color-danger)' }}>
              {importResult.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {bulkEditResult && (
        <div className="card" style={{ padding: 16, marginBottom: 24, fontSize: 14 }}>
          {bulkEditResult.products_updated === 0 && !(bulkEditResult.errors?.length > 0)
            ? 'No se detectaron cambios en la planilla: no se actualizó ningún producto'
            : `${bulkEditResult.products_updated} producto(s) actualizado(s)`}
          {bulkEditResult.products_unchanged > 0 ? ` · ${bulkEditResult.products_unchanged} sin cambios (no se tocaron)` : ''}
          {bulkEditResult.skipped_count > 0 ? ` · ${bulkEditResult.skipped_count} fila(s) omitida(s)` : ''}.
          {bulkEditResult.errors?.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: 'var(--color-danger)' }}>
              {bulkEditResult.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24 }}>
          {saveError && <div className="alert alert-error">{saveError}</div>}
          <div className="form-grid-2" style={{ gap: 16 }}>
            <div className="form-field">
              <label>Título</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>SKU</label>
              <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Precio marketplace</label>
              <input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Costo</label>
              <input type="number" min="0" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} />
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
          {previewDerived(form.costo, form.price) && (
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
              Rentabilidad: {formatCurrency(previewDerived(form.costo, form.price).rentabilidad)} · Comisión marketplace: {formatCurrency(previewDerived(form.costo, form.price).comision_venta)}
            </div>
          )}
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
          {canManage && selectedIds.size > 0 && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', marginBottom: 16, border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)' }}>
              <strong style={{ fontSize: 14 }}>{selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}</strong>
              {allPageSelected && selectedIds.size < data.total && (
                <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={selectAllMatching} disabled={selectingAll}>
                  {selectingAll ? 'Seleccionando...' : `Seleccionar los ${data.total} productos${debouncedSearch ? ' que coinciden con la búsqueda' : ''}`}
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setSelectedIds(new Set())} disabled={bulkDeleting}>
                Limpiar selección
              </button>
              <button type="button" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 13, background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={handleBulkDelete} disabled={bulkDeleting}>
                {bulkDeleting ? 'Eliminando...' : 'Eliminar seleccionados'}
              </button>
            </div>
          )}
          <table className="responsive-stack">
            <thead>
              <tr>
                {canManage && (
                  <th style={{ width: 24 }}>
                    <input type="checkbox" checked={allPageSelected} onChange={toggleSelectPage} aria-label="Seleccionar todos los productos de esta página" />
                  </th>
                )}
                <th>Título</th>
                <th>SKU</th>
                <th>Precio marketplace</th>
                {canManage && <th>Costo</th>}
                <th>Comisión marketplace</th>
                <th>Precio tienda</th>
                <th>Comisión tienda</th>
                <th>Características</th>
                <th>Estado</th>
                {canManage && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {data.products.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 11 : 8} style={{ color: 'var(--color-text-muted)' }}>Sin productos que coincidan</td>
                </tr>
              ) : (
                data.products.map((p) => (
                  <tr key={p.id} onClick={() => setViewingProduct(p)} style={{ cursor: 'pointer' }}>
                    {canManage && (
                      <td data-label="Seleccionar" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} aria-label={`Seleccionar ${p.title}`} />
                      </td>
                    )}
                    <td data-label="Título">{p.title}</td>
                    <td data-label="SKU">{p.sku || '-'}</td>
                    <td data-label="Precio marketplace">{formatCurrency(p.price)}</td>
                    {canManage && <td data-label="Costo">{p.costo !== null ? formatCurrency(p.costo) : '-'}</td>}
                    <td data-label="Comisión marketplace">{p.comision_venta !== null ? formatCurrency(p.comision_venta) : '-'}</td>
                    <td data-label="Precio tienda">{p.precio_tienda !== null && p.precio_tienda !== undefined ? formatCurrency(p.precio_tienda) : '-'}</td>
                    <td data-label="Comisión tienda">{p.comision_venta_tienda !== null && p.comision_venta_tienda !== undefined ? formatCurrency(p.comision_venta_tienda) : '-'}</td>
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
              <label>Precio marketplace</label>
              <input type="number" min="0" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Costo</label>
              <input type="number" min="0" value={editForm.costo} onChange={(e) => setEditForm({ ...editForm, costo: e.target.value })} />
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
            {previewDerived(editForm.costo, editForm.price) && (
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                Rentabilidad: {formatCurrency(previewDerived(editForm.costo, editForm.price).rentabilidad)} · Comisión marketplace: {formatCurrency(previewDerived(editForm.costo, editForm.price).comision_venta)}
              </div>
            )}
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

            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{formatCurrency(viewingProduct.price)} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--color-text-muted)' }}>marketplace</span></div>
            <div style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 16 }}>
              Comisión marketplace: <strong style={{ color: 'var(--color-text)' }}>{viewingProduct.comision_venta !== null ? formatCurrency(viewingProduct.comision_venta) : 'No calculada (falta costo)'}</strong>
              {canManage && viewingProduct.costo !== null && (
                <div>Costo: {formatCurrency(viewingProduct.costo)} · Rentabilidad: {formatCurrency(viewingProduct.rentabilidad)}</div>
              )}
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 16, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
              Precio tienda: <strong style={{ color: 'var(--color-text)' }}>{viewingProduct.precio_tienda !== null && viewingProduct.precio_tienda !== undefined ? formatCurrency(viewingProduct.precio_tienda) : '-'}</strong>
              <div>
                Comisión tienda: <strong style={{ color: 'var(--color-text)' }}>{viewingProduct.comision_venta_tienda !== null && viewingProduct.comision_venta_tienda !== undefined ? formatCurrency(viewingProduct.comision_venta_tienda) : 'No calculada (falta costo)'}</strong>
              </div>
              {canManage && viewingProduct.costo_tienda !== null && viewingProduct.costo_tienda !== undefined && (
                <div>Costo tienda: {formatCurrency(viewingProduct.costo_tienda)} · Rentabilidad tienda: {formatCurrency(viewingProduct.rentabilidad_tienda)}</div>
              )}
            </div>

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
          <div className="modal-panel" style={{ width: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Carga masiva de productos</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 0 }}>
              Sirve para crear productos <strong>nuevos</strong>. Descarga la plantilla, llénala (un producto por fila) y súbela. Las filas cuyo nombre ya existe se omiten y se reportan; las filas con errores también se omiten, y el resto se carga igual.
            </p>

            <div className="card" style={{ padding: 12, margin: '0 0 14px', background: 'var(--color-bg)', fontSize: 13 }}>
              <strong>Columnas de la plantilla (en este orden):</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
                <li><strong>Producto</strong>: obligatorio.</li>
                <li><strong>Costo y Precio</strong>: obligatorios, números mayores a 0 (el Precio no puede ser menor que el Costo).</li>
                <li><strong>SKU, URL Imagen, Descripción</strong>: opcionales.</li>
                <li><strong>Rentabilidad, Menos 75%, Menos 25% (Comisión de venta)</strong>: déjalas vacías; el sistema las calcula solo, igual que el precio tienda.</li>
                <li>No cambies los títulos ni el orden de las columnas. Las filas vacías se ignoran.</li>
              </ul>
            </div>

            <div className="alert" style={{ margin: '0 0 14px', background: 'var(--color-bg)', border: '1px solid var(--color-warning)', fontSize: 13 }}>
              <strong>Guarda un respaldo.</strong> Conserva una copia del archivo que vas a subir; si algo sale mal, podrás revisar qué cargaste.
            </div>

            {downloaded === 'plantilla' && (
              <div className="alert" style={{ margin: '0 0 14px', border: '1px solid var(--color-success)', fontSize: 13 }}>
                Plantilla descargada. Llénala y vuelve aquí para subirla.
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, minWidth: 180 }}
                disabled={!!exporting}
                onClick={() => downloadExcel('/api/products/import/template', 'plantilla-carga-masiva.xlsx', 'plantilla')}
              >
                {exporting === 'plantilla' ? 'Descargando...' : '⬇ Descargar plantilla'}
              </button>
              <button type="button" className="btn btn-primary" style={{ flex: 1, minWidth: 180 }} onClick={chooseImportFile}>
                ⬆ Subir plantilla rellenada
              </button>
            </div>
            <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 12 }} onClick={() => setShowImportInfo(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {showBulkEditInfo && (
        <div className="modal-overlay" onClick={() => setShowBulkEditInfo(false)}>
          <div className="modal-panel" style={{ width: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Edición masiva de productos</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 0 }}>
              Sirve para modificar productos que <strong>ya existen</strong> (por ejemplo cambiar precios). Descarga la planilla con todos los productos, cambia solo los valores que necesites y súbela.
            </p>

            <div className="card" style={{ padding: 12, margin: '0 0 14px', background: 'var(--color-bg)', fontSize: 13 }}>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
                <li>Se actualizan <strong>solo los productos que modificaste</strong>; los demás no se tocan.</li>
                <li><strong>No agregues, borres ni reordenes filas</strong>, ni cambies las columnas: la actualización se hace por posición.</li>
                <li>Una celda vacía significa "no cambiar" ese dato. Rentabilidad y comisiones se recalculan solas.</li>
                <li>Para crear productos nuevos usa <strong>CARGA MASIVA</strong>.</li>
              </ul>
            </div>

            <div className="alert" style={{ margin: '0 0 14px', background: 'var(--color-bg)', border: '1px solid var(--color-warning)', fontSize: 13 }}>
              <strong>Guarda un respaldo antes de editar.</strong> Al descargar la planilla, guarda una copia sin modificar en otra carpeta: si algo sale mal, podrás volver a los valores originales.
            </div>

            {downloaded === 'productos' && (
              <div className="alert" style={{ margin: '0 0 14px', border: '1px solid var(--color-success)', fontSize: 13 }}>
                Planilla descargada. <strong>Guarda una copia sin modificar como respaldo</strong>, edita la otra y vuelve aquí para subirla.
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, minWidth: 180 }}
                disabled={!!exporting}
                onClick={() => downloadExcel('/api/products/export/excel', 'productos.xlsx', 'productos')}
              >
                {exporting === 'productos' ? 'Descargando...' : '⬇ Descargar planilla de productos'}
              </button>
              <button type="button" className="btn btn-primary" style={{ flex: 1, minWidth: 180 }} onClick={chooseBulkEditFile}>
                ⬆ Subir planilla editada
              </button>
            </div>
            <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 12 }} onClick={() => setShowBulkEditInfo(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {confirmDialog}
    </Layout>
  );
}
