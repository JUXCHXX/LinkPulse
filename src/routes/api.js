// src/routes/api.js
const express = require('express');
const { verifyJWT } = require('../middleware/auth');
const { logError, getBootContext } = require('../utils/errors');
const {
  getSitesByUserId,
  getSiteById,
  addSite,
  deleteSite,
  updateSiteVisibility,
  getRecentChecks,
  getLatencyHistory,
  getSiteStats,
  getLastCheck,
} = require('../db/supabase');

const router = express.Router();

/**
 * GET /api/sites
 * Obtener todos los sitios del usuario autenticado
 */
router.get('/sites', verifyJWT, async (req, res) => {
  try {
    const sites = await getSitesByUserId(req.user.userId);
    res.json(sites);
  } catch (err) {
    logError('Error en GET /sites', err, {
      ...getBootContext(),
      userId: req.user.userId,
    });
    res.status(500).json({ error: 'Error al obtener sitios' });
  }
});

/**
 * GET /api/sites/:siteId
 * Obtener datos de un sitio específico (con stats)
 */
router.get('/sites/:siteId', verifyJWT, async (req, res) => {
  try {
    const site = await getSiteById(req.params.siteId);

    if (!site || site.user_id !== req.user.userId) {
      return res.status(404).json({ error: 'Sitio no encontrado' });
    }

    const stats = await getSiteStats(site.id);
    const latencyHistory = await getLatencyHistory(site.id, 50);

    res.json({
      ...site,
      stats,
      latencyHistory,
    });
  } catch (err) {
    logError('Error en GET /sites/:siteId', err, {
      ...getBootContext(),
      siteId: req.params.siteId,
      userId: req.user.userId,
    });
    res.status(500).json({ error: 'Error al obtener sitio' });
  }
});

/**
 * POST /api/sites
 * Crear nuevo sitio
 */
router.post('/sites', verifyJWT, async (req, res) => {
  try {
    const { name, url, visibility } = req.body;

    if (!name || !url) {
      return res.status(400).json({ error: 'Nombre y URL son requeridos' });
    }

    // Validar URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'URL inválida' });
    }

    // Validar visibilidad
    if (!['private', 'global'].includes(visibility)) {
      return res.status(400).json({ error: 'Visibilidad debe ser private o global' });
    }

    const site = await addSite(req.user.userId, name, url, visibility);

    res.status(201).json({
      message: 'Sitio agregado exitosamente',
      site,
    });
  } catch (err) {
    logError('Error en POST /sites', err, {
      ...getBootContext(),
      userId: req.user.userId,
    });
    res.status(500).json({ error: 'Error al crear sitio' });
  }
});

/**
 * PUT /api/sites/:siteId
 * Actualizar visibilidad de un sitio
 */
router.put('/sites/:siteId', verifyJWT, async (req, res) => {
  try {
    const { visibility } = req.body;

    const site = await getSiteById(req.params.siteId);

    if (!site || site.user_id !== req.user.userId) {
      return res.status(404).json({ error: 'Sitio no encontrado' });
    }

    if (!['private', 'global'].includes(visibility)) {
      return res.status(400).json({ error: 'Visibilidad debe ser private o global' });
    }

    await updateSiteVisibility(site.id, req.user.userId, visibility);

    res.json({
      message: 'Visibilidad actualizada',
      siteId: site.id,
      visibility,
    });
  } catch (err) {
    logError('Error en PUT /sites/:siteId', err, {
      ...getBootContext(),
      siteId: req.params.siteId,
      userId: req.user.userId,
    });
    res.status(500).json({ error: 'Error al actualizar sitio' });
  }
});

/**
 * DELETE /api/sites/:siteId
 * Eliminar un sitio
 */
router.delete('/sites/:siteId', verifyJWT, async (req, res) => {
  try {
    const site = await getSiteById(req.params.siteId);

    if (!site || site.user_id !== req.user.userId) {
      return res.status(404).json({ error: 'Sitio no encontrado' });
    }

    await deleteSite(site.id, req.user.userId);

    res.json({
      message: 'Sitio eliminado',
      siteId: site.id,
    });
  } catch (err) {
    logError('Error en DELETE /sites/:siteId', err, {
      ...getBootContext(),
      siteId: req.params.siteId,
      userId: req.user.userId,
    });
    res.status(500).json({ error: 'Error al eliminar sitio' });
  }
});

/**
 * GET /api/latency/:siteId?limit=50
 * Obtener historial de latencia de un sitio
 */
router.get('/latency/:siteId', verifyJWT, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const site = await getSiteById(req.params.siteId);

    if (!site || site.user_id !== req.user.userId) {
      return res.status(404).json({ error: 'Sitio no encontrado' });
    }

    const history = await getLatencyHistory(site.id, limit);
    res.json(history);
  } catch (err) {
    logError('Error en GET /latency/:siteId', err, {
      ...getBootContext(),
      siteId: req.params.siteId,
      userId: req.user.userId,
    });
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

/**
 * GET /api/checks?limit=100
 * Últimos chequeos del usuario
 */
router.get('/checks', verifyJWT, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const checks = await getRecentChecks(limit);

    // Filtrar solo los checks de sitios del usuario
    const userSites = await getSitesByUserId(req.user.userId);
    const siteIds = userSites.map((s) => s.id);
    const filtered = checks.filter((c) => siteIds.includes(c.site_id));

    res.json(filtered);
  } catch (err) {
    logError('Error en GET /checks', err, {
      ...getBootContext(),
      userId: req.user.userId,
    });
    res.status(500).json({ error: 'Error al obtener chequeos' });
  }
});

module.exports = router;
