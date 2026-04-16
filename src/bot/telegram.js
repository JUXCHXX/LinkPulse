// src/bot/telegram.js
const { Telegraf } = require('telegraf');
const {
  escapeMarkdownV2,
  analyzeTelegramError,
  validateMessage,
} = require('../utils/markdown');
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

    // ── Configurar error handlers ──────────────────────────────────────

    // Manejar errores no capturados del bot
    bot.catch((err, ctx) => {
      console.error('❌ Error no capturado en bot Telegraf:', {
        message: err.message,
        code: err.code,
        userId: ctx?.from?.id,
        command: ctx?.message?.text,
      });

      // Intentar enviar un mensaje de error al usuario
      if (ctx) {
        try {
          ctx.reply('❌ Ha ocurrido un error. Por favor intenta de nuevo.', {
            reply_to_message_id: ctx.message?.message_id,
          }).catch((replyErr) => {
            console.error('No se pudo enviar mensaje de error:', replyErr.message);
          });
        } catch (e) {
          // Silenciar si no se puede responder
        }
      }
    });

    // ── Registrar comandos ─────────────────────────────────────────────

    // Comando /start — registro y login
    bot.command('start', (ctx) => {
      handleStart(ctx).catch((err) => {
        console.error('Error en /start:', err);
        ctx.reply('❌ Error procesando comando. Intenta de nuevo.').catch(() => {});
      });
    });

    // Comando /status — estado de sitios
    bot.command('status', (ctx) => {
      handleStatus(ctx).catch((err) => {
        console.error('Error en /status:', err);
        ctx.reply('❌ Error al obtener estado.').catch(() => {});
      });
    });

    // Comando /uptime — estadísticas
    bot.command('uptime', (ctx) => {
      handleUptime(ctx).catch((err) => {
        console.error('Error en /uptime:', err);
        ctx.reply('❌ Error al obtener estadísticas.').catch(() => {});
      });
    });

    // Comando /global — sitios públicos
    bot.command('global', (ctx) => {
      handleGlobal(ctx).catch((err) => {
        console.error('Error en /global:', err);
        ctx.reply('❌ Error al obtener sitios públicos.').catch(() => {});
      });
    });

    // Comando /mysites — mis sitios
    bot.command('mysites', (ctx) => {
      handleMySites(ctx).catch((err) => {
        console.error('Error en /mysites:', err);
        ctx.reply('❌ Error al obtener tus sitios.').catch(() => {});
      });
    });

    // Comando /addsite — agregar sitio
    bot.command('addsite', (ctx) => {
      handleAddSite(ctx).catch((err) => {
        console.error('Error en /addsite:', err);
        ctx.reply('❌ Error al agregar sitio.').catch(() => {});
      });
    });

    // Comando /help — ayuda
    bot.command('help', (ctx) => {
      handleHelp(ctx).catch((err) => {
        console.error('Error en /help:', err);
        ctx.reply('❌ Error al mostrar ayuda.').catch(() => {});
      });
    });

    // Capturar mensajes de texto para completar registro
    bot.on('text', (ctx) => {
      handleUsernameInput(ctx).catch((err) => {
        console.error('Error procesando entrada de texto:', err);
        ctx.reply('❌ Error procesando tu mensaje.').catch(() => {});
      });
    });

    bot.launch();
    console.log('🤖 Bot de Telegram iniciado correctamente.');
    return bot;
  } catch (err) {
    console.error('❌ Error iniciando bot Telegram:', err.message);
    return null;
  }
}

/**
 * Enviar alerta a usuario específico (CRÍTICO - Usar con seguridad)
 * @param {number} telegramId - ID de Telegram del usuario
 * @param {string} message - Mensaje a enviar (ya escapado)
 * @returns {Promise<boolean>} - true si fue exitoso, false si falló
 */
async function sendAlertToUser(telegramId, message) {
  if (!bot) {
    console.warn('⚠️ Bot no inicializado - no se puede enviar alerta');
    return false;
  }

  if (!telegramId || !message) {
    console.error('❌ sendAlertToUser: telegramId o message vacíos');
    return false;
  }

  try {
    // Validar mensaje antes de enviar
    const validation = validateMessage(message, 'MarkdownV2');
    if (!validation.isValid && validation.warnings.length > 0) {
      console.warn('⚠️  Advertencias en mensaje:', validation.warnings);
    }

    // Enviar con MarkdownV2 (más seguro)
    await bot.telegram.sendMessage(telegramId, message, {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    });

    return true;
  } catch (err) {
    const analysis = analyzeTelegramError(err);

    console.error(`❌ Error enviando alerta a ${telegramId}:`, {
      type: analysis.type,
      isMarkdownError: analysis.isMarkdownError,
      message: analysis.description,
      fullError: err.message,
    });

    // Si es error de Markdown, reintentar sin parse_mode
    if (analysis.isMarkdownError) {
      try {
        console.log(`🔄 Reintentando alerta sin parse_mode...`);
        await bot.telegram.sendMessage(telegramId, message, {
          disable_web_page_preview: true,
        });
        return true;
      } catch (retryErr) {
        console.error(`❌ Reintento también falló:`, retryErr.message);
      }
    }

    return false;
  }
}

/**
 * Enviar mensaje directo con Telegram (para uso interno)
 * @param {number} telegramId - ID de Telegram
 * @param {string} message - Mensaje (ya escapado/seguro)
 * @param {object} options - Opciones adicionales para sendMessage
 * @returns {Promise<boolean>}
 */
async function sendDirectMessage(telegramId, message, options = {}) {
  if (!bot || !telegramId || !message) {
    return false;
  }

  try {
    await bot.telegram.sendMessage(telegramId, message, {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
      ...options,
    });
    return true;
  } catch (err) {
    console.error(`❌ Error en sendDirectMessage (${telegramId}):`, err.message);
    return false;
  }
}

function getBot() {
  return bot;
}

function stopBot() {
  if (bot) {
    try {
      bot.stop('SIGTERM');
      console.log('🛑 Bot de Telegram detenido.');
    } catch (err) {
      console.error('Error deteniendo bot:', err.message);
    }
  }
}

module.exports = {
  initBot,
  sendAlertToUser,
  sendDirectMessage,
  getBot,
  stopBot,
};
