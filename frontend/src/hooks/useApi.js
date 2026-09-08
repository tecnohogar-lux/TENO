import { useCallback, useState } from 'react';
import apiClient from '../api/client';

export default function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (method, url, body) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.request({ method, url, data: body });
      setLoading(false);
      return { success: true, data };
    } catch (err) {
      const message = err.response?.data?.error || 'Ocurrió un error inesperado';
      setError(message);
      setLoading(false);
      return { success: false, error: message };
    }
  }, []);

  return {
    loading,
    error,
    get: (url) => request('get', url),
    post: (url, body) => request('post', url, body),
    put: (url, body) => request('put', url, body),
    del: (url) => request('delete', url),
  };
}
