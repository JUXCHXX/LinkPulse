// src/db/supabase.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridos en .env');
}

// Cliente de Supabase con service role key (acceso total en el backend)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Obtener usuario por telegram_id
 */
async function getUserByTelegramId(telegramId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data || null;
}

/**
 * Crear nuevo usuario
 */
async function createUser(telegramId, telegramUsername, displayName) {
  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        telegram_id: telegramId,
        telegram_username: telegramUsername,
        display_name: displayName,
        created_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Verificar si display_name ya existe
 */
async function isDisplayNameTaken(displayName) {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('display_name', displayName)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return !!data;
}

/**
 * Actualizar último login del usuario
 */
async function updateLastLogin(userId) {
  const { error } = await supabase
    .from('users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw error;
}

/**
 * Obtener datos del usuario por ID
 */
async function getUserById(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Obtener sitios por usuario
 */
async function getSitesByUserId(userId) {
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Obtener sitios globales (públicos)
 */
async function getGlobalSites(limit = 10) {
  const { data, error } = await supabase
    .from('sites')
    .select('id, name, url, created_at, user_id, users!inner(display_name)')
    .eq('visibility', 'global')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

/**
 * Agregar sitio nuevo
 */
async function addSite(userId, name, url, visibility = 'private') {
  const { data, error } = await supabase
    .from('sites')
    .insert([
      {
        user_id: userId,
        name,
        url,
        visibility,
        enabled: true,
        created_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Obtener sitio por ID (verificar que pertenece al usuario)
 */
async function getSiteById(siteId) {
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('id', siteId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Eliminar sitio (solo si pertenece al usuario)
 */
async function deleteSite(siteId, userId) {
  const { error } = await supabase
    .from('sites')
    .delete()
    .eq('id', siteId)
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Actualizar visibilidad del sitio
 */
async function updateSiteVisibility(siteId, userId, visibility) {
  const { error } = await supabase
    .from('sites')
    .update({ visibility })
    .eq('id', siteId)
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Insertar chequeo
 */
async function insertCheck(siteId, status, httpCode, latencyMs) {
  const { error } = await supabase.from('checks').insert([
    {
      site_id: siteId,
      status,
      http_code: httpCode,
      latency_ms: latencyMs,
      checked_at: new Date().toISOString(),
    },
  ]);

  if (error) throw error;
}

/**
 * Abrir incidente
 */
async function openIncident(siteId) {
  const { data, error } = await supabase
    .from('incidents')
    .insert([
      {
        site_id: siteId,
        started_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Cerrar incidente
 */
async function closeIncident(siteId) {
  const now = new Date();
  const { data: incident, error: fetchError } = await supabase
    .from('incidents')
    .select('*')
    .eq('site_id', siteId)
    .is('resolved_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError;
  }

  if (!incident) return;

  const durationMs = now - new Date(incident.started_at);

  const { error: updateError } = await supabase
    .from('incidents')
    .update({
      resolved_at: now.toISOString(),
      duration_ms: Math.round(durationMs),
    })
    .eq('id', incident.id);

  if (updateError) throw updateError;
}

/**
 * Obtener incidente abierto para un sitio
 */
async function getOpenIncident(siteId) {
  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('site_id', siteId)
    .is('resolved_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data || null;
}

/**
 * Obtener historial de latencia de un sitio
 */
async function getLatencyHistory(siteId, limit = 50) {
  const { data, error } = await supabase
    .from('checks')
    .select('latency_ms, checked_at, status')
    .eq('site_id', siteId)
    .eq('status', 'up')
    .order('checked_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

/**
 * Obtener estadísticas de sitio usando la vista
 */
async function getSiteStats(siteId) {
  const { data, error } = await supabase
    .from('site_stats')
    .select('*')
    .eq('id', siteId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Obtener todos los sitios habilitados (para monitoreo)
 */
async function getAllEnabledSites() {
  const { data, error } = await supabase
    .from('sites')
    .select('id, name, url, user_id, users!inner(telegram_id), visibility')
    .eq('enabled', true);

  if (error) throw error;
  return data;
}

/**
 * Obtener último chequeo de un sitio
 */
async function getLastCheck(siteId) {
  const { data, error } = await supabase
    .from('checks')
    .select('*')
    .eq('site_id', siteId)
    .order('checked_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data || null;
}

/**
 * Obtener últimos N chequeos
 */
async function getRecentChecks(limit = 100) {
  const { data, error } = await supabase
    .from('checks')
    .select('*, sites!inner(name, url, user_id)')
    .order('checked_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

module.exports = {
  supabase,
  getUserByTelegramId,
  createUser,
  isDisplayNameTaken,
  updateLastLogin,
  getUserById,
  getSitesByUserId,
  getGlobalSites,
  addSite,
  getSiteById,
  deleteSite,
  updateSiteVisibility,
  insertCheck,
  openIncident,
  closeIncident,
  getOpenIncident,
  getLatencyHistory,
  getSiteStats,
  getAllEnabledSites,
  getLastCheck,
  getRecentChecks,
};
