// Middleware de autenticación
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// El rol y el estado de la cuenta se leen de la base (con una caché corta) y no solo del token:
// así un usuario desactivado o con el rol cambiado pierde el acceso enseguida, sin esperar a que
// venza su token. Se invalida al editar/desactivar/eliminar usuarios.
const CACHE_MS = 15000;
const userCache = new Map();

function invalidateUserCache(id) {
  if (id === undefined) userCache.clear();
  else userCache.delete(Number(id));
}

async function loadActiveUser(id) {
  const cached = userCache.get(id);
  if (cached && cached.expires > Date.now()) return cached.user;

  const result = await pool.query('SELECT id, name, role, is_active FROM users WHERE id = $1', [id]);
  const user = result.rows[0] && result.rows[0].is_active ? result.rows[0] : null;
  userCache.set(id, { user, expires: Date.now() + CACHE_MS });
  return user;
}

const authenticateToken = (req, res, next) => {
  // Obtener token del header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  // Verificar token. Un token inválido o vencido responde 401 para que el frontend cierre la sesión.
  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Sesión vencida o inválida' });
    }
    try {
      const activeUser = await loadActiveUser(decoded.id);
      if (!activeUser) {
        return res.status(401).json({ error: 'Tu cuenta ya no está activa' });
      }
      req.user = { ...decoded, role: activeUser.role, name: activeUser.name };
      next();
    } catch (dbErr) {
      next(dbErr);
    }
  });
};

// Middleware factory: exige que req.user.role esté en la lista dada.
// Uso: requireRole(['admin', 'operador'], 'Mensaje de error opcional')
const requireRole = (roles, message = 'No tienes permiso para realizar esta acción') => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: message });
  }
  next();
};

module.exports = { authenticateToken, requireRole, invalidateUserCache };
