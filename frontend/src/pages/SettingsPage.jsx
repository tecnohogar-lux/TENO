import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';

export default function SettingsPage() {
  const { data, loading, error, refetch } = useFetch('/api/settings');
  const { put, loading: saving, error: saveError } = useApi();
  const [hora, setHora] = useState('18:00');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.envio_deadline_hora) setHora(data.envio_deadline_hora);
  }, [data]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaved(false);
    const result = await put('/api/settings/envio_deadline_hora', { value: hora });
    if (result.success) {
      refetch();
      setSaved(true);
    }
  }

  return (
    <Layout>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Configuración</h1>
      <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 28 }}>
        Ajustes globales del sistema.
      </p>

      {loading && (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      )}
      {(error || saveError) && <div className="alert alert-error">{error || saveError}</div>}

      {data && (
        <div className="card" style={{ padding: 20, maxWidth: 420 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Hora límite de envíos</h3>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 16, fontSize: 13 }}>
            Hora de corte del último envío del día. Se muestra como cuenta regresiva en el dashboard de todos los roles.
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div className="form-field" style={{ margin: 0 }}>
              <label>Hora límite</label>
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </form>
          {saved && !saveError && (
            <div style={{ color: 'var(--color-success)', fontSize: 13, marginTop: 12 }}>Guardado correctamente</div>
          )}
        </div>
      )}
    </Layout>
  );
}
