import { useState } from 'react';
import Layout from '../components/Layout';
import MetricsCard from '../components/MetricsCard';
import Badge from '../components/Badge';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import { formatDate } from '../utils/format';

// Las fechas llegan como 'YYYY-MM-DD'; se leen a mediodía UTC para que la zona horaria no cambie el día.
function nombreDia(fecha) {
  const d = new Date(`${fecha}T12:00:00Z`);
  const dia = new Intl.DateTimeFormat('es-CL', { weekday: 'long', timeZone: 'UTC' }).format(d);
  const fechaCorta = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(d);
  return { dia: dia.charAt(0).toUpperCase() + dia.slice(1), fechaCorta };
}

function horaChile(iso) {
  return new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' }).format(new Date(iso));
}

function resumenResultado(r) {
  if (!r) return '';
  const partes = [`${r.nuevas} nuevas`];
  if (r.editadas) partes.push(`${r.editadas} con día corregido`);
  if (!r.sinRevisar) partes.push(`${r.borradas} borradas`);
  return partes.join(' · ');
}

const ORIGEN = {
  envio: { label: 'Día del envío', color: 'var(--color-text-muted)' },
  descripcion: { label: 'Día escrito por el repartidor', color: 'var(--color-accent)' },
  manual: { label: 'Movida por admin', color: 'var(--color-warning)' },
};

function DetalleDia({ fecha, hoy, onCambio }) {
  const { data, loading, error, refetch } = useFetch(`/api/fotos-entregas/dia/${fecha}`);
  const { post, loading: moviendo, error: errorMover } = useApi();
  const [destino, setDestino] = useState({});

  async function mover(envio) {
    const clave = envio.ids[0];
    const nueva = destino[clave];
    if (!nueva || nueva === fecha) return;
    const r = await post('/api/fotos-entregas/mover', { ids: envio.ids, fecha: nueva });
    if (r.success) {
      setDestino((d) => ({ ...d, [clave]: '' }));
      refetch();
      onCambio();
    }
  }

  if (loading) return <div style={{ padding: 12, color: 'var(--color-text-muted)' }}>Cargando envíos...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data || data.envios.length === 0) return <div style={{ padding: 12, color: 'var(--color-text-muted)' }}>Sin fotos este día</div>;

  return (
    <div style={{ padding: '8px 0' }}>
      {errorMover && <div className="alert alert-error">{errorMover}</div>}
      <table className="responsive-stack" style={{ fontSize: 13 }}>
        <thead>
          <tr>
            <th>Enviado</th>
            <th>Repartidor</th>
            <th>Fotos</th>
            <th>Descripción</th>
            <th>Cuenta para este día por</th>
            <th>Mover a otro día</th>
          </tr>
        </thead>
        <tbody>
          {data.envios.map((e) => {
            const { dia, fechaCorta } = nombreDia(e.fecha_envio);
            const origen = ORIGEN[e.origen] || ORIGEN.envio;
            return (
              <tr key={e.ids[0]}>
                <td data-label="Enviado">{dia} {fechaCorta}, {horaChile(e.enviado_at)}</td>
                <td data-label="Repartidor">{e.enviado_por}</td>
                <td data-label="Fotos">{e.total}</td>
                <td data-label="Descripción" style={{ color: e.descripcion ? undefined : 'var(--color-text-muted)' }}>{e.descripcion || '—'}</td>
                <td data-label="Cuenta por"><Badge label={origen.label} color={origen.color} /></td>
                <td data-label="Mover">
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <input
                      type="date"
                      max={hoy}
                      value={destino[e.ids[0]] || ''}
                      onChange={(ev) => setDestino((d) => ({ ...d, [e.ids[0]]: ev.target.value }))}
                      style={{ padding: '4px 6px', fontSize: 12 }}
                    />
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      disabled={moviendo || !destino[e.ids[0]] || destino[e.ids[0]] === fecha}
                      onClick={() => mover(e)}
                    >
                      Mover
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function FotosEntregasPage() {
  const [filtro, setFiltro] = useState({ desde: '', hasta: '' });
  const query = new URLSearchParams(Object.entries(filtro).filter(([, v]) => v)).toString();
  const { data, loading, error, refetch } = useFetch(`/api/fotos-entregas${query ? `?${query}` : ''}`, { deps: [query] });
  const { post, loading: actualizando, error: errorActualizar } = useApi();
  const [abierto, setAbierto] = useState(null);
  const [revisando, setRevisando] = useState(null);
  const [aviso, setAviso] = useState('');

  async function actualizar(fecha = null) {
    setAviso('');
    setRevisando(fecha);
    const r = await post('/api/fotos-entregas/actualizar', fecha ? { fecha } : {});
    setRevisando(null);
    if (r.success) {
      setAviso(`Actualizado: ${resumenResultado(r.data)}`);
      refetch();
    }
  }

  const estado = data?.estado;
  const horasDesdeActualizacion = estado?.ultima_actualizacion
    ? (Date.now() - new Date(estado.ultima_actualizacion).getTime()) / 3600000
    : null;

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Fotos de entregas</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, fontSize: 13 }}>
            Fotos de paquetes entregados que los repartidores mandan al grupo de Telegram, por día.
            {estado?.ultima_actualizacion && (
              <> Última actualización: {formatDate(estado.ultima_actualizacion)} ({estado.origen === 'automatica' ? 'automática' : 'manual'}) · {resumenResultado(estado.resultado)}</>
            )}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => actualizar()} disabled={actualizando || data?.configurado === false}>
          {actualizando && !revisando ? 'Actualizando...' : '↻ Actualizar ahora'}
        </button>
      </div>

      {data && !data.configurado && (
        <div className="alert alert-error">
          El bot de Telegram no está configurado. Faltan las variables TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en el servidor.
        </div>
      )}
      {data?.configurado && horasDesdeActualizacion !== null && horasDesdeActualizacion > 20 && (
        <div className="alert alert-error">
          Hace más de {Math.floor(horasDesdeActualizacion)} horas que no se actualiza. Telegram guarda las fotos solo 24 horas:
          pulsa "Actualizar ahora" para no perder ninguna.
        </div>
      )}
      {errorActualizar && <div className="alert alert-error">{errorActualizar}</div>}
      {aviso && <div className="alert alert-success">{aviso}</div>}

      {data && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <MetricsCard label="Hoy" value={data.resumen.hoy} />
          <MetricsCard label="Últimos 7 días" value={data.resumen.semana} />
          <MetricsCard label="Este mes" value={data.resumen.mes} />
        </div>
      )}

      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label>Desde</label>
            <input type="date" value={filtro.desde} onChange={(e) => setFiltro((f) => ({ ...f, desde: e.target.value }))} />
          </div>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label>Hasta</label>
            <input type="date" value={filtro.hasta} onChange={(e) => setFiltro((f) => ({ ...f, hasta: e.target.value }))} />
          </div>
          {(filtro.desde || filtro.hasta) && (
            <button className="btn btn-secondary" onClick={() => setFiltro({ desde: '', hasta: '' })}>Últimos 30 días</button>
          )}
        </div>

        {loading && !data && (
          <div className="page-loading">
            <div className="spinner" />
          </div>
        )}
        {error && <div className="alert alert-error">{error}</div>}

        {data && (
          <table className="responsive-stack">
            <thead>
              <tr>
                <th>Día</th>
                <th>Fotos</th>
                <th>Enviadas tarde</th>
                <th>Por repartidor</th>
                <th style={{ width: 210 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.dias.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--color-text-muted)' }}>Sin fotos en este período</td>
                </tr>
              ) : (
                data.dias.map((d) => {
                  const { dia, fechaCorta } = nombreDia(d.fecha);
                  const esAbierto = abierto === d.fecha;
                  return [
                    <tr key={d.fecha}>
                      <td data-label="Día">
                        <strong>{dia}</strong> {fechaCorta}
                        {d.fecha === data.hoy && <span style={{ color: 'var(--color-text-muted)' }}> (hoy)</span>}
                      </td>
                      <td data-label="Fotos" style={{ fontWeight: 700, fontSize: 16 }}>{d.total}</td>
                      <td data-label="Enviadas tarde" style={{ color: d.tarde ? undefined : 'var(--color-text-muted)' }}>{d.tarde || '—'}</td>
                      <td data-label="Por repartidor" style={{ fontSize: 13 }}>
                        {d.personas.map((p) => `${p.nombre} ${p.total}`).join(' · ')}
                      </td>
                      <td data-label="Acciones">
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setAbierto(esAbierto ? null : d.fecha)}>
                            {esAbierto ? 'Ocultar' : 'Ver envíos'}
                          </button>
                          {data.revisaBorradas && (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', fontSize: 12 }}
                              disabled={actualizando}
                              title="Revisa si alguna foto de este día fue borrada del grupo"
                              onClick={() => actualizar(d.fecha)}
                            >
                              {revisando === d.fecha ? 'Revisando...' : 'Revisar borradas'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>,
                    esAbierto && (
                      <tr key={`${d.fecha}-detalle`}>
                        <td colSpan={5} style={{ background: 'var(--color-bg)' }}>
                          <DetalleDia fecha={d.fecha} hoy={data.hoy} onCambio={refetch} />
                        </td>
                      </tr>
                    ),
                  ];
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ padding: 20, fontSize: 13 }}>
        <h3 style={{ fontSize: 15, marginTop: 0 }}>Fotos enviadas otro día</h3>
        <p style={{ marginTop: 0 }}>
          Si un repartidor manda las fotos días después, debe escribir el día <strong>al inicio de la descripción</strong> de la foto
          (en un álbum basta con una). Por ejemplo, el miércoles manda las del lunes con la descripción <strong>lunes</strong>.
        </p>
        <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
          Se acepta: lunes … domingo (o lun, mar, mie, jue, vie, sab, dom), hoy, ayer, antier, o una fecha como 6/10.
          Hasta 7 días atrás. Si se le olvidó, puede editar la descripción de la foto, o un admin la mueve desde "Ver envíos".
        </p>
      </div>
    </Layout>
  );
}
