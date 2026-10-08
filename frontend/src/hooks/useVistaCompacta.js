import { useState } from 'react';

// Vista completa o compacta de una lista. Se recuerda en el navegador (una clave por página).
export default function useVistaCompacta(storageKey) {
  const [compacta, setCompacta] = useState(() => {
    try { return localStorage.getItem(storageKey) === 'compacta'; } catch { return false; }
  });

  function cambiarVista(esCompacta) {
    setCompacta(esCompacta);
    try { localStorage.setItem(storageKey, esCompacta ? 'compacta' : 'completa'); } catch { /* sin almacenamiento: no se recuerda */ }
  }

  return [compacta, cambiarVista];
}
