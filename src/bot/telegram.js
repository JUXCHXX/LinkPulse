// src/bot/telegram.js
const { Telegraf } = require('telegraf');
const {
  analyzeTelegramError,
  validateMessage,
} = require('../utils/markdown');
const { BOOT_ID, getBootContext, logError } = require('../utils/errors');
const { handleStart, handleUsernameInput } = require('./commands/registration');
const { handleStatus } = require('./commands/status');
const { handleUptime } = require('./commands/uptime');
const { handleGlobal } = require('./commands/global');
const { handleAddSite } = require('./commands/addsite');
const { handleMySites } = require('./commands/mysites');
const { handleHelp } = require('./commands/help');

let bot = null;
let launchPromise = null;
let handlersRegistered = false;

function getUpdateMeta(ctx, extra = {}) {
  return getBootContext({
    updateId: ctx?.update?.update_id ?? null,
    userId: ctx?.from?.id ?? null,
    chatId: ctx?.chat?.id ?? null,
    messageText: ctx?.message?.text ?? null,
    ...extra,
  });
}

async function safeReply(ctx, text, options = {}, extra = {}) {
  if (!ctx) {
    return null;
  }

  try {
    return await ctx.reply(text, options);
  } catch (err) {
    logError('Telegram reply failed in bot middleware', err, getUpdateMeta(ctx, extra));
    return null;
  }
}

function registerCommand(command, handler, fallbackText) {
  bot.command(command, async (ctx) => {
    try {
      return await handler(ctx);
    } catch (err) {
      logError(`Error en /${command}`, err, getUpdateMeta(ctx, { command }));
      return await safeReply(ctx, fallbackText, {}, { command, stage: 'command-fallback' });
    }
  });
}

function registerHandlers() {
  if (!bot || handlersRegistered) {
    return;
  }

  bot.use(async (ctx, next) => {
    if (ctx?.message?.text) {
      console.log('[TG update]', getUpdateMeta(ctx));
    }

    return await next();
  });

  bot.catch(async (err, ctx) => {
    logError('Error no capturado en bot Telegraf', err, {
      ...getUpdateMeta(ctx),
      telegramError: analyzeTelegramError(err),
    });

    await safeReply(
      ctx,
      'Ha ocurrido un error. Por favor intenta de nuevo.',
      { reply_to_message_id: ctx?.message?.message_id },
      { stage: 'bot.catch' }
    );
  });

  registerCommand('start', handleStart, 'Error procesando /start. Intenta de nuevo.');
  registerCommand('status', handleStatus, 'Error al obtener estado.');
  registerCommand('uptime', handleUptime, 'Error al obtener estadisticas.');
  registerCommand('global', handleGlobal, 'Error al obtener sitios publicos.');
  registerCommand('mysites', handleMySites, 'Error al obtener tus sitios.');
  registerCommand('addsite', handleAddSite, 'Error al agregar sitio.');
  registerCommand('help', handleHelp, 'Error al mostrar ayuda.');

  bot.on('text', async (ctx) => {
    try {
      return await handleUsernameInput(ctx);
    } catch (err) {
      logError('Error procesando entrada de texto', err, getUpdateMeta(ctx, { stage: 'bot.on(text)' }));
      return await safeReply(
        ctx,
        'Error procesando tu mensaje.',
        {},
        { stage: 'text-fallback' }
      );
    }
  });

  handlersRegistered = true;
}

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

module.exports = require('./runtime');
