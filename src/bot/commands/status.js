// src/bot/commands/status.js
const { getUserByTelegramId, getSitesByUserId, getLastCheck } = require('../../db/supabase');

async function handleStatus(ctx) {
  try {
    const telegramId = ctx.from.id;
    const user = await getUserByTelegramId(telegramId);

    if (!user) {
      return ctx.reply('⚠️ Primero debes registrarte con /start');
    }

    const sites = await getSitesByUserId(user.id);

    if (sites.length === 0) {
      return ctx.reply('📭 No tienes sitios registrados. Usa /addsite para agregar uno.');
    }

    let msg = '📡 *Estado actual de tus sitios*\n\n';

    for (const site of sites) {
      const lastCheck = await getLastCheck(site.id);

      if (!lastCheck) {
        msg += `⚪ *${site.name}* — Sin datos aún\n`;
      } else {
        const icon = lastCheck.status === 'up' ? '🟢' : '🔴';
        msg += `${icon} *${site.name}*\n`;
        msg += `   📌 ${site.url}\n`;
        msg += `   └ ${lastCheck.status.toUpperCase()} | HTTP ${lastCheck.http_code ?? 'N/A'} | ${lastCheck.latency_ms}ms\n`;
      }
    }

    ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Error en /status:', err);
    ctx.reply('❌ Error al obtener estado.');
  }
}

module.exports = { handleStatus };
