import { useEffect, useState } from 'react';

// true en pantallas de teléfono (mismo corte que el resto de la app: 768px).
export default function useIsMobile(query = '(max-width: 768px)') {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

// Cuántas noticias se muestran por pantalla: 8 en teléfono, 10 en computador.
export function useNoticiasPageSize() {
  return useIsMobile() ? 8 : 10;
}
