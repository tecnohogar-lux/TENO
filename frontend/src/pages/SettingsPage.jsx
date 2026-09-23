import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';

const emptyHoras = { semana: '18:00', sabado: '18:00', domingo: '18:00' };

export default function SettingsPage() {
  const { data, loading, error, refetch } = useFetch('/api/settings');
  const { put, loading: saving, error: saveError } = useApi();
  const [horas, setHoras] = useState(emptyHoras);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setHoras({
      semana: data.envio_deadline_hora || emptyHoras.semana,
      // Si aún no se han personalizado, parten iguales a la hora de semana.
      sabado: data.envio_deadline_hora_sabado || data.envio_deadline_hora || emptyHoras.sabado,
      domingo: data.envio_deadline_hora_domingo || data.envio_deadline_hora || emptyHoras.domingo,
    });
  }, [data]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaved(false);
    // Secuencial (no Promise.all): las 3 llamadas comparten el mismo estado
    // loading/error de useApi, y en paralelo la primera en resolver pisaría
    // ese estado mientras las otras siguen en curso.
    const semanaResult = await put('/api/settings/envio_deadline_hora', { value: horas.semana });
    if (!semanaResult.success) return;
    const sabadoResult = await put('/api/settings/envio_deadline_hora_sabado', { value: horas.sabado });
    if (!sabadoResult.success) return;
    const domingoResult = await put('/api/settings/envio_deadline_hora_domingo', { value: horas.domingo });
    if (!domingoResult.success) return;

    refetch();
    setSaved(true);
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
        <div className="card" style={{ padding: 20, maxWidth: 480 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Hora límite de envíos</h3>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 16, fontSize: 13 }}>
            Hora de corte del último envío del día. Se puede diferenciar para sábado y domingo. Se muestra como cuenta regresiva en el dashboard de todos los roles.
          </p>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
              <div className="form-field" style={{ margin: 0 }}>
                <label>Lunes a viernes</label>
                <input type="time" value={horas.semana} onChange={(e) => setHoras({ ...horas, semana: e.target.value })} required />
              </div>
              <div className="form-field" style={{ margin: 0 }}>
                <label>Sábado</label>
                <input type="time" value={horas.sabado} onChange={(e) => setHoras({ ...horas, sabado: e.target.value })} required />
              </div>
              <div className="form-field" style={{ margin: 0 }}>
                <label>Domingo</label>
                <input type="time" value={horas.domingo} onChange={(e) => setHoras({ ...horas, domingo: e.target.value })} required />
              </div>
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
