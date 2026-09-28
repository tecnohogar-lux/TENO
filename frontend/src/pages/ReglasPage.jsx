import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useAuth from '../hooks/useAuth';

const SETTING_KEY = 'reglas_texto';

export default function ReglasPage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const { data, loading, error, refetch } = useFetch('/api/settings');
  const { put, loading: saving, error: saveError } = useApi();
  const [texto, setTexto] = useState('');
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const reglas = data?.[SETTING_KEY] || '';

  useEffect(() => {
    setTexto(reglas);
  }, [reglas]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaved(false);
    const result = await put(`/api/settings/${SETTING_KEY}`, { value: texto });
    if (result.success) {
      setEditing(false);
      setSaved(true);
      refetch();
    }
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Reglas</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, fontSize: 13 }}>
            Normas y lineamientos del equipo.
          </p>
        </div>
        {isAdmin && !editing && data && (
          <button className="btn btn-primary" onClick={() => { setSaved(false); setEditing(true); }}>
            Editar reglas
          </button>
        )}
      </div>

      {loading && (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      )}
      {(error || saveError) && <div className="alert alert-error">{error || saveError}</div>}
      {saved && <div className="card" style={{ padding: 16, marginBottom: 20, color: 'var(--color-success)' }}>Reglas guardadas correctamente</div>}

      {data && isAdmin && editing && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20 }}>
          <div className="form-field">
            <label>Contenido</label>
            <textarea
              rows={18}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe aquí las reglas. Los saltos de línea se respetan."
              style={{ lineHeight: 1.6 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => { setTexto(reglas); setEditing(false); }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {data && !(isAdmin && editing) && (
        <div className="card" style={{ padding: 24 }}>
          {reglas.trim() ? (
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.7, fontSize: 15 }}>{reglas}</div>
          ) : (
            <div style={{ color: 'var(--color-text-muted)' }}>
              {isAdmin ? 'Aún no hay reglas. Usa "Editar reglas" para escribirlas.' : 'Aún no hay reglas publicadas.'}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
