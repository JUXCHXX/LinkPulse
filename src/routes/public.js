// src/routes/public.js
const express = require('express');
const { getGlobalSites } = require('../db/supabase');

const router = express.Router();

/**
 * GET /api/public/config
 * Obtener configuración pública (APP_URL, BOT_USERNAME, etc)
 */
router.get('/config', (req, res) => {
  res.json({
    appUrl: process.env.APP_URL || 'https://linkpulse.railway.app',
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'linkpulse_bot',
    apiUrl: '/api',
  });
});

/**
 * GET /api/public/global?limit=10
 * Obtener sitios globales (públicos)
 */
router.get('/global', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const sites = await getGlobalSites(limit);

    // Enriquecer con último chequeo
    // (esto se podría optimizar con una vista en Supabase)
    const enriched = sites.map((site) => ({
      id: site.id,
      name: site.name,
      url: site.url,
      owner: site.users?.[0]?.display_name || 'Anónimo',
      createdAt: site.created_at,
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Error en GET /global:', err);
    res.status(500).json({ error: 'Error al obtener sitios globales' });
  }
});

module.exports = router;
