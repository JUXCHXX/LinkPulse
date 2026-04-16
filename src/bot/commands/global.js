// src/bot/commands/global.js
const { getGlobalSites } = require('../../db/supabase');

async function handleGlobal(ctx) {
  try {
    const sites = await getGlobalSites(10);

    if (sites.length === 0) {
      return ctx.reply('📭 No hay sitios globales registrados aún.');
    }

    let msg = '🌐 *Últimos sitios globales*\n\n';

    for (const site of sites) {
      const owner = site.users[0]?.display_name || 'anónimo';
      msg += `🔹 *${site.name}*\n`;
      msg += `   📌 ${site.url}\n`;
      msg += `   👤 Dueño: @${owner}\n\n`;
    }

    ctx.reply(msg, { parse_mode: 'Markdown', disable_web_page_preview: true });
  } catch (err) {
    console.error('Error en /global:', err);
    ctx.reply('❌ Error al obtener sitios globales.');
  }
}

module.exports = { handleGlobal };
