import { useEffect, useRef } from 'react';
import { repreciarLineas } from '../utils/precioLinea';

// Un borrador recuperado puede traer precios de catálogo viejos (el catálogo pudo cambiar mientras la pestaña
// estaba minimizada). Cuando carga el catálogo, y solo la primera vez, vuelve a cotizar las líneas del borrador.
// `aplicar(fn)` debe actualizar las líneas del formulario con `fn(lineas)`.
export default function useRepreciarBorrador(restaurado, productos, aplicar) {
  const hecho = useRef(false);
  useEffect(() => {
    if (!restaurado || hecho.current || !productos) return;
    hecho.current = true;
    aplicar((lineas) => repreciarLineas(lineas, productos));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurado, productos]);
}
