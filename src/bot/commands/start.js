// src/bot/commands/start.js
const { getUserByTelegramId, createUser, isDisplayNameTaken } = require('../../db/supabase');
const { generateToken } = require('../../middleware/auth');

const APP_URL = process.env.APP_URL || 'https://linkpulse.railway.app';
const stateStore = {}; // { telegramId: { state: 'awaiting_username', ... } }

async function handleStart(ctx) {
  const telegramId = ctx.from.id;
  const telegramUsername = ctx.from.username || 'usuario';

  try {
    // Verificar si ya está registrado
    const existingUser = await getUserByTelegramId(telegramId);

    if (existingUser) {
      // Usuario ya registrado → generar nuevo link de acceso
      const token = generateToken(existingUser.id, telegramId, existingUser.display_name);
      const loginUrl = `${APP_URL}/auth?token=${token}`;

      return ctx.reply(
        `✅ ¡Bienvenido de vuelta, @${existingUser.display_name}!\n\n` +
        `🔗 Accede a tu dashboard:\n` +
        `${loginUrl}\n\n` +
        `Este enlace es personal e intransferible.\n` +
        `Expira en 7 días.`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );
    }

    // Nuevo usuario → pedir display_name
    stateStore[telegramId] = { state: 'awaiting_username', telegramUsername };
    ctx.reply(
      `🎉 ¡Hola! Bienvenido a *LinkPulse*.\n\n` +
      `Para completar tu registro, elige un *display_name* único:\n\n` +
      `✅ Solo letras, números y guiones bajos (_)\n` +
      `✅ Mínimo 3 caracteres, máximo 20\n` +
      `✅ Ejemplo: \`mi_nombre\`, \`usuario123\`\n\n` +
      `Responde con tu display_name:`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('Error en /start:', err);
    ctx.reply('❌ Error al procesar tu solicitud. Intenta más tarde.');
  }
}

async function handleUsernameInput(ctx) {
  const telegramId = ctx.from.id;
  const displayName = ctx.message.text.trim();

  const state = stateStore[telegramId];
  if (!state || state.state !== 'awaiting_username') {
    return; // Ignorar si no estamos esperando username
  }

  // Validar formato
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(displayName)) {
    return ctx.reply(
      `❌ El display_name no es válido.\n\n` +
      `✅ Solo letras, números y guiones bajos\n` +
      `✅ Mínimo 3 caracteres, máximo 20\n\n` +
      `Intenta de nuevo:`
    );
  }

  try {
    // Verificar que no esté tomado
    if (await isDisplayNameTaken(displayName)) {
      return ctx.reply(
        `❌ El display_name *@${displayName}* ya está registrado.\n\n` +
        `Elige otro:`,
        { parse_mode: 'Markdown' }
      );
    }

    // Crear usuario
    const user = await createUser(telegramId, state.telegramUsername, displayName);
    delete stateStore[telegramId];

    // Generar token
    const token = generateToken(user.id, telegramId, displayName);
    const loginUrl = `${APP_URL}/auth?token=${token}`;

    ctx.reply(
      `✅ ¡Registro exitoso, @${displayName}!\n\n` +
      `🔗 Accede a tu dashboard:\n` +
      `${loginUrl}\n\n` +
      `Este enlace es personal e intransferible.\n` +
      `Expira en 7 días.`,
      { parse_mode: 'Markdown', disable_web_page_preview: true }
    );
  } catch (err) {
    console.error('Error registrando usuario:', err);
    ctx.reply('❌ Error al registrar. Intenta más tarde.');
    delete stateStore[telegramId];
  }
}

module.exports = {
  handleStart,
  handleUsernameInput,
};
