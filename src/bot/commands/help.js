// src/bot/commands/help.js
async function handleHelp(ctx) {
  const msg =
    `🤖 *LinkPulse Bot — Comandos disponibles*\n\n` +
    `\`/start\` — Registrarse o generar nuevo link de acceso\n` +
    `\`/status\` — Estado actual de todos tus sitios\n` +
    `\`/uptime\` — Estadísticas de uptime por sitio\n` +
    `\`/mysites\` — Listar mis sitios\n` +
    `\`/addsite <nombre> <url> <privado|global>\` — Agregar nuevo sitio\n` +
    `\`/global\` — Últimos 10 sitios públicos\n` +
    `\`/help\` — Ver este mensaje\n\n` +
    `📌 *Ejemplos:*\n` +
    `\`/addsite Mi Blog https://miblog.com global\`\n` +
    `\`/addsite Mi API https://api.com privado\`\n\n` +
    `🔗 Para acceder al dashboard web, usa \`/start\``;

  return await ctx.reply(msg, { parse_mode: 'Markdown' });
}

module.exports = { handleHelp };
