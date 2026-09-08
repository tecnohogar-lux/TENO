import { useRef, useState } from 'react';
import Layout from '../components/Layout';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import { formatCurrency } from '../utils/format';

const emptyForm = { title: '', sku: '', price: '', cover_image_url: '' };

export default function ProductsPage() {
  const { data, loading, error, refetch } = useFetch('/api/products');
  const { post, loading: saving, error: saveError } = useApi();
  const { post: postImport, loading: importing, error: importError } = useApi();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await post('/api/products', { ...form, price: Number(form.price) });
    if (result.success) {
      setForm(emptyForm);
      setShowForm(false);
      refetch();
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const result = await postImport('/api/products/import/excel', formData);
    if (result.success) {
      setImportResult(result.data);
      refetch();
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Productos</h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? 'Importando...' : 'Importar Excel'}
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display: 'none' }} />
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancelar' : 'Nuevo producto'}
          </button>
        </div>
      </div>

      {importError && <div className="alert alert-error">{importError}</div>}
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
              <input value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} />
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
          <table>
            <thead>
              <tr>
                <th>Título</th>
                <th>SKU</th>
                <th>Precio</th>
              </tr>
            </thead>
            <tbody>
              {data.products.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ color: 'var(--color-text-muted)' }}>Sin productos registrados</td>
                </tr>
              ) : (
                data.products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.title}</td>
                    <td>{p.sku || '-'}</td>
                    <td>{formatCurrency(p.price)}</td>
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
