import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import useFetch from '../hooks/useFetch';
import useApi from '../hooks/useApi';
import useAuth from '../hooks/useAuth';
import { notifyPreguntasChanged } from '../hooks/usePreguntasUnreadCount';
import { formatDate } from '../utils/format';

export default function PreguntasPage() {
  const { user } = useAuth();
  const isVendedor = user.role === 'vendedor';
  const { data, loading, error, refetch } = useFetch('/api/preguntas');
  const { post, loading: sending, error: sendError } = useApi();
  const { put: putRespuesta, loading: answering } = useApi();
  const { put: putMarcarLeidas } = useApi();
  const [nuevaPregunta, setNuevaPregunta] = useState('');
  const [respuestas, setRespuestas] = useState({});

  // Al abrir el módulo, el vendedor apaga su propia alerta (respuestas ya vistas).
  useEffect(() => {
    if (isVendedor) {
      putMarcarLeidas('/api/preguntas/marcar-leidas').then(() => notifyPreguntasChanged());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAsk(e) {
    e.preventDefault();
    if (!nuevaPregunta.trim()) return;
    const result = await post('/api/preguntas', { pregunta: nuevaPregunta.trim() });
    if (result.success) {
      setNuevaPregunta('');
      refetch();
    }
  }

  async function handleAnswer(id) {
    const texto = (respuestas[id] || '').trim();
    if (!texto) return;
    const result = await putRespuesta(`/api/preguntas/${id}/responder`, { respuesta: texto });
    if (result.success) {
      setRespuestas((prev) => ({ ...prev, [id]: '' }));
      refetch();
      notifyPreguntasChanged();
    }
  }

  const preguntas = data?.preguntas || [];

  return (
    <Layout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Preguntas</h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, fontSize: 13 }}>
          {isVendedor
            ? 'Escribe tu pregunta a un operador o admin. Solo tú puedes ver tus preguntas y respuestas.'
            : 'Preguntas de los vendedores. Escribe la respuesta y pulsa Responder.'}
        </p>
      </div>

      {isVendedor && (
        <form onSubmit={handleAsk} className="card" style={{ padding: 20, marginBottom: 24 }}>
          {sendError && <div className="alert alert-error">{sendError}</div>}
          <div className="form-field">
            <label>Tu pregunta</label>
            <textarea rows={3} value={nuevaPregunta} onChange={(e) => setNuevaPregunta(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={sending || !nuevaPregunta.trim()}>
            {sending ? 'Enviando...' : 'Enviar pregunta'}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {preguntas.length === 0 ? (
            <div className="card" style={{ padding: 20, color: 'var(--color-text-muted)' }}>
              {isVendedor ? 'Aún no has hecho ninguna pregunta.' : 'No hay preguntas registradas.'}
            </div>
          ) : (
            preguntas.map((p) => (
              <div key={p.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {!isVendedor && <strong style={{ color: 'var(--color-text)' }}>{p.vendedor_name}</strong>}
                    {!isVendedor && ' · '}
                    {formatDate(p.created_at)}
                  </div>
                  {!p.respuesta && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Sin responder
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: p.respuesta || !isVendedor ? 12 : 0 }}>{p.pregunta}</div>

                {p.respuesta ? (
                  <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                      Respuesta de {p.respondida_por_name} · {formatDate(p.respondida_at)}
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.5 }}>{p.respuesta}</div>
                  </div>
                ) : !isVendedor ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <textarea
                      rows={2}
                      placeholder="Escribe tu respuesta..."
                      value={respuestas[p.id] || ''}
                      onChange={(e) => setRespuestas((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ flexShrink: 0 }}
                      onClick={() => handleAnswer(p.id)}
                      disabled={answering || !(respuestas[p.id] || '').trim()}
                    >
                      Responder
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}
    </Layout>
  );
}
