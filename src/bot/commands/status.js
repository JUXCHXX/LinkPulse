// src/bot/commands/status.js
const { getUserByTelegramId, getSitesByUserId, getLastCheck } = require('../../db/supabase');
const { escapeMarkdownV2 } = require('../../utils/markdown');

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

      // ✅ Escapar todos los valores
      const escapedName = escapeMarkdownV2(site.name);
      const escapedUrl = escapeMarkdownV2(site.url);

      if (!lastCheck) {
        msg += `⚪ *${escapedName}* — Sin datos aún\n`;
      } else {
        const icon = lastCheck.status === 'up' ? '🟢' : '🔴';
        msg += `${icon} *${escapedName}*\n`;
        msg += `   📌 \`${escapedUrl}\`\n`;
        msg += `   └ ${lastCheck.status.toUpperCase()} \\| HTTP ${lastCheck.http_code ?? 'N/A'} \\| ${lastCheck.latency_ms}ms\n`;
      }
    }

    ctx.reply(msg, {
      parse_mode: 'MarkdownV2',
    }).catch((err) => {
      console.error('Error enviando /status:', err.message);
      // Enviar sin parse_mode si falla
      ctx.reply(msg).catch(() => {});
    });
  } catch (err) {
    console.error('Error en /status:', err);
    ctx.reply('❌ Error al obtener estado.').catch(() => {});
  }
}

module.exports = { handleStatus };
