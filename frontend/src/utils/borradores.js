// Borradores de formularios (delivery, regiones, retiro en tienda, caja): se guardan en sessionStorage mientras
// se llenan, para que no se pierdan si el navegador del teléfono descarta la pestaña al minimizarla.
// sessionStorage sobrevive a la recarga de la pestaña pero no a cerrarla, y cada borrador lleva el id del usuario.
const PREFIJO = 'teno_borrador:';
const VIGENCIA_MS = 12 * 60 * 60 * 1000;

export function claveBorrador(userId, nombre) {
  return `${PREFIJO}${userId ?? 'anon'}:${nombre}`;
}

// Devuelve el valor guardado, o undefined si no hay (o venció).
export function leerBorrador(clave) {
  try {
    const raw = sessionStorage.getItem(clave);
    if (!raw) return undefined;
    const { v, t } = JSON.parse(raw);
    if (!t || Date.now() - t > VIGENCIA_MS) {
      sessionStorage.removeItem(clave);
      return undefined;
    }
    return v;
  } catch {
    return undefined; // sin sessionStorage o dato dañado: se parte de cero
  }
}

export function guardarBorrador(clave, valor) {
  try { sessionStorage.setItem(clave, JSON.stringify({ v: valor, t: Date.now() })); } catch { /* sin almacenamiento: no se guarda */ }
}

export function borrarBorrador(clave) {
  try { sessionStorage.removeItem(clave); } catch { /* nada que borrar */ }
}

// Al cerrar sesión no queda ningún borrador (pueden llevar datos de clientes).
export function borrarTodosLosBorradores() {
  try {
    Object.keys(sessionStorage).filter((k) => k.startsWith(PREFIJO)).forEach((k) => sessionStorage.removeItem(k));
  } catch { /* nada que borrar */ }
}
