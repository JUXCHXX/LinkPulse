// src/monitor/checker.js
const axios = require('axios');
const cron = require('node-cron');
const {
  getAllEnabledSites,
  insertCheck,
  openIncident,
  closeIncident,
  getOpenIncident,
  getLastCheck,
  getUserById,
} = require('../db/supabase');
const { sendAlertToUser } = require('../bot/telegram');

const TIMEOUT = parseInt(process.env.TIMEOUT_MS) || 10000;
const LATENCY_ALERT = parseInt(process.env.LATENCY_ALERT_MS) || 3000;

// Estado en memoria para detectar cambios
const siteState = {};

/**
 * Hacer chequeo HTTP a un sitio
 */
async function checkSite(site) {
  const start = Date.now();
  let status = 'error';
  let httpCode = null;
  let latency = null;

  try {
    const res = await axios.get(site.url, {
      timeout: TIMEOUT,
      validateStatus: () => true,
      headers: { 'User-Agent': 'LinkPulse-Monitor/2.0' },
    });

    latency = Date.now() - start;
    httpCode = res.status;
    status = res.status >= 200 && res.status < 400 ? 'up' : 'down';
  } catch (err) {
    latency = Date.now() - start;
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      status = 'timeout';
    } else {
      status = 'error';
    }
  }

  // Guardar chequeo en Supabase
  try {
    await insertCheck(site.id, status, httpCode, latency);
  } catch (err) {
    console.error(`❌ Error guardando chequeo para ${site.name}:`, err.message);
  }

  // ── Manejo de incidentes y alertas ────────────────────────────────────────
  const prevState = siteState[site.id];

  // Obtener usuario dueño del sitio
  let user = null;
  try {
    user = await getUserById(site.user_id);
  } catch (err) {
    console.error(`❌ Error obtiendo usuario para sitio ${site.name}:`, err.message);
  }

  if (status !== 'up' && prevState !== 'down') {
    // Sitio cayó → abrir incidente y alertar
    siteState[site.id] = 'down';
    try {
      await openIncident(site.id);
    } catch (err) {
      console.error(`❌ Error abriendo incidente para ${site.name}:`, err.message);
    }

    const emoji = status === 'timeout' ? '⏱️' : '🔴';
    const msg =
      `${emoji} *SITIO CAÍDO*\n\n` +
      `📌 *${site.name}*\n` +
      `🔗 ${site.url}\n` +
      `📊 Estado: \`${status.toUpperCase()}\`\n` +
      (httpCode ? `🔢 HTTP: \`${httpCode}\`\n` : '') +
      `⏱ Latencia: \`${latency}ms\`\n` +
      `🕐 ${new Date().toLocaleString('es-CO')}`;

    if (user) {
      await sendAlertToUser(user.telegram_id, msg);
    }
    console.log(`🔴 [${site.name}] CAÍDO — ${status} (${latency}ms)`);
  } else if (status === 'up' && prevState === 'down') {
    // Sitio se recuperó → cerrar incidente y alertar
    siteState[site.id] = 'up';
    try {
      await closeIncident(site.id);
    } catch (err) {
      console.error(`❌ Error cerrando incidente para ${site.name}:`, err.message);
    }

    const msg =
      `✅ *SITIO RECUPERADO*\n\n` +
      `📌 *${site.name}*\n` +
      `🔗 ${site.url}\n` +
      `⏱ Latencia: \`${latency}ms\`\n` +
      `🕐 ${new Date().toLocaleString('es-CO')}`;

    if (user) {
      await sendAlertToUser(user.telegram_id, msg);
    }
    console.log(`✅ [${site.name}] RECUPERADO (${latency}ms)`);
  } else {
    // Estado normal
    siteState[site.id] = status === 'up' ? 'up' : 'down';

    // Alerta de alta latencia (solo si está up)
    if (status === 'up' && latency > LATENCY_ALERT && prevState !== 'slow') {
      const msg =
        `⚠️ *ALTA LATENCIA*\n\n` +
        `📌 *${site.name}*\n` +
        `🔗 ${site.url}\n` +
        `⏱ Latencia: \`${latency}ms\` (umbral: ${LATENCY_ALERT}ms)\n` +
        `🕐 ${new Date().toLocaleString('es-CO')}`;

      if (user) {
        await sendAlertToUser(user.telegram_id, msg);
      }
    }

    const icon = status === 'up' ? '🟢' : '🔴';
    console.log(`${icon} [${site.name}] ${status.toUpperCase()} — HTTP ${httpCode ?? 'N/A'} — ${latency}ms`);
  }

  return { id: site.id, name: site.name, url: site.url, status, httpCode, latency };
}

/**
 * Ejecutar chequeos de todos los sitios
 */
async function runChecks() {
  try {
    const sites = await getAllEnabledSites();
    if (sites.length === 0) {
      console.warn('⚠️ No hay sitios habilitados para monitorear');
      return;
    }
    console.log(
      `\n🔍 Chequeando ${sites.length} sitios — ${new Date().toLocaleTimeString('es-CO')}`
    );
    await Promise.all(sites.map(checkSite));
  } catch (err) {
    console.error('❌ Error en ciclo de chequeos:', err.message);
  }
}

/**
 * Iniciar el monitor con intervalo cron
 */
function startMonitor(interval) {
  const cronExpr = interval || process.env.CHECK_INTERVAL || '*/5 * * * *';

  if (!cron.validate(cronExpr)) {
    console.error(`❌ CHECK_INTERVAL inválido: "${cronExpr}"`);
    process.exit(1);
  }

  console.log(`⏰ Monitor iniciado — Intervalo: "${cronExpr}"`);
  runChecks(); // Chequeo inmediato al arrancar

  cron.schedule(cronExpr, runChecks);
}

module.exports = { startMonitor, runChecks, siteState };
