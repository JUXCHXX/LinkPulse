// src/bot/telegram.js
const { Telegraf } = require('telegraf');
const { handleStart, handleUsernameInput } = require('./commands/start');
const { handleStatus } = require('./commands/status');
const { handleUptime } = require('./commands/uptime');
const { handleGlobal } = require('./commands/global');
const { handleAddSite } = require('./commands/addsite');
const { handleMySites } = require('./commands/mysites');
const { handleHelp } = require('./commands/help');

let bot = null;

function initBot(token) {
  if (!token || token.includes('xxxxxx')) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN no configurado — bot desactivado.');
    return null;
  }

  try {
    bot = new Telegraf(token);

    // Comando /start — registro y login
    bot.command('start', handleStart);

    // Comando /status — estado de sitios
    bot.command('status', handleStatus);

    // Comando /uptime — estadísticas
    bot.command('uptime', handleUptime);

    // Comando /global — sitios públicos
    bot.command('global', handleGlobal);

    // Comando /mysites — mis sitios
    bot.command('mysites', handleMySites);

    // Comando /addsite — agregar sitio
    bot.command('addsite', handleAddSite);

    // Comando /help — ayuda
    bot.command('help', handleHelp);

    // Capturar mensajes de texto para completar registro
    bot.on('text', handleUsernameInput);

    bot.launch();
    console.log('🤖 Bot de Telegram iniciado correctamente.');
    return bot;
  } catch (err) {
    console.error('❌ Error iniciando bot Telegram:', err.message);
    return null;
  }
}

/**
 * Enviar alerta a usuario específico
 */
async function sendAlertToUser(telegramId, message) {
  if (!bot) return;
  try {
    await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error(`❌ Error enviando alerta a ${telegramId}:`, err.message);
  }
}

function getBot() {
  return bot;
}

function stopBot() {
  if (bot) {
    bot.stop('SIGTERM');
  }
}

module.exports = {
  initBot,
  sendAlertToUser,
  getBot,
  stopBot,
};
