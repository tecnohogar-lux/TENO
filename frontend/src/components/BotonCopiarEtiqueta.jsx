import { useEffect, useRef, useState } from 'react';
import { copiarAlPortapapeles } from '../utils/etiquetaTexto';

// Botón "Copiar al portapapeles": copia la etiqueta como texto plano. `obtenerTexto` arma el texto al pulsar.
export default function BotonCopiarEtiqueta({ obtenerTexto, className = 'btn btn-secondary', style }) {
  const [estado, setEstado] = useState(null); // null | 'ok' | 'error'
  const temporizador = useRef(null);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  async function copiar() {
    const ok = await copiarAlPortapapeles(obtenerTexto());
    setEstado(ok ? 'ok' : 'error');
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setEstado(null), 2000);
  }

  return (
    <button type="button" className={className} style={{ padding: '6px 10px', fontSize: 12, ...style }} onClick={copiar}>
      {estado === 'ok' ? '¡Copiado!' : estado === 'error' ? 'No se pudo copiar' : 'Copiar al portapapeles'}
    </button>
  );
}
