// src/bot/commands/uptime.js
const { getUserByTelegramId, getSitesByUserId, getRecentChecks } = require('../../db/supabase');

async function handleUptime(ctx) {
  try {
    const telegramId = ctx.from.id;
    const user = await getUserByTelegramId(telegramId);

    if (!user) {
      return ctx.reply('⚠️ Primero debes registrarte con /start');
    }

    const sites = await getSitesByUserId(user.id);

    if (sites.length === 0) {
      return ctx.reply('📭 No tienes sitios registrados.');
    }

    let msg = '📊 *Estadísticas de uptime de tus sitios*\n\n';

    for (const site of sites) {
      const recentChecks = await getRecentChecks(100);
      const siteChecks = recentChecks.filter((c) => c.site_id === site.id);

      if (siteChecks.length === 0) {
        msg += `⚪ *${site.name}* — Sin datos\n`;
        continue;
      }

      const upCount = siteChecks.filter((c) => c.status === 'up').length;
      const uptimePct = ((upCount / siteChecks.length) * 100).toFixed(2);
      const avgLatency = Math.round(
        siteChecks
          .filter((c) => c.status === 'up')
          .reduce((sum, c) => sum + c.latency_ms, 0) / siteChecks.length
      );

      const icon = uptimePct >= 99 ? '🟢' : uptimePct >= 95 ? '🟡' : '🔴';
      msg += `${icon} *${site.name}*\n`;
      msg += `   └ Uptime: \`${uptimePct}%\` | Avg: \`${avgLatency}ms\`\n`;
    }

    ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Error en /uptime:', err);
    ctx.reply('❌ Error al obtener uptime.');
  }
}

module.exports = { handleUptime };
