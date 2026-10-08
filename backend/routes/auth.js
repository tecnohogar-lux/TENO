// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const pool = require('../config/database');
const { nextSessionExpiry } = require('../utils/sessionExpiry');

// Frena la fuerza bruta de contraseñas: 10 intentos FALLIDOS cada 15 min por IP (los logins correctos no cuentan).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.' },
});

// ============================================
// LOGIN - Obtener token JWT
// ============================================
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar que email y password existan
    if (!email || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    // Buscar usuario en BD
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const user = result.rows[0];

    const validPassword = await bcryptjs.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Tu cuenta está desactivada' });
    }

    // Crear token JWT. La sesión vence a una hora fija del día (3:00 AM de Chile), no a las 24 h del login.
    const expiresAt = nextSessionExpiry();
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, exp: Math.floor(expiresAt.getTime() / 1000) },
      process.env.JWT_SECRET
    );

    // Respuesta exitosa
    res.json({
      message: 'Login exitoso',
      token,
      expires_at: expiresAt.toISOString(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ============================================
// VERIFICAR TOKEN (para debugging)
// ============================================
router.post('/verify-token', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true, user: decoded });

  } catch (err) {
    res.status(403).json({ error: 'Token inválido o expirado' });
  }
});

module.exports = router;