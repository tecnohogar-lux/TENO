import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '../api/client';

export default function useFetch(url, { enabled = true, deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const latestRequestId = useRef(0);

  const refetch = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const { data: response } = await apiClient.get(url);
      // Ignora la respuesta si mientras tanto se disparó una petición más nueva
      // (búsqueda con debounce, paginación rápida): evita que una respuesta
      // vieja que llega tarde sobrescriba datos más recientes en pantalla.
      if (requestId !== latestRequestId.current) return;
      setData(response);
    } catch (err) {
      if (requestId !== latestRequestId.current) return;
      setError(err.response?.data?.error || 'Error al cargar datos');
    } finally {
      if (requestId === latestRequestId.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (!enabled) return;
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { data, loading, error, refetch };
}
