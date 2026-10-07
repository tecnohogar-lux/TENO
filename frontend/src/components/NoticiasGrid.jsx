import { useEffect, useState } from 'react';
import { formatCurrency, formatDate } from '../utils/format';
import { cambiosNoticia, encabezadoNoticia, tipoNoticia, tituloCorto, tituloNoticia } from '../utils/noticias';

// Íconos simples (24x24, trazo) para la franja de cada tipo de noticia.
const ICONS = {
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zm13-3a5 5 0 0 1 0 8m3-11a9 9 0 0 1 0 14',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zm7 12l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  alert: 'M12 4l9 16H3L12 4zm0 6v4m0 3v.01',
  check: 'M5 12l4.5 4.5L19 7',
  trash: 'M5 7h14M10 7V4h4v3m-8 0l1 13h8l1-13M10 11v6m4-6v6',
};

function Icon({ name }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name] || ICONS.megaphone} />
    </svg>
  );
}

function NoticiaCard({ n, open, onToggle, canManage, onEdit, onDelete }) {
  const info = tipoNoticia(n.tipo);
  const titulo = tituloNoticia(n);
  const recortado = !!titulo && tituloCorto(titulo) !== titulo;
  const cambios = cambiosNoticia(n, formatCurrency);
  const esManual = !info.encabezado || !titulo;

  function handleKey(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  }

  return (
    <div className={`noticia${open ? ' is-open' : ''}`} style={{ '--n-color': info.color }} data-noticia>
      <div
        className="noticia__card"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={handleKey}
      >
        <div className="noticia__band">
          <Icon name={info.icon} />
          <span>{info.tag}</span>
        </div>

        <div className="noticia__body">
          <div className={`noticia__headline${esManual ? ' noticia__headline--texto' : ''}`}>{encabezadoNoticia(n)}</div>
          {cambios.length > 0 && (
            <ul className="noticia__cambios">
              {cambios.map((c) => (
                <li key={c.campo} className={c.campo === 'precio' ? 'noticia__cambio noticia__cambio--precio' : 'noticia__cambio'}>{c.corto}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="noticia__extra">
          <div>
            <div className="noticia__detalle">
              {recortado && (
                <p><strong>Producto:</strong> {titulo}</p>
              )}
              {cambios.filter((c) => c.campo === 'titulo').map((c) => (
                <p key={c.campo}>{c.largo}</p>
              ))}
              <p className="noticia__autor">{n.created_by_name ? `Por ${n.created_by_name}` : 'Sistema'}</p>
              {canManage && (
                <div className="noticia__acciones">
                  {n.tipo === 'manual' && onEdit && (
                    <button type="button" className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); onEdit(n); }}>Editar</button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                      onClick={(e) => { e.stopPropagation(); onDelete(n); }}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="noticia__foot">{formatDate(n.created_at)}</div>
      </div>
    </div>
  );
}

// Tarjetas de noticias. En computador se abren al pasar el mouse; en teléfono (y con
// clic/Enter en cualquier pantalla) al tocarlas. Solo una abierta a la vez; tocar fuera la cierra.
export default function NoticiasGrid({ noticias, canManage = false, onEdit, onDelete }) {
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    if (openId === null) return undefined;
    function handleOutside(e) {
      if (!e.target.closest('[data-noticia]')) setOpenId(null);
    }
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [openId]);

  return (
    <div className="noticias-grid">
      {noticias.map((n) => (
        <NoticiaCard
          key={n.id}
          n={n}
          open={openId === n.id}
          onToggle={() => setOpenId((id) => (id === n.id ? null : n.id))}
          canManage={canManage}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
