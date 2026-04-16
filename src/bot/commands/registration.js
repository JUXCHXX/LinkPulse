const {
  normalizeTelegramId,
  getUserByTelegramId,
  createUser,
  isDisplayNameTaken,
  upsertRegistrationState,
  getRegistrationState,
  clearRegistrationState,
} = require('../../db/supabase');
const { generateToken } = require('../../middleware/auth');
const { logError } = require('../../utils/errors');

const APP_URL = process.env.APP_URL || 'https://linkpulse.railway.app';

function getUpdateMeta(ctx, extra = {}) {
  return {
    userId: ctx?.from?.id ?? null,
    chatId: ctx?.chat?.id ?? null,
    updateId: ctx?.update?.update_id ?? null,
    messageText: ctx?.message?.text ?? null,
    ...extra,
  };
}

async function replyPlain(ctx, text, options = {}, extra = {}) {
  try {
    return await ctx.reply(text, options);
  } catch (err) {
    logError('Telegram reply failed', err, getUpdateMeta(ctx, extra));
    return null;
  }
}

function buildLoginUrl(token) {
  return `${APP_URL}/auth?token=${token}`;
}

function buildWelcomeBackMessage(displayName, loginUrl) {
  return [
    `Bienvenido de vuelta, @${displayName}`,
    '',
    'Accede a tu dashboard:',
    loginUrl,
    '',
    'Este enlace es personal e intransferible.',
    'Expira en 7 dias.',
  ].join('\n');
}

function buildRegistrationPromptMessage() {
  return [
    'Hola. Bienvenido a LinkPulse.',
    '',
    'Para completar tu registro, elige un display_name unico:',
    '',
    'Solo letras, numeros y guiones bajos (_)',
    'Minimo 3 caracteres, maximo 20',
    'Ejemplo: mi_nombre, usuario123',
    '',
    'Responde con tu display_name:',
  ].join('\n');
}

function buildRegistrationSuccessMessage(displayName, loginUrl) {
  return [
    `Registro exitoso, @${displayName}`,
    '',
    'Accede a tu dashboard:',
    loginUrl,
    '',
    'Este enlace es personal e intransferible.',
    'Expira en 7 dias.',
    '',
    'Ahora puedes usar: /status, /mysites, /addsite, /uptime, /global y /help',
  ].join('\n');
}

function isUniqueViolation(err) {
  return err?.code === '23505';
}

function isTelegramIdConflict(err) {
  return isUniqueViolation(err) && String(err.details || err.message || '').includes('telegram_id');
}

function isDisplayNameConflict(err) {
  return isUniqueViolation(err) && String(err.details || err.message || '').includes('display_name');
}

async function clearRegistrationStateQuietly(telegramId, ctx, reason) {
  try {
    await clearRegistrationState(telegramId);
  } catch (err) {
    logError('Failed to clear registration state', err, getUpdateMeta(ctx, { reason }));
  }
}

async function resolveExistingUserAfterConflict(telegramId) {
  try {
    return await getUserByTelegramId(telegramId);
  } catch {
    return null;
  }
}

async function handleStart(ctx) {
  const telegramId = normalizeTelegramId(ctx.from.id);
  const telegramUsername = ctx.from.username || 'usuario';

  try {
    console.log(`[/start] user=${telegramId}`);

    let existingUser;
    try {
      existingUser = await getUserByTelegramId(telegramId);
    } catch (err) {
      logError('Error consultando usuario en /start', err, getUpdateMeta(ctx));
      return await replyPlain(
        ctx,
        'Error al acceder a la base de datos. Por favor intenta en unos momentos.',
        {},
        { messageKind: 'start:db-error' }
      );
    }

    if (existingUser) {
      await clearRegistrationStateQuietly(telegramId, ctx, 'existing-user-start');

      try {
        const token = generateToken(existingUser.id, telegramId, existingUser.display_name);
        const loginUrl = buildLoginUrl(token);

        return await replyPlain(
          ctx,
          buildWelcomeBackMessage(existingUser.display_name, loginUrl),
          { disable_web_page_preview: true },
          { messageKind: 'start:returning-user' }
        );
      } catch (err) {
        logError('Error generando o enviando link en /start', err, getUpdateMeta(ctx));
        return await replyPlain(
          ctx,
          'Error al generar tu link de acceso. Por favor intenta de nuevo con /start.',
          {},
          { messageKind: 'start:login-link-error' }
        );
      }
    }

    try {
      await upsertRegistrationState(telegramId, telegramUsername);
      console.log(`[/start] state persisted user=${telegramId}`);
    } catch (err) {
      logError('Error persistiendo estado de registro', err, getUpdateMeta(ctx));
      return await replyPlain(
        ctx,
        'Error al iniciar registro. Por favor intenta de nuevo.',
        {},
        { messageKind: 'start:state-error' }
      );
    }

    const promptResult = await replyPlain(
      ctx,
      buildRegistrationPromptMessage(),
      {},
      { messageKind: 'start:prompt' }
    );

    if (!promptResult) {
      await clearRegistrationStateQuietly(telegramId, ctx, 'prompt-send-failure');
    }

    return promptResult;
  } catch (err) {
    logError('Error critico en /start', err, getUpdateMeta(ctx));
    return await replyPlain(
      ctx,
      'Error inesperado. Por favor intenta de nuevo con /start.',
      {},
      { messageKind: 'start:unexpected-error' }
    );
  }
}

async function handleUsernameInput(ctx) {
  const telegramId = normalizeTelegramId(ctx.from.id);
  const displayName = ctx.message.text.trim();

  try {
    let stateData;
    try {
      stateData = await getRegistrationState(telegramId);
    } catch (err) {
      logError('Error consultando estado de registro', err, getUpdateMeta(ctx));
      return await replyPlain(
        ctx,
        'Error consultando tu registro. Por favor intenta de nuevo con /start.',
        {},
        { messageKind: 'username:state-read-error' }
      );
    }

    if (!stateData) {
      return await replyPlain(
        ctx,
        'Primero debes ejecutar /start para registrarte.',
        {},
        { messageKind: 'username:no-state' }
      );
    }

    console.log(`[/username] user=${telegramId} display_name="${displayName}"`);

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(displayName)) {
      return await replyPlain(
        ctx,
        [
          'El display_name no es valido.',
          '',
          'Solo letras, numeros y guiones bajos (_)',
          'Minimo 3 caracteres, maximo 20',
          '',
          'Intenta de nuevo:',
        ].join('\n'),
        {},
        { messageKind: 'username:invalid-format' }
      );
    }

    let taken;
    try {
      taken = await isDisplayNameTaken(displayName);
    } catch (err) {
      logError('Error verificando disponibilidad de display_name', err, getUpdateMeta(ctx));
      return await replyPlain(
        ctx,
        'Error verificando disponibilidad. Intenta de nuevo en unos momentos o usa /start.',
        {},
        { messageKind: 'username:availability-error' }
      );
    }

    if (taken) {
      return await replyPlain(
        ctx,
        `El display_name @${displayName} ya esta registrado.\n\nElige otro:`,
        {},
        { messageKind: 'username:taken' }
      );
    }

    let user;
    try {
      user = await createUser(telegramId, stateData.telegram_username, displayName);
      console.log(`[/username] user created id=${user.id} telegram=${telegramId}`);
    } catch (err) {
      logError('Error creando usuario de registro', err, getUpdateMeta(ctx, { displayName }));

      if (isDisplayNameConflict(err)) {
        return await replyPlain(
          ctx,
          `El display_name @${displayName} acaba de ser tomado por otro usuario.\n\nElige otro:`,
          {},
          { messageKind: 'username:race-conflict' }
        );
      }

      if (isTelegramIdConflict(err)) {
        const existingUser = await resolveExistingUserAfterConflict(telegramId);
        if (existingUser) {
          await clearRegistrationStateQuietly(telegramId, ctx, 'telegram-id-conflict');
          const token = generateToken(existingUser.id, telegramId, existingUser.display_name);
          const loginUrl = buildLoginUrl(token);

          return await replyPlain(
            ctx,
            buildWelcomeBackMessage(existingUser.display_name, loginUrl),
            { disable_web_page_preview: true },
            { messageKind: 'username:telegram-id-conflict' }
          );
        }
      }

      return await replyPlain(
        ctx,
        'Error al crear tu cuenta. Por favor intenta de nuevo con /start.',
        {},
        { messageKind: 'username:create-error' }
      );
    }

    await clearRegistrationStateQuietly(telegramId, ctx, 'registration-complete');

    try {
      const token = generateToken(user.id, telegramId, displayName);
      const loginUrl = buildLoginUrl(token);

      return await replyPlain(
        ctx,
        buildRegistrationSuccessMessage(displayName, loginUrl),
        { disable_web_page_preview: true },
        { messageKind: 'username:success' }
      );
    } catch (err) {
      logError('Error generando o enviando link tras registro', err, getUpdateMeta(ctx));
      return await replyPlain(
        ctx,
        'Usuario registrado, pero hubo un error enviando el link. Usa /start nuevamente.',
        {},
        { messageKind: 'username:token-error' }
      );
    }
  } catch (err) {
    logError('Error critico en handleUsernameInput', err, getUpdateMeta(ctx));
    return await replyPlain(
      ctx,
      'Error inesperado. Por favor intenta de nuevo con /start.',
      {},
      { messageKind: 'username:unexpected-error' }
    );
  }
}

module.exports = {
  handleStart,
  handleUsernameInput,
};
