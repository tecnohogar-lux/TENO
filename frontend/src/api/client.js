import axios from 'axios';
import { rememberSessionMessage, SESSION_EXPIRED_MESSAGE } from '../utils/session';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('teno_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Un 401 fuera del login = la sesión venció o la cuenta ya no está activa: se cierra y se avisa en el login.
    const esLogin = String(error.config?.url || '').includes('/api/auth/login');
    if (error.response?.status === 401 && !esLogin) {
      const motivo = error.response.data?.error;
      rememberSessionMessage(motivo && !/vencida|inválida/i.test(motivo) ? motivo : SESSION_EXPIRED_MESSAGE);
      localStorage.removeItem('teno_token');
      localStorage.removeItem('teno_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
