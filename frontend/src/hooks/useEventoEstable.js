import { useCallback, useLayoutEffect, useRef } from 'react';

// Devuelve una función de identidad fija que siempre ejecuta la versión más reciente de `fn`.
// Sirve para pasar manejadores a componentes memorizados (React.memo) sin que se vuelvan a dibujar
// en cada render de la página.
export default function useEventoEstable(fn) {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args) => ref.current(...args), []);
}
