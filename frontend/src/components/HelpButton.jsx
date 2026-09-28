import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FAQ, TUTORIALES } from '../data/ayudaVendedores';

// Minúsculas y sin tildes, para que "comision" encuentre "comisión".
const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Respuesta({ texto }) {
  const lineas = texto.split('\n');
  const bloques = [];
  let viñetas = [];
  const cerrarViñetas = () => {
    if (viñetas.length) {
      bloques.push(<ul key={`u${bloques.length}`}>{viñetas.map((v, i) => <li key={i}>{v}</li>)}</ul>);
      viñetas = [];
    }
  };
  lineas.forEach((l) => {
    if (l.startsWith('- ')) viñetas.push(l.slice(2));
    else {
      cerrarViñetas();
      bloques.push(<p key={`p${bloques.length}`}>{l}</p>);
    }
  });
  cerrarViñetas();
  return <div className="help-answer">{bloques}</div>;
}

// Botón flotante + panel de ayuda con preguntas frecuentes y tutoriales (para vendedores).
export default function HelpButton() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('preguntas');
  const [query, setQuery] = useState('');
  const [abierta, setAbierta] = useState(null);
  const [tutorial, setTutorial] = useState(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [tab, tutorial, query]);

  const q = normalizar(query.trim());

  const categorias = useMemo(() => {
    if (!q) return FAQ;
    return FAQ
      .map((c) => ({
        ...c,
        preguntas: c.preguntas.filter((p) => normalizar(`${p.q} ${p.a} ${p.palabras || ''} ${c.categoria}`).includes(q)),
      }))
      .filter((c) => c.preguntas.length > 0);
  }, [q]);

  const tutoriales = useMemo(() => {
    if (!q) return TUTORIALES;
    return TUTORIALES.filter((t) => normalizar(`${t.titulo} ${t.resumen} ${t.intro} ${t.pasos.join(' ')} ${t.despues}`).includes(q));
  }, [q]);

  const totalPreguntas = categorias.reduce((n, c) => n + c.preguntas.length, 0);

  function close() {
    setOpen(false);
  }

  function irAlModulo(ruta) {
    setOpen(false);
    navigate(ruta);
  }

  return (
    <>
      <button type="button" className="help-fab" onClick={() => setOpen(true)} aria-label="Abrir ayuda" title="Ayuda">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.2.9-1.2 1.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="17" r="1.1" fill="currentColor" />
        </svg>
        <span className="help-fab-label">Ayuda</span>
      </button>

      {open && (
        <>
          <div className="help-overlay" onClick={close} />
          <aside className="help-panel" role="dialog" aria-modal="true" aria-label="Centro de ayuda">
            <div className="help-header">
              <div>
                <h2>Centro de ayuda</h2>
                <p>Resuelve tus dudas sobre tu cuenta y el sistema.</p>
              </div>
              <button type="button" className="help-close" onClick={close} aria-label="Cerrar ayuda">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            </div>

            <div className="help-search">
              <input
                type="search"
                placeholder="Busca tu duda (ej: comisión, retiro, contraseña)"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setTutorial(null); }}
              />
            </div>

            {!tutorial && (
              <div className="help-tabs" role="tablist">
                <button type="button" role="tab" aria-selected={tab === 'preguntas'} className={tab === 'preguntas' ? 'active' : ''} onClick={() => setTab('preguntas')}>
                  Preguntas{q ? ` (${totalPreguntas})` : ''}
                </button>
                <button type="button" role="tab" aria-selected={tab === 'tutoriales'} className={tab === 'tutoriales' ? 'active' : ''} onClick={() => setTab('tutoriales')}>
                  Tutoriales{q ? ` (${tutoriales.length})` : ''}
                </button>
              </div>
            )}

            <div className="help-body" ref={bodyRef}>
              {tutorial ? (
                <div>
                  <button type="button" className="help-back" onClick={() => setTutorial(null)}>← Volver a tutoriales</button>
                  <h3 className="help-tut-title">{tutorial.titulo}</h3>
                  <p className="help-muted">{tutorial.intro}</p>
                  <ol className="help-steps">
                    {tutorial.pasos.map((paso, i) => {
                      const esParte = /^PARTE [AB]:/.test(paso);
                      return esParte ? (
                        <li key={i} className="help-part">{paso}</li>
                      ) : (
                        <li key={i}>{paso}</li>
                      );
                    })}
                  </ol>
                  <div className="help-note"><strong>Después:</strong> {tutorial.despues}</div>
                  <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={() => irAlModulo(tutorial.ir.ruta)}>
                    {tutorial.ir.texto}
                  </button>
                </div>
              ) : tab === 'preguntas' ? (
                categorias.length === 0 ? (
                  <p className="help-muted">No encontré nada con "{query}". Prueba con otra palabra o consulta con tu operador o el administrador.</p>
                ) : (
                  categorias.map((c) => (
                    <section key={c.categoria} className="help-section">
                      <h3>{c.categoria}</h3>
                      {c.preguntas.map((p) => {
                        const id = `${c.categoria}|${p.q}`;
                        const expandida = abierta === id || (q && categorias.length > 0 && totalPreguntas <= 3);
                        return (
                          <div key={id} className={`help-item${expandida ? ' open' : ''}`}>
                            <button type="button" aria-expanded={expandida} onClick={() => setAbierta(abierta === id ? null : id)}>
                              <span>{p.q}</span>
                              <svg className="help-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </button>
                            {expandida && <Respuesta texto={p.a} />}
                          </div>
                        );
                      })}
                    </section>
                  ))
                )
              ) : tutoriales.length === 0 ? (
                <p className="help-muted">No encontré tutoriales con "{query}".</p>
              ) : (
                tutoriales.map((t) => (
                  <button key={t.id} type="button" className="help-tut-card" onClick={() => setTutorial(t)}>
                    <strong>{t.titulo}</strong>
                    <span>{t.resumen}</span>
                  </button>
                ))
              )}
            </div>

            <div className="help-footer">¿No encontraste tu respuesta? Consulta con tu operador o con el administrador.</div>
          </aside>
        </>
      )}
    </>
  );
}
