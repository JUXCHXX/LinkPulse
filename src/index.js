// src/index.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { initBot, stopBot } = require('./bot/runtime');
const { startMonitor } = require('./monitor/checker');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const publicRoutes = require('./routes/public');
const { getBootContext, logError } = require('./utils/errors');

const PORT = process.env.PORT || 3000;
let httpServer = null;
let isShuttingDown = false;

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.warn(`[SHUTDOWN] Shutdown ya en progreso (recibido ${signal} nuevamente)`);
    return;
  }

  isShuttingDown = true;
  console.log(`\n⏹️  Recibido ${signal} - iniciando shutdown graceful...`);

  try {
    // ── Detener bot de Telegram ──
    try {
      stopBot();
    } catch (err) {
      logError('Error deteniendo bot en shutdown', err, getBootContext());
    }

    // ── Cerrar servidor HTTP ──
    if (httpServer) {
      httpServer.close(() => {
        console.log('[SHUTDOWN] Servidor HTTP cerrado');
      });

      // Forzar cierre si tarda más de 10s
      const forceCloseTimeout = setTimeout(() => {
        console.error('[SHUTDOWN] HTTP server no cerró en 10s, forzando exit');
        process.exit(1);
      }, 10000);

      forceCloseTimeout.unref();
    } else {
      process.exit(0);
    }
  } catch (err) {
    logError('Error fatal en graceful shutdown', err, getBootContext());
    process.exit(1);
  }
}

async function start() {
  // ── Inicializar Telegram Bot ──────────────────────────────────────────────────
  try {
    await initBot(process.env.TELEGRAM_BOT_TOKEN);
  } catch (err) {
    logError('Error crítico inicializando Telegram bot', err, getBootContext());
    // Continuar sin bot pero registrar el error
    console.warn('⚠️  Bot de Telegram desactivado - continuando con web');
  }

  // ── Inicializar Express ───────────────────────────────────────────────────────
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));

  // ── Rutas de API ──────────────────────────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api', apiRoutes);
  app.use('/api/public', publicRoutes);

  // ── SPA Fallback → Servir dashboard.html para todas las rutas no reconocidas ──
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  // ── Error handler para Express (debe ir al final) ──
  app.use((err, req, res, next) => {
    logError('Express error handler', err, {
      ...getBootContext(),
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    res.status(500).json({ error: 'Internal server error' });
  });

  httpServer = app.listen(PORT, () => {
    console.log(`\n🚀 LinkPulse v2 iniciado`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🔌 API:       http://localhost:${PORT}/api\n`);
  });

  httpServer.on('error', (err) => {
    logError('HTTP Server error', err, getBootContext());
  });

  // ── Iniciar Monitor ───────────────────────────────────────────────────────────
  try {
    startMonitor();
  } catch (err) {
    logError('Error inicializando monitor', err, getBootContext());
    // Continuar sin monitor pero registrar
    console.warn('⚠️  Monitor desactivado - la app funcionará sin auto-checks');
  }
}

/**
 * Global error handlers
 */
process.on('uncaughtException', (err) => {
  logError('[FATAL] Uncaught Exception', err, getBootContext());
  console.error('[FATAL] El proceso terminará en 1s');

  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason) => {
  logError('[FATAL] Unhandled Rejection', reason, getBootContext());
});

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

/**
 * Startup
 */
start().catch((err) => {
  logError('[FATAL] Error durante startup', err, getBootContext());
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});
