// Vencimiento de sesión: el token trae su fecha de vencimiento (claim `exp`, en segundos).

const MSG_KEY = 'teno_session_msg';

// Milisegundos (epoch) en que vence el token, o null si no se puede leer.
export function tokenExpiryMs(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload));
    return exp ? exp * 1000 : null;
  } catch {
    return null;
  }
}

// El motivo por el que se cerró la sesión se muestra en la pantalla de login.
export function rememberSessionMessage(message) {
  try { sessionStorage.setItem(MSG_KEY, message); } catch { /* sin sessionStorage: solo no hay aviso */ }
}

export function peekSessionMessage() {
  try { return sessionStorage.getItem(MSG_KEY); } catch { return null; }
}

export function clearSessionMessage() {
  try { sessionStorage.removeItem(MSG_KEY); } catch { /* nada que limpiar */ }
}

export const SESSION_EXPIRED_MESSAGE = 'Tu sesión venció (las sesiones se reinician todos los días a las 3:00 AM). Ingresa de nuevo para continuar.';
