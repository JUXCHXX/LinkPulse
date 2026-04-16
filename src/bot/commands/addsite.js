// src/bot/commands/addsite.js
const { getUserByTelegramId, addSite } = require('../../db/supabase');
const axios = require('axios');

async function handleAddSite(ctx) {
  try {
    const telegramId = ctx.from.id;
    const user = await getUserByTelegramId(telegramId);

    if (!user) {
      return ctx.reply('⚠️ Primero debes registrarte con /start');
    }

    // Parsear: /addsite <nombre> <url> <privado|global>
    const args = ctx.message.text.split(' ').slice(1);

    if (args.length < 3) {
      return ctx.reply(
        '📌 Uso: `/addsite <nombre> <url> <privado|global>`\n\n' +
        'Ejemplos:\n' +
        '`/addsite Mi Blog https://miblog.com global`\n' +
        '`/addsite Mi API https://api.com privado`',
        { parse_mode: 'Markdown' }
      );
    }

    const name = args[0];
    const url = args[1];
    const visibility = args[2].toLowerCase() === 'global' ? 'global' : 'private';

    // Validar URL
    try {
      new URL(url);
    } catch {
      return ctx.reply(`❌ La URL "${url}" no es válida.`);
    }

    // Validar que sea accesible (HEAD request rápido)
    try {
      await axios.head(url, { timeout: 5000 });
    } catch (err) {
      // No es critical si falla, solo es una validación
      console.warn(`⚠️ URL no respondió a HEAD: ${url}`);
    }

    // Agregar sitio a Supabase
    const site = await addSite(user.id, name, url, visibility);

    ctx.reply(
      `✅ Sitio agregado exitosamente\n\n` +
      `📌 Nombre: *${name}*\n` +
      `🔗 URL: \`${url}\`\n` +
      `👁 Visibilidad: *${visibility === 'global' ? '🌐 Global' : '🔒 Privado'}*\n` +
      `🕐 Agregado: ${new Date().toLocaleString('es-CO')}\n\n` +
      `El monitoreo comenzará en el próximo ciclo.`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('Error en /addsite:', err);
    ctx.reply('❌ Error al agregar sitio. Intenta más tarde.');
  }
}

module.exports = { handleAddSite };
