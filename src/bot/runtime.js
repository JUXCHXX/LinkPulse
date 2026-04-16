const { Telegraf } = require('telegraf');
const { analyzeTelegramError, validateMessage } = require('../utils/markdown');
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
let botHealthy = false;

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

/**
 * Inicializar bot con protecciones contra múltiples lanzamientos
 */
async function initBot(token) {
  if (!token || token.includes('xxxxxx')) {
    console.warn('TELEGRAM_BOT_TOKEN no configurado. Bot desactivado.');
    botHealthy = false;
    return null;
  }

  if (launchPromise) {
    console.warn('[TG launch] initBot invocado mas de una vez. Reutilizando instancia existente.', {
      bootId: BOOT_ID,
      pid: process.pid,
      isHealthy: botHealthy,
    });
    return await launchPromise;
  }

  try {
    if (!bot) {
      bot = new Telegraf(token);
      registerHandlers();
    }

    launchPromise = (async () => {
      try {
        await bot.launch();

        // Validación post-launch: intentar una operación básica
        try {
          const me = await bot.telegram.getMe();
          console.log('[TG launch] bot iniciado correctamente', {
            ...getBootContext(),
            botName: me.first_name,
            botUsername: me.username,
          });
          botHealthy = true;
          return bot;
        } catch (validateErr) {
          logError('Bot iniciado pero validación fallida', validateErr, getBootContext());
          botHealthy = false;
          return bot; // Continuar igualmente
        }
      } catch (launchErr) {
        botHealthy = false;
        logError('Error iniciando bot Telegram', launchErr, {
          ...getBootContext(),
          telegramError: analyzeTelegramError(launchErr),
        });
        throw launchErr;
      }
    })().catch((err) => {
      logError('Promise de launch del bot rechazada', err, {
        ...getBootContext(),
        telegramError: analyzeTelegramError(err),
      });
      bot = null;
      launchPromise = null;
      handlersRegistered = false;
      botHealthy = false;
      throw err;
    });

    return await launchPromise;
  } catch (err) {
    logError('Fallo durante initBot', err, getBootContext());
    bot = null;
    launchPromise = null;
    handlersRegistered = false;
    botHealthy = false;
    throw err;
  }
}

async function sendAlertToUser(telegramId, message) {
  if (!bot || !botHealthy) {
    console.warn('Bot no inicializado o no está healthy. No se puede enviar alerta.');
    return false;
  }

  if (!telegramId || !message) {
    console.error('sendAlertToUser: telegramId o message vacios');
    return false;
  }

  try {
    const validation = validateMessage(message, 'MarkdownV2');
    if (!validation.isValid && validation.warnings.length > 0) {
      console.warn('Advertencias en mensaje de alerta:', validation.warnings);
    }

    await bot.telegram.sendMessage(String(telegramId), message, {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    });

    return true;
  } catch (err) {
    const analysis = analyzeTelegramError(err);

    logError(`Error enviando alerta a ${telegramId}`, err, {
      telegramId,
      telegramError: analysis,
    });

    if (analysis.isMarkdownError) {
      try {
        await bot.telegram.sendMessage(String(telegramId), message, {
          disable_web_page_preview: true,
        });
        return true;
      } catch (retryErr) {
        logError(`Reintento de alerta sin parse_mode fallo para ${telegramId}`, retryErr, {
          telegramId,
        });
      }
    }

    return false;
  }
}

async function sendDirectMessage(telegramId, message, options = {}) {
  if (!bot || !botHealthy || !telegramId || !message) {
    return false;
  }

  try {
    await bot.telegram.sendMessage(String(telegramId), message, {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
      ...options,
    });
    return true;
  } catch (err) {
    logError(`Error en sendDirectMessage (${telegramId})`, err, { telegramId });
    return false;
  }
}

function getBot() {
  return bot;
}

function isBotHealthy() {
  return bot !== null && botHealthy;
}

function stopBot() {
  if (!bot) {
    launchPromise = null;
    handlersRegistered = false;
    botHealthy = false;
    return;
  }

  const currentBot = bot;
  bot = null;
  launchPromise = null;
  handlersRegistered = false;
  botHealthy = false;

  try {
    currentBot.stop('SIGTERM');
    console.log('[TG stop] bot detenido', getBootContext());
  } catch (err) {
    logError('Error deteniendo bot', err, getBootContext());
  }
}

module.exports = {
  initBot,
  sendAlertToUser,
  sendDirectMessage,
  getBot,
  isBotHealthy,
  stopBot,
};
