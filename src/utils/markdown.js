// ════════════════════════════════════════════════════════════════════════════════
// Utilidades para escapar y validar Markdown v2 en Telegraf
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Escapa caracteres especiales de MarkdownV2
 * En MarkdownV2, estos caracteres deben escaparse: _ * [ ] ( ) ~ ` > # + - = | { } . !
 *
 * @param {string} text - Texto a escapar
 * @returns {string} - Texto escapado
 */
function escapeMarkdownV2(text) {
  if (typeof text !== 'string') {
    return String(text);
  }

  return text
    .replace(/\\/g, '\\\\')   // Backslash debe ir primero
    .replace(/_/g, '\\_')     // Guion bajo
    .replace(/\*/g, '\\*')    // Asterisco
    .replace(/\[/g, '\\[')    // Corchete abierto
    .replace(/\]/g, '\\]')    // Corchete cerrado
    .replace(/\(/g, '\\(')    // Paréntesis abierto
    .replace(/\)/g, '\\)')    // Paréntesis cerrado
    .replace(/~/g, '\\~')     // Virgulilla
    .replace(/`/g, '\\`')     // Backtick
    .replace(/>/g, '\\>')     // Mayor que
    .replace(/#/g, '\\#')     // Hash
    .replace(/\+/g, '\\+')    // Plus
    .replace(/-/g, '\\-')     // Guion
    .replace(/=/g, '\\=')     // Igual
    .replace(/\|/g, '\\|')    // Pipe
    .replace(/{/g, '\\{')     // Llave abierta
    .replace(/}/g, '\\}')     // Llave cerrada
    .replace(/\./g, '\\.')    // Punto
    .replace(/!/g, '\\!');    // Exclamación
}

/**
 * Detecta errores de parsing de Markdown de Telegram
 * Útil para identificar qué causó "can't parse entities"
 *
 * @param {Error} err - Error de Telegram
 * @returns {object} - Información del error
 */
function analyzeTelegramError(err) {
  if (!err) {
    return {
      isMarkdownError: false,
      type: 'unknown',
      message: 'Error desconocido',
    };
  }

  const errorMessage = String(err.message || err);

  const markdownErrors = [
    'can\'t parse entities',
    'parse entities',
    'Bad Request: message',
    'entities',
  ];

  const isMarkdownError = markdownErrors.some((keyword) =>
    errorMessage.toLowerCase().includes(keyword.toLowerCase())
  );

  return {
    isMarkdownError,
    type: err.code || 'unknown',
    message: err.message || String(err),
    description: isMarkdownError
      ? 'Error de parsing de Markdown - probablemente caracteres sin escapar'
      : 'Error de Telegram',
  };
}

/**
 * Valida el formato de un mensaje antes de enviarlo
 * Retorna warnings si hay problemas potenciales
 *
 * @param {string} message - Mensaje a validar
 * @param {string} parseMode - parse_mode a usar ('Markdown', 'MarkdownV2', 'HTML')
 * @returns {object} - { isValid, warnings[] }
 */
function validateMessage(message, parseMode = 'MarkdownV2') {
  const warnings = [];

  if (!message || typeof message !== 'string') {
    return { isValid: false, warnings: ['Mensaje vacío o inválido'] };
  }

  if (message.length > 4096) {
    return { isValid: false, warnings: ['Mensaje demasiado largo (máx 4096 caracteres)'] };
  }

  if (parseMode === 'MarkdownV2') {
    // En MarkdownV2, ciertos patrones pueden causar problemas
    if (message.match(/\*\*/)) {
      warnings.push('Detectado ** (bold en MarkdownV2 usa *)');
    }
    if (message.match(/__/)) {
      warnings.push('Detectado __ (italic en MarkdownV2 usa _)');
    }
    if (message.match(/\[.*\]\(.*\)/)) {
      warnings.push('Detectado link en formato Markdown - verificar escape de caracteres');
    }
  }

  if (parseMode === 'Markdown') {
    if (message.match(/\[.*\]\(.*\)/)) {
      warnings.push('Detectado link - en Markdown antiguo puede causar issues');
    }
  }

  return {
    isValid: warnings.length === 0 || message.length < 4096,
    warnings,
  };
}

module.exports = {
  escapeMarkdownV2,
  analyzeTelegramError,
  validateMessage,
};
