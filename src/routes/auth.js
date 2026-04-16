// src/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { verifyJWT, generateToken, rateLimit } = require('../middleware/auth');
const { getUserById } = require('../db/supabase');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * POST /api/auth/verify
 * Verificar token enviado desde la URL de login
 */
router.post('/verify', async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;

  // Rate limiting
  if (!rateLimit(clientIp, 10, 60000)) {
    return res.status(429).json({ error: 'Demasiados intentos. Intenta más tarde.' });
  }

  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token requerido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        displayName: user.display_name,
        telegramId: user.telegram_id,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
});

/**
 * GET /api/auth/me
 * Obtener datos del usuario autenticado
 */
router.get('/me', verifyJWT, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      id: user.id,
      displayName: user.display_name,
      telegramId: user.telegram_id,
      telegramUsername: user.telegram_username,
      createdAt: user.created_at,
      lastLogin: user.last_login,
    });
  } catch (err) {
    console.error('Error en GET /me:', err);
    res.status(500).json({ error: 'Error al obtener datos' });
  }
});

/**
 * POST /api/auth/refresh
 * Generar nuevo token (para renovar antes de expirar)
 */
router.post('/refresh', verifyJWT, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const newToken = generateToken(user.id, user.telegram_id, user.display_name);

    res.json({
      success: true,
      token: newToken,
    });
  } catch (err) {
    console.error('Error en POST /refresh:', err);
    res.status(500).json({ error: 'Error al renovar token' });
  }
});

module.exports = router;
