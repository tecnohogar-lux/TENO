import { useState } from 'react';
import Layout from '../components/Layout';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';

const emptyForm = { name: '', notes: '' };

export default function LabelsPage() {
  const { data, loading, error, refetch } = useFetch('/api/labels');
  const { post, loading: saving, error: saveError } = useApi();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await post('/api/labels', form);
    if (result.success) {
      setForm(emptyForm);
      setShowForm(false);
      refetch();
    }
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Etiquetas</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : 'Nueva etiqueta'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24 }}>
          {saveError && <div className="alert alert-error">{saveError}</div>}
          <div className="form-field">
            <label>Nombre</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>Notas</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar etiqueta'}
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
                <th>Nombre</th>
                <th>Notas</th>
                <th>Creado por</th>
              </tr>
            </thead>
            <tbody>
              {data.labels.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ color: 'var(--color-text-muted)' }}>Sin etiquetas registradas</td>
                </tr>
              ) : (
                data.labels.map((l) => (
                  <tr key={l.id}>
                    <td>{l.name}</td>
                    <td>{l.notes || '-'}</td>
                    <td>{l.created_by_name}</td>
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
