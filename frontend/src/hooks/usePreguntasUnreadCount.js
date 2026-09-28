import { useCallback, useEffect, useState } from 'react';
import apiClient from '../api/client';

const POLL_MS = 20000;
const EVENT_NAME = 'preguntas:unread-changed';

// Cualquier página que responda una pregunta o marque las suyas como leídas llama esto
// para que la alerta del menú (en otro componente, con su propio estado) se actualice
// al instante en vez de esperar al siguiente sondeo.
export function notifyPreguntasChanged() {
  window.dispatchEvent(new Event(EVENT_NAME));
}

// Cantidad de preguntas "sin leer" para la alerta del menú: para un vendedor son
// respuestas suyas que aún no vio; para admin/operador/caja son preguntas sin responder.
// Se refresca sola cada 20s, y también al recibir el evento de notifyPreguntasChanged().
export default function usePreguntasUnreadCount(enabled) {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/api/preguntas/unread-count');
      setCount(data.count || 0);
    } catch {
      // silencioso: la alerta simplemente no se actualiza en este ciclo
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const interval = setInterval(load, POLL_MS);
    window.addEventListener(EVENT_NAME, load);
    return () => {
      clearInterval(interval);
      window.removeEventListener(EVENT_NAME, load);
    };
  }, [enabled, load]);

  return { count };
}
