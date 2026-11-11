import { useEffect, useMemo, useRef, useState } from 'react';

// Pagina en pantalla una lista que ya está cargada completa (Delivery Santiago, Envíos a regiones).
// Dibujar cientos de filas de una vez dejaba lentísimo el iPhone, así que solo se muestran `porPagina` por página.
// La búsqueda, los filtros y la selección siguen usando la lista completa.
//  - `reiniciarCon`: valores que, al cambiar (búsqueda, filtros), devuelven a la página 1.
// Devuelve { pagina, totalPaginas, visibles, irA }.
export default function usePaginaLocal(items, porPagina, reiniciarCon = []) {
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    setPagina(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, reiniciarCon);

  const totalPaginas = Math.max(Math.ceil(items.length / porPagina), 1);
  // Si la lista se acorta (por ejemplo, se elimina el último envío de la página), no queda una página vacía.
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = useMemo(
    () => items.slice((paginaActual - 1) * porPagina, paginaActual * porPagina),
    [items, paginaActual, porPagina]
  );

  // Al cambiar de página con Anterior / Siguiente se vuelve arriba, pero recién cuando ya se dibujó la página nueva
  // (si se hace antes, el navegador reajusta el scroll al cambiar el contenido y queda a mitad de la lista).
  const subirAlCambiar = useRef(false);
  useEffect(() => {
    if (!subirAlCambiar.current) return;
    subirAlCambiar.current = false;
    window.scrollTo({ top: 0 });
  }, [paginaActual]);

  function irA(nueva) {
    subirAlCambiar.current = true;
    setPagina(nueva);
  }

  return { pagina: paginaActual, totalPaginas, visibles, irA };
}
