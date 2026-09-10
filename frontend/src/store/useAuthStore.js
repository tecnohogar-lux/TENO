import { create } from 'zustand';
import apiClient from '../api/client';

function loadStoredUser() {
  try {
    const raw = localStorage.getItem('teno_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const useAuthStore = create((set) => ({
  user: loadStoredUser(),
  token: localStorage.getItem('teno_token'),
  isAuthenticated: !!localStorage.getItem('teno_token'),
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await apiClient.post('/api/auth/login', { email, password });
      localStorage.setItem('teno_token', data.token);
      localStorage.setItem('teno_user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, isAuthenticated: true, loading: false });
      return { success: true, user: data.user };
    } catch (err) {
      const message = err.response?.data?.error || 'Error al iniciar sesión';
      set({ loading: false, error: message });
      return { success: false, error: message };
    }
  },

  logout: () => {
    localStorage.removeItem('teno_token');
    localStorage.removeItem('teno_user');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));

export default useAuthStore;
