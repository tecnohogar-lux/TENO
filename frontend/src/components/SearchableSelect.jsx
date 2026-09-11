import { useEffect, useMemo, useRef, useState } from 'react';

export default function SearchableSelect({
  value,
  onChange,
  options,
  pinnedOptions = [],
  placeholder = 'Selecciona...',
  disabled = false,
  required = false,
  name,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const allOptions = useMemo(() => [...pinnedOptions, ...options], [pinnedOptions, options]);
  const selected = allOptions.find((o) => String(o.value) === String(value));

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  function handleSelect(opt) {
    onChange(String(opt.value));
    setOpen(false);
    setQuery('');
  }

  function handleToggle() {
    if (disabled) return;
    setOpen((v) => !v);
  }

  return (
    <div className="searchable-select" ref={containerRef}>
      <button
        type="button"
        className={`searchable-select-trigger${!selected ? ' placeholder' : ''}`}
        onClick={handleToggle}
        disabled={disabled}
      >
        {selected ? selected.label : placeholder}
      </button>

      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          value={value || ''}
          onChange={() => {}}
          required
          style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
        />
      )}

      {open && !disabled && (
        <div className="card searchable-select-dropdown">
          <input
            ref={searchInputRef}
            autoFocus
            className="searchable-select-search-input"
            placeholder="Buscar..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {pinnedOptions.map((opt) => (
            <div key={opt.value} className="searchable-select-option" onClick={() => handleSelect(opt)}>
              {opt.label}
            </div>
          ))}
          {filtered.length === 0 ? (
            <div className="searchable-select-empty">Sin resultados</div>
          ) : (
            filtered.map((opt) => (
              <div key={opt.value} className="searchable-select-option" onClick={() => handleSelect(opt)}>
                {opt.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
