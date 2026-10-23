import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import AvisoActualizacionPantalla from '../components/AvisoActualizacionPantalla';
import { AVISO_MENSAJE_BORRADOR, AVISO_TITULO_BORRADOR } from '../utils/avisoTexto';

const TITULO_MAX = 120;
const MENSAJE_MAX = 4000;

// Administración → Avisos: aviso a pantalla completa que ven todos los usuarios al entrar al sistema.
// El admin escribe el título y el mensaje, y lo enciende o apaga cuando quiera (queda apagado de inicio).
// Se guarda en la configuración global (claves aviso_*), así que no hace falta publicar nada para cambiarlo.
export default function AvisosPage() {
  const { data, loading, error, refetch } = useFetch('/api/settings');
  const { put, loading: saving, error: saveError } = useApi();
  const [activo, setActivo] = useState(false);
  const [titulo, setTitulo] = useState(AVISO_TITULO_BORRADOR);
  const [mensaje, setMensaje] = useState(AVISO_MENSAJE_BORRADOR);
  const [reenviar, setReenviar] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [vista, setVista] = useState(false);
  const [errorLocal, setErrorLocal] = useState('');

  useEffect(() => {
    if (!data) return;
    setActivo(data.aviso_actualizacion_activo === '1');
    // Si todavía no se guardó nada, se parte del borrador (apagado) para que el admin lo revise y lo edite.
    setTitulo(data.aviso_actualizacion_titulo ?? AVISO_TITULO_BORRADOR);
    setMensaje(data.aviso_actualizacion_mensaje ?? AVISO_MENSAJE_BORRADOR);
  }, [data]);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardado(false);
    setErrorLocal('');
    if (!titulo.trim()) { setErrorLocal('Escribe un título para el aviso.'); return; }
    if (activo && !mensaje.trim()) { setErrorLocal('Escribe el mensaje antes de encender el aviso.'); return; }

    const estabaActivo = data?.aviso_actualizacion_activo === '1';
    // Cada vez que se enciende (o se pide mostrarlo de nuevo) recibe un identificador nuevo: así lo vuelven a ver
    // quienes ya habían pulsado "Entendido" con uno anterior.
    const nuevoId = activo && (!estabaActivo || reenviar || !data?.aviso_actualizacion_id);
    // Secuencial: las llamadas comparten el estado de useApi. El aviso se enciende al final, con todo ya guardado.
    for (const [clave, valor] of [
      ['aviso_actualizacion_titulo', titulo.trim()],
      ['aviso_actualizacion_mensaje', mensaje.trim()],
      ...(nuevoId ? [['aviso_actualizacion_id', String(Date.now())]] : []),
      ['aviso_actualizacion_activo', activo ? '1' : '0'],
    ]) {
      const r = await put(`/api/settings/${clave}`, { value: valor });
      if (!r.success) return;
    }
    setReenviar(false);
    refetch();
    setGuardado(true);
  }

  const yaEncendido = data?.aviso_actualizacion_activo === '1';

  return (
    <Layout>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Avisos</h1>
      <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 24 }}>
        Aviso a pantalla completa para todos los usuarios al entrar al sistema, por ejemplo para avisar de una actualización.
      </p>

      {loading && !data && <div className="page-loading"><div className="spinner" /></div>}
      {error && <div className="alert alert-error">{error}</div>}

      {data && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, maxWidth: 760 }}>
          {(saveError || errorLocal) && <div className="alert alert-error">{saveError || errorLocal}</div>}

          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', marginBottom: 18, borderRadius: 10,
            background: activo ? 'rgba(22, 163, 74, 0.12)' : 'var(--color-bg)', border: `2px solid ${activo ? '#16a34a' : 'var(--color-border)'}`,
          }}>
            <input id="aviso-activo" type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} style={{ width: 20, height: 20 }} />
            <label htmlFor="aviso-activo" style={{ fontWeight: 700, cursor: 'pointer' }}>
              {activo ? 'ENCENDIDO: todos verán este aviso al entrar' : 'APAGADO: nadie ve el aviso todavía'}
            </label>
          </div>

          <div className="form-field">
            <label>Título</label>
            <input value={titulo} maxLength={TITULO_MAX} onChange={(e) => setTitulo(e.target.value)} />
          </div>

          <div className="form-field">
            <label>Mensaje</label>
            <textarea
              rows={18}
              maxLength={MENSAJE_MAX}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              style={{ fontFamily: 'inherit', lineHeight: 1.5 }}
            />
            <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--color-text-muted)' }}>{mensaje.length}/{MENSAJE_MAX}</div>
          </div>

          <details style={{ marginBottom: 16, fontSize: 13, color: 'var(--color-text-muted)' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>¿Cómo doy formato al mensaje?</summary>
            <ul style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.7 }}>
              <li>Una <strong>línea en blanco</strong> separa los párrafos.</li>
              <li><code>**texto**</code> deja el texto en <strong>negrita</strong>.</li>
              <li><code># Texto</code> crea un subtítulo.</li>
              <li><code>- Texto</code> crea viñetas, y <code>1. Texto</code> crea pasos numerados (uno por línea).</li>
              <li><code>!! Texto</code> crea una caja <strong>naranja</strong> de advertencia, <code>ok Texto</code> una caja <strong>verde</strong> y <code>info Texto</code> una caja <strong>azul</strong>.</li>
            </ul>
          </details>

          {activo && yaEncendido && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, fontSize: 13 }}>
              <input type="checkbox" checked={reenviar} onChange={(e) => setReenviar(e.target.checked)} />
              Mostrarlo de nuevo a quienes ya pulsaron "Entendido"
            </label>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setVista(true)} disabled={!mensaje.trim()}>
              Ver cómo se ve
            </button>
          </div>

          {guardado && !saveError && (
            <div style={{ color: 'var(--color-success)', fontSize: 13, marginTop: 12 }}>
              {activo ? 'Guardado: el aviso ya se muestra a todos.' : 'Guardado: el aviso está apagado.'}
            </div>
          )}
          <p style={{ color: 'var(--color-text-muted)', fontSize: 12, margin: '14px 0 0' }}>
            Quien pulsa "Entendido" no vuelve a ver el aviso, hasta que lo enciendas de nuevo. Los cambios del texto se aplican al instante para quienes todavía no lo han cerrado.
          </p>
        </form>
      )}

      {vista && (
        <AvisoActualizacionPantalla titulo={titulo.trim() || '(sin título)'} mensaje={mensaje} onEntendido={() => setVista(false)} />
      )}
    </Layout>
  );
}
