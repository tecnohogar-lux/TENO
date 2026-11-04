import { useEffect, useRef, useState } from 'react';
import useAuth from './useAuth';
import { borrarBorrador, claveBorrador, guardarBorrador, leerBorrador } from '../utils/borradores';

// Igual que useState, pero el valor se guarda como borrador en la pestaña y se recupera si la página se recarga
// (por ejemplo cuando el teléfono descarta la pestaña al minimizar el navegador).
//  - `nombre`: identifica el borrador (por ejemplo 'delivery.form'); se separa por usuario.
//  - `inicial`: valor de un formulario vacío; cuando el estado vuelve a ser igual, el borrador se borra.
//  - `activo: false`: no lee ni guarda (por ejemplo mientras se edita un registro existente).
// Devuelve [valor, setValor, restaurado]; `restaurado` es true si el valor salió de un borrador.
export default function useBorrador(nombre, inicial, { activo = true } = {}) {
  const { user } = useAuth();
  const clave = claveBorrador(user?.id, nombre);
  const restaurado = useRef(false);
  const textoInicial = useRef(null);
  if (textoInicial.current === null) textoInicial.current = JSON.stringify(inicial);

  const [valor, setValor] = useState(() => {
    const guardado = activo ? leerBorrador(clave) : undefined;
    if (guardado === undefined) return inicial;
    restaurado.current = true;
    return guardado;
  });

  useEffect(() => {
    if (!activo) return;
    if (JSON.stringify(valor) === textoInicial.current) borrarBorrador(clave);
    else guardarBorrador(clave, valor);
  }, [valor, activo, clave]);

  return [valor, setValor, restaurado.current];
}
