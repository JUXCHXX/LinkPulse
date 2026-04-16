// src/bot/commands/mysites.js
const { getUserByTelegramId, getSitesByUserId } = require('../../db/supabase');

async function handleMySites(ctx) {
  try {
    const telegramId = ctx.from.id;
    const user = await getUserByTelegramId(telegramId);

    if (!user) {
      return ctx.reply('⚠️ Primero debes registrarte con /start');
    }

    const sites = await getSitesByUserId(user.id);

    if (sites.length === 0) {
      return ctx.reply(
        '📭 No tienes sitios registrados.\n\n' +
        'Usa `/addsite <nombre> <url> <privado|global>` para agregar uno.',
        { parse_mode: 'Markdown' }
      );
    }

    let msg = `🗂️ *Mis sitios (${sites.length})*\n\n`;

    for (const site of sites) {
      const visibility = site.visibility === 'global' ? '🌐 Global' : '🔒 Privado';
      const status = site.enabled ? '✅' : '❌';
      msg += `${status} *${site.name}*\n`;
      msg += `   🔗 ${site.url}\n`;
      msg += `   👁 ${visibility}\n\n`;
    }

    ctx.reply(msg, { parse_mode: 'Markdown', disable_web_page_preview: true });
  } catch (err) {
    console.error('Error en /mysites:', err);
    ctx.reply('❌ Error al obtener tus sitios.');
  }
}

module.exports = { handleMySites };
