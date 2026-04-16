// src/bot/commands/mysites.js
const { getUserByTelegramId, getSitesByUserId } = require('../../db/supabase');
const { escapeMarkdownV2 } = require('../../utils/markdown');

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
        { parse_mode: 'MarkdownV2' }
      );
    }

    let msg = `🗂️ *Mis sitios \\(${sites.length}\\)*\n\n`;

    for (const site of sites) {
      // ✅ Escapar todos los valores
      const escapedName = escapeMarkdownV2(site.name);
      const escapedUrl = escapeMarkdownV2(site.url);

      const visibility = site.visibility === 'global' ? '🌐 Global' : '🔒 Privado';
      const status = site.enabled ? '✅' : '❌';
      msg += `${status} *${escapedName}*\n`;
      msg += `   🔗 \`${escapedUrl}\`\n`;
      msg += `   👁 ${visibility}\n\n`;
    }

    ctx.reply(msg, {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    }).catch((err) => {
      console.error('Error enviando /mysites:', err.message);
      // Enviar sin parse_mode si falla
      ctx.reply(msg, { disable_web_page_preview: true }).catch(() => {});
    });
  } catch (err) {
    console.error('Error en /mysites:', err);
    ctx.reply('❌ Error al obtener tus sitios.').catch(() => {});
  }
}

module.exports = { handleMySites };
