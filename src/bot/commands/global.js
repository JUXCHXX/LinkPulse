// src/bot/commands/global.js
const { getGlobalSites } = require('../../db/supabase');
const { escapeMarkdownV2 } = require('../../utils/markdown');

async function handleGlobal(ctx) {
  try {
    const sites = await getGlobalSites(10);

    if (sites.length === 0) {
      return ctx.reply('📭 No hay sitios globales registrados aún.');
    }

    let msg = '🌐 *Últimos sitios globales*\n\n';

    for (const site of sites) {
      // ✅ Escapar todos los valores
      const escapedName = escapeMarkdownV2(site.name);
      const escapedUrl = escapeMarkdownV2(site.url);
      const owner = site.users[0]?.display_name || 'anónimo';
      const escapedOwner = escapeMarkdownV2(owner);

      msg += `🔹 *${escapedName}*\n`;
      msg += `   📌 \`${escapedUrl}\`\n`;
      msg += `   👤 Dueño: @${escapedOwner}\n\n`;
    }

    ctx.reply(msg, {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    }).catch((err) => {
      console.error('Error enviando /global:', err.message);
      // Enviar sin parse_mode si falla
      ctx.reply(msg, { disable_web_page_preview: true }).catch(() => {});
    });
  } catch (err) {
    console.error('Error en /global:', err);
    ctx.reply('❌ Error al obtener sitios globales.').catch(() => {});
  }
}

module.exports = { handleGlobal };
