// src/bot/commands/start.js
const { getUserByTelegramId, createUser, isDisplayNameTaken } = require('../../db/supabase');
const { generateToken } = require('../../middleware/auth');

const APP_URL = process.env.APP_URL || 'https://linkpulse.railway.app';

// ── Estado de registro en memoria con timeouts ──────────────────────────────
// Formato: { telegramId: { state: 'awaiting_username', telegramUsername, timestamp } }
const stateStore = {};
const STATE_TIMEOUT = 15 * 60 * 1000; // 15 minutos

/**
 * Limpia estados expirados cada 5 minutos
 */
setInterval(() => {
  const now = Date.now();
  for (const [telegramId, state] of Object.entries(stateStore)) {
    if (now - state.timestamp > STATE_TIMEOUT) {
      console.warn(`⏰ Estado de registro expirado para usuario ${telegramId}`);
      delete stateStore[telegramId];
    }
  }
}, 5 * 60 * 1000);

/**
 * Maneja el comando /start
 * 1. Si usuario ya está registrado → envía link de acceso
 * 2. Si no → inicia flujo de registro
 */
async function handleStart(ctx) {
  const telegramId = ctx.from.id;
  const telegramUsername = ctx.from.username || 'usuario';

  try {
    console.log(`▶️ /start ejecutado por usuario ${telegramId}`);

    // Verificar si ya está registrado
    let existingUser;
    try {
      existingUser = await getUserByTelegramId(telegramId);
    } catch (dbErr) {
      console.error(`❌ Error consultando usuario en BD (${telegramId}):`, dbErr.message);
      return ctx.reply(
        '❌ Error al acceder a la base de datos. Por favor intenta en unos momentos.'
      ).catch((replyErr) => {
        console.error(`❌ Error enviando mensaje de error:`, replyErr.message);
      });
    }

    if (existingUser) {
      // ✅ Usuario ya registrado → generar nuevo link de acceso
      console.log(`✅ Usuario ${telegramId} ya está registrado - Enviando link`);

      try {
        const token = generateToken(existingUser.id, telegramId, existingUser.display_name);
        const loginUrl = `${APP_URL}/auth?token=${token}`;

        return await ctx.reply(
          `✅ ¡Bienvenido de vuelta, @${existingUser.display_name}!\n\n` +
          `🔗 Accede a tu dashboard:\n` +
          `${loginUrl}\n\n` +
          `Este enlace es personal e intransferible.\n` +
          `Expira en 7 días.`,
          { parse_mode: 'MarkdownV2', disable_web_page_preview: true }
        );
      } catch (replyErr) {
        console.error(`❌ Error enviando link a usuario registrado (${telegramId}):`, replyErr.message);
        return ctx.reply(
          '❌ Error al generar tu link de acceso. Por favor intenta de nuevo con /start.'
        ).catch(() => {});
      }
    }

    // ✅ Nuevo usuario → iniciar flujo de registro
    console.log(`🆕 Nuevo usuario ${telegramId} - Iniciando registro`);

    // Guardar estado con timestamp
    stateStore[telegramId] = {
      state: 'awaiting_username',
      telegramUsername,
      timestamp: Date.now(),
    };

    // Enviar mensaje pidiendo display_name
    return await ctx.reply(
      `🎉 ¡Hola! Bienvenido a *LinkPulse*\\.\n\n` +
      `Para completar tu registro, elige un *display_name* único:\n\n` +
      `✅ Solo letras, números y guiones bajos \\(_\\)\n` +
      `✅ Mínimo 3 caracteres, máximo 20\n` +
      `✅ Ejemplo: \`mi_nombre\`, \`usuario123\`\n\n` +
      `Responde con tu display_name:`,
      { parse_mode: 'MarkdownV2' }
    ).catch((replyErr) => {
      console.error(`❌ Error pidiendo display_name (${telegramId}):`, replyErr.message);
      // Limpiar estado si falla envío
      delete stateStore[telegramId];
      return ctx.reply(
        '❌ Error al iniciar registro. Por favor intenta de nuevo con /start.'
      ).catch(() => {});
    });

  } catch (err) {
    console.error('❌ Error crítico en /start:', err);
    return ctx.reply(
      '❌ Error inesperado. Por favor intenta de nuevo con /start.'
    ).catch((replyErr) => {
      console.error(`❌ Error enviando respuesta de error:`, replyErr.message);
    });
  }
}

/**
 * Maneja mensajes de texto cuando se espera username
 * Valida display_name y crea usuario
 */
async function handleUsernameInput(ctx) {
  const telegramId = ctx.from.id;
  const displayName = ctx.message.text.trim();

  // Verificar que el usuario está en proceso de registro
  const state = stateStore[telegramId];
  if (!state || state.state !== 'awaiting_username') {
    // ✅ Feedback útil en lugar de ignorar silenciosamente
    return ctx.reply(
      '⚠️ Primero debes ejecutar /start para registrarte.'
    ).catch((err) => {
      console.error(`Error respondiendo a mensaje sin contexto:`, err.message);
    });
  }

  try {
    console.log(`▶️ Display name recibido: "${displayName}" (usuario ${telegramId})`);

    // Validar formato de display_name
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(displayName)) {
      console.log(`❌ Display name inválido: "${displayName}"`);
      return await ctx.reply(
        `❌ El display_name no es válido\\.\n\n` +
        `✅ Solo letras, números y guiones bajos\n` +
        `✅ Mínimo 3 caracteres, máximo 20\n\n` +
        `Intenta de nuevo:`,
        { parse_mode: 'MarkdownV2' }
      ).catch((replyErr) => {
        console.error(`Error respondiendo con rechazo de nombre:`, replyErr.message);
      });
    }

    // Verificar que no esté tomado
    let isTaken;
    try {
      isTaken = await isDisplayNameTaken(displayName);
    } catch (dbErr) {
      console.error(`Error verificando disponibilidad de display_name:`, dbErr.message);
      delete stateStore[telegramId];
      return ctx.reply(
        '❌ Error verificando disponibilidad. Por favor intenta de nuevo con /start.'
      ).catch(() => {});
    }

    if (isTaken) {
      console.log(`❌ Display name ya registrado: "${displayName}"`);
      return await ctx.reply(
        `❌ El display_name @${escapeForMarkdown(displayName)} ya está registrado\\.\n\n` +
        `Elige otro:`,
        { parse_mode: 'MarkdownV2' }
      ).catch((replyErr) => {
        console.error(`Error respondiendo con nombre duplicado:`, replyErr.message);
      });
    }

    // ✅ Crear usuario en BD
    let user;
    try {
      console.log(`📝 Creando usuario: display_name="${displayName}", telegram_id=${telegramId}`);
      user = await createUser(telegramId, state.telegramUsername, displayName);
      console.log(`✅ Usuario creado: ${user.id}`);
    } catch (createErr) {
      console.error(`❌ Error creando usuario en BD:`, createErr.message);
      delete stateStore[telegramId];
      return ctx.reply(
        '❌ Error al crear tu cuenta. Por favor intenta de nuevo con /start.'
      ).catch(() => {});
    }

    // Limpiar estado del registro
    delete stateStore[telegramId];

    // Generar token de acceso
    try {
      const token = generateToken(user.id, telegramId, displayName);
      const loginUrl = `${APP_URL}/auth?token=${token}`;

      console.log(`🔐 Token generado para usuario ${user.id}`);

      return await ctx.reply(
        `✅ ¡Registro exitoso, @${displayName}!\\n\\n` +
        `🔗 Accede a tu dashboard:\n` +
        `${loginUrl}\n\n` +
        `Este enlace es personal e intransferible\\.\n` +
        `Expira en 7 días\\.\n\n` +
        `Ahora puedes usar todos los comandos: /status, /mysites, /addsite, /uptime, /global, /help`,
        { parse_mode: 'MarkdownV2', disable_web_page_preview: true }
      ).catch((replyErr) => {
        console.error(`Error enviando confirmación de registro:`, replyErr.message);
        // El usuario está creado aunque falle el envío del link
        return ctx.reply(
          '⚠️ Usuario registrado, pero hubo un error enviando el link. Usa /start nuevamente.'
        ).catch(() => {});
      });

    } catch (tokenErr) {
      console.error(`❌ Error generando token:`, tokenErr.message);
      return ctx.reply(
        '❌ Error generando tu link de acceso. Por favor intenta con /start.'
      ).catch(() => {});
    }

  } catch (err) {
    console.error('❌ Error crítico en handleUsernameInput:', err);
    delete stateStore[telegramId];
    return ctx.reply(
      '❌ Error inesperado. Por favor intenta de nuevo con /start.'
    ).catch(() => {});
  }
}

/**
 * Escapa caracteres especiales para MarkdownV2
 */
function escapeForMarkdown(text) {
  return String(text).replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

module.exports = {
  handleStart,
  handleUsernameInput,
};
