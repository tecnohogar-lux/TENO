import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizarTexto } from '../utils/texto';

// Selección múltiple para filtros: lista con casillas y buscador. Sin nada marcado significa "todos".
// options: [{ value, label }]. value: arreglo de values marcados (como texto). onChange(nuevoArreglo).
const MAX_VISIBLE = 150;

export default function MultiSelectFiltro({ value, onChange, options, todosLabel = 'Todos' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function fuera(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [open]);

  const marcados = useMemo(() => new Set(value.map(String)), [value]);
  const etiquetas = useMemo(() => new Map(options.map((o) => [String(o.value), o.label])), [options]);

  const filtradas = useMemo(() => {
    const q = normalizarTexto(query.trim());
    return q ? options.filter((o) => normalizarTexto(o.label).includes(q)) : options;
  }, [options, query]);

  function alternar(v) {
    const clave = String(v);
    onChange(marcados.has(clave) ? value.filter((x) => String(x) !== clave) : [...value, clave]);
  }

  // Texto del botón: los nombres marcados (hasta 2) y cuántos más hay.
  const nombres = value.map((v) => etiquetas.get(String(v)) ?? String(v));
  const resumen = nombres.length === 0
    ? todosLabel
    : nombres.length <= 2 ? nombres.join(', ') : `${nombres.slice(0, 2).join(', ')} +${nombres.length - 2}`;

  return (
    <div className="searchable-select" ref={containerRef}>
      <button
        type="button"
        className={`searchable-select-trigger multiselect-trigger${value.length === 0 ? ' placeholder' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title={nombres.join(', ')}
      >
        <span className="multiselect-resumen">{resumen}</span>
        {value.length > 0 && <span className="multiselect-contador">{value.length}</span>}
      </button>

      {open && (
        <div className="card searchable-select-dropdown multiselect-dropdown">
          {options.length > 8 && (
            <input
              autoFocus
              className="searchable-select-search-input"
              placeholder="Buscar..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <div className="multiselect-acciones">
            <button type="button" className="multiselect-link" onClick={() => onChange([])} disabled={value.length === 0}>
              Quitar selección
            </button>
            {query.trim() && filtradas.length > 0 && (
              <button
                type="button"
                className="multiselect-link"
                onClick={() => onChange([...new Set([...value.map(String), ...filtradas.map((o) => String(o.value))])])}
              >
                Marcar los {filtradas.length} que coinciden
              </button>
            )}
          </div>
          {filtradas.length === 0 ? (
            <div className="searchable-select-empty">Sin resultados</div>
          ) : (
            filtradas.slice(0, MAX_VISIBLE).map((opt) => (
              <label key={opt.value} className="searchable-select-option multiselect-opcion">
                <input type="checkbox" checked={marcados.has(String(opt.value))} onChange={() => alternar(opt.value)} />
                <span>{opt.label}</span>
              </label>
            ))
          )}
          {filtradas.length > MAX_VISIBLE && (
            <div className="searchable-select-empty">Mostrando {MAX_VISIBLE} de {filtradas.length}. Escribe para filtrar.</div>
          )}
        </div>
      )}
    </div>
  );
}
