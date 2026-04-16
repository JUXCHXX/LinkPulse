// src/index.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { initBot, stopBot } = require('./bot/telegram');
const { startMonitor } = require('./monitor/checker');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const publicRoutes = require('./routes/public');

const PORT = process.env.PORT || 3000;

async function start() {
  // ── Inicializar Telegram Bot ──────────────────────────────────────────────────
  initBot(process.env.TELEGRAM_BOT_TOKEN);

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

  app.listen(PORT, () => {
    console.log(`\n🚀 LinkPulse v2 iniciado`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🔌 API:       http://localhost:${PORT}/api\n`);
  });

  // ── Iniciar Monitor ───────────────────────────────────────────────────────────
  startMonitor();

  // ── Graceful shutdown ─────────────────────────────────────────────────────────
  process.once('SIGINT', () => {
    console.log('\n⏹️  Apagando...');
    stopBot();
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    console.log('\n⏹️  Apagando...');
    stopBot();
    process.exit(0);
  });
}

start().catch((err) => {
  console.error('❌ Error durante el startup:', err);
  process.exit(1);
});
