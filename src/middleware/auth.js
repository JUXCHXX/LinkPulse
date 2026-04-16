// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { getUserById } = require('../db/supabase');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
}

/**
 * Middleware para verificar JWT
 */
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      telegramId: decoded.telegramId,
      displayName: decoded.displayName,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/**
 * Generar JWT con duración configurable
 */
function generateToken(userId, telegramId, displayName) {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const token = jwt.sign(
    {
      userId,
      telegramId,
      displayName,
    },
    JWT_SECRET,
    { expiresIn }
  );
  return token;
}

/**
 * Rate limiter simple en memoria
 */
const rateLimitStore = {};

function rateLimit(key, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  if (!rateLimitStore[key]) {
    rateLimitStore[key] = { count: 0, resetAt: now + windowMs };
  }

  const record = rateLimitStore[key];

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }

  record.count++;

  if (record.count > maxRequests) {
    return false;
  }
  return true;
}

module.exports = {
  verifyJWT,
  generateToken,
  rateLimit,
};
