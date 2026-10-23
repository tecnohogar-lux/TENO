import { useEffect, useState } from 'react';
import apiClient from '../api/client';
import useAuth from '../hooks/useAuth';
import AvisoActualizacionPantalla from './AvisoActualizacionPantalla';

// Aviso de actualización para todos los usuarios, a pantalla completa, al entrar al sistema.
// El admin escribe el título y el mensaje y lo enciende o apaga en Administración → Avisos (claves
// aviso_actualizacion_* en /api/settings), sin publicar una versión nueva. Cada vez que se enciende recibe un identificador nuevo: quien ya pulsó
// "Entendido" no lo vuelve a ver hasta el siguiente aviso.
const CLAVE_VISTO = 'teno_aviso_visto';

function yaLoVio(id) {
  try { return localStorage.getItem(CLAVE_VISTO) === id; } catch { return false; }
}

function marcarVisto(id) {
  try { localStorage.setItem(CLAVE_VISTO, id); } catch { /* sin almacenamiento: se muestra de nuevo al recargar */ }
}

export default function AvisoActualizacion() {
  const { isAuthenticated, logout } = useAuth();
  const [aviso, setAviso] = useState(null); // { id, titulo, mensaje } cuando hay un aviso activo que falta ver

  useEffect(() => {
    if (!isAuthenticated) { setAviso(null); return undefined; }
    let cancelado = false;

    function revisar() {
      apiClient.get('/api/settings')
        .then(({ data }) => {
          if (cancelado) return;
          const activo = data.aviso_actualizacion_activo === '1';
          const id = data.aviso_actualizacion_id || '';
          const mensaje = (data.aviso_actualizacion_mensaje || '').trim();
          setAviso(activo && id && mensaje && !yaLoVio(id)
            ? { id, titulo: data.aviso_actualizacion_titulo || 'Aviso importante', mensaje }
            : null);
        })
        .catch(() => {}); // si el sistema ya está caído, no hay nada que mostrar
    }

    revisar();
    // También al volver a la pestaña, para quien la dejó abierta.
    const alVolver = () => { if (document.visibilityState === 'visible') revisar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { cancelado = true; document.removeEventListener('visibilitychange', alVolver); };
  }, [isAuthenticated]);

  if (!aviso) return null;

  return (
    <AvisoActualizacionPantalla
      titulo={aviso.titulo}
      mensaje={aviso.mensaje}
      onEntendido={() => { marcarVisto(aviso.id); setAviso(null); }}
      onCerrarSesion={() => { marcarVisto(aviso.id); setAviso(null); logout(); }}
    />
  );
}
