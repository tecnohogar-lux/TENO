// Middleware de autenticación
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  // Obtener token del header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  // Verificar token
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
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

module.exports = { authenticateToken, requireRole };