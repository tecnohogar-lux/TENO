import { useEffect, useState } from 'react';

// Caja de búsqueda que solo busca al pulsar "Buscar" o Enter (no letra por letra): evita lanzar una
// consulta por cada letra mientras se escribe una palabra. `value` es la búsqueda que ya está aplicada y
// `onSearch(texto)` se llama al buscar o al limpiar (texto vacío).
export default function BuscadorConBoton({ value, onSearch, placeholder, width = 260, loading = false }) {
  const [texto, setTexto] = useState(value);

  // Si la búsqueda aplicada cambia desde fuera (p. ej. se reinicia), la caja la refleja.
  useEffect(() => { setTexto(value); }, [value]);

  function enviar(e) {
    e.preventDefault();
    const limpio = texto.trim();
    if (limpio !== value) onSearch(limpio);
  }

  function limpiar() {
    setTexto('');
    if (value !== '') onSearch('');
  }

  return (
    <form onSubmit={enviar} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        placeholder={placeholder}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        enterKeyHint="search"
        style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', width, maxWidth: '100%', background: 'var(--color-surface)', color: 'var(--color-text)' }}
      />
      <button type="submit" className="btn btn-primary" disabled={loading}>Buscar</button>
      {(value || texto) && (
        <button type="button" className="btn btn-secondary" onClick={limpiar}>Limpiar</button>
      )}
    </form>
  );
}
