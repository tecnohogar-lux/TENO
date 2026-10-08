import { create } from 'zustand';
import apiClient from '../api/client';
import { tokenExpiryMs, rememberSessionMessage, SESSION_EXPIRED_MESSAGE } from '../utils/session';

function loadStoredUser() {
  try {
    const raw = localStorage.getItem('teno_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Si el token guardado ya venció (ej. la pestaña estuvo cerrada pasadas las 3:00 AM), no se usa.
function loadValidToken() {
  const token = localStorage.getItem('teno_token');
  if (!token) return null;
  const exp = tokenExpiryMs(token);
  if (exp && exp <= Date.now()) {
    localStorage.removeItem('teno_token');
    localStorage.removeItem('teno_user');
    rememberSessionMessage(SESSION_EXPIRED_MESSAGE);
    return null;
  }
  return token;
}

const initialToken = loadValidToken();

const useAuthStore = create((set) => ({
  user: initialToken ? loadStoredUser() : null,
  token: initialToken,
  isAuthenticated: !!initialToken,
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

// Cierra la sesión en el momento exacto del vencimiento (los timers se atrasan si el equipo
// se suspende, por eso también se revisa al volver a la pestaña).
let expiryTimer = null;

function expireIfNeeded() {
  const { token, logout } = useAuthStore.getState();
  if (!token) return;
  const exp = tokenExpiryMs(token);
  if (exp && exp <= Date.now()) {
    rememberSessionMessage(SESSION_EXPIRED_MESSAGE);
    logout();
  }
}

function scheduleExpiry(token) {
  clearTimeout(expiryTimer);
  const exp = token ? tokenExpiryMs(token) : null;
  if (!exp) return;
  const wait = Math.min(Math.max(exp - Date.now(), 0), 2147483647);
  expiryTimer = setTimeout(expireIfNeeded, wait + 500);
}

scheduleExpiry(useAuthStore.getState().token);
useAuthStore.subscribe((state, prev) => {
  if (state.token !== prev.token) scheduleExpiry(state.token);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') expireIfNeeded();
});

export default useAuthStore;
