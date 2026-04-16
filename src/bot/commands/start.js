// src/bot/commands/start.js
const { getUserByTelegramId, createUser, isDisplayNameTaken } = require('../../db/supabase');
const { generateToken } = require('../../middleware/auth');
const supabase = require('../../db/supabase').supabaseClient || require('@supabase/supabase-js').createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const APP_URL = process.env.APP_URL || 'https://linkpulse.railway.app';

/**
 * Maneja el comando /start
 * 1. Si usuario ya está registrado → envía link de acceso
 * 2. Si no → inicia flujo de registro (guarda en BD, no en memoria)
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
    console.log(`🆕 Nuevo usuario ${telegramId} - Iniciando registro en BD`);

    // Guardar estado en BD (en lugar de memoria)
    try {
      const { error } = await supabase
        .from('telegram_registration_state')
        .insert({
          telegram_id: telegramId,
          telegram_username: telegramUsername,
          state: 'awaiting_username',
          created_at: new Date(),
        });

      if (error) {
        console.error(`❌ Error guardando estado en BD:`, error.message);
        return ctx.reply(
          '❌ Error al iniciar registro. Por favor intenta de nuevo.'
        ).catch(() => {});
      }

      console.log(`📝 Estado de registro guardado en BD para usuario ${telegramId}`);
    } catch (stateErr) {
      console.error(`❌ Error inesperado guardando estado:`, stateErr.message);
      return ctx.reply(
        '❌ Error al iniciar registro. Por favor intenta de nuevo.'
      ).catch(() => {});
    }

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
      // Intentar limpiar estado de BD si falla envío
      supabase
        .from('telegram_registration_state')
        .delete()
        .eq('telegram_id', telegramId)
        .catch(() => {});

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
 * El estado se busca en BD (no en memoria volátil)
 */
async function handleUsernameInput(ctx) {
  const telegramId = ctx.from.id;
  const displayName = ctx.message.text.trim();

  try {
    // Buscar estado en BD (robusto, sobrevive reinicio)
    console.log(`🔍 Buscando estado en BD para usuario ${telegramId}`);

    const { data: stateData, error: stateError } = await supabase
      .from('telegram_registration_state')
      .select('*')
      .eq('telegram_id', telegramId)
      .eq('state', 'awaiting_username')
      .single();

    if (stateError || !stateData) {
      console.log(`⚠️ No hay estado de registro para usuario ${telegramId}`);
      // ✅ Feedback útil en lugar de ignorar silenciosamente
      return ctx.reply(
        '⚠️ Primero debes ejecutar /start para registrarte.'
      ).catch((err) => {
        console.error(`Error respondiendo a mensaje sin contexto:`, err.message);
      });
    }

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
      // Limpiar estado en BD
      await supabase
        .from('telegram_registration_state')
        .delete()
        .eq('telegram_id', telegramId)
        .catch(() => {});

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
      user = await createUser(telegramId, stateData.telegram_username, displayName);
      console.log(`✅ Usuario creado: ${user.id}`);
    } catch (createErr) {
      console.error(`❌ Error creando usuario en BD:`, createErr.message);
      // Limpiar estado en BD
      await supabase
        .from('telegram_registration_state')
        .delete()
        .eq('telegram_id', telegramId)
        .catch(() => {});

      return ctx.reply(
        '❌ Error al crear tu cuenta. Por favor intenta de nuevo con /start.'
      ).catch(() => {});
    }

    // ✅ Limpiar estado del registro en BD
    try {
      await supabase
        .from('telegram_registration_state')
        .delete()
        .eq('telegram_id', telegramId);
      console.log(`🗑️  Estado de registro limpiado para usuario ${telegramId}`);
    } catch (cleanErr) {
      console.warn(`⚠️  No se pudo limpiar estado:`, cleanErr.message);
      // No es crítico si falla la limpieza
    }

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
    // Intentar limpiar estado
    try {
      await supabase
        .from('telegram_registration_state')
        .delete()
        .eq('telegram_id', telegramId);
    } catch (cleanErr) {
      console.warn(`Error limpiando estado en catch:`, cleanErr.message);
    }

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
