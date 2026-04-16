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
 * Escapa caracteres especiales de Markdown antiguo
 * En Markdown antiguo solo: _ * [ ] ( )
 *
 * @param {string} text - Texto a escapar
 * @returns {string} - Texto escapado
 */
function escapeMarkdown(text) {
  if (typeof text !== 'string') {
    return String(text);
  }

  return text
    .replace(/\\/g, '\\\\')   // Backslash primero
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Valida que un texto no contenga caracteres que rompan Markdown
 * Retorna true si es seguro usar directamente, false si necesita escapado
 *
 * @param {string} text - Texto a validar
 * @returns {boolean} - true si es seguro, false si contiene caracteres especiales
 */
function isMarkdownSafe(text) {
  if (typeof text !== 'string') {
    return false;
  }

  // Si contiene algún carácter especial, no es seguro
  const specialChars = /[_*[\]()~`>#\+\-=|{}\.!]/;
  return !specialChars.test(text);
}

/**
 * Sanitiza una URL para usarla en Telegram
 * Retorna la URL escapada para MarkdownV2
 *
 * @param {string} url - URL a sanitizar
 * @returns {string} - URL escapada
 */
function sanitizeUrl(url) {
  if (typeof url !== 'string') {
    return '';
  }

  return escapeMarkdownV2(url);
}

/**
 * Sanitiza un nombre para usarlo en Markdown
 * Si contiene caracteres especiales, los escapa
 *
 * @param {string} name - Nombre a sanitizar
 * @returns {string} - Nombre escapado
 */
function sanitizeName(name) {
  if (typeof name !== 'string') {
    return '';
  }

  return escapeMarkdownV2(name);
}

/**
 * Crea un bloque de código (backticks) que es seguro en MarkdownV2
 * Los backticks protegen el contenido de ser parseado
 *
 * @param {string} text - Texto a envolver
 * @returns {string} - Texto entre backticks
 */
function codeBlock(text) {
  if (typeof text !== 'string') {
    return '``';
  }

  // En MarkdownV2, backticks dentro de backticks deben escaparse
  const escaped = text.replace(/`/g, '\\`');
  return `\`${escaped}\``;
}

/**
 * Crea un bloque de código multilínea (triple backticks)
 *
 * @param {string} text - Texto a envolver
 * @param {string} language - Lenguaje para highlight (opcional)
 * @returns {string} - Bloque de código
 */
function preBlock(text, language = '') {
  if (typeof text !== 'string') {
    return '``````';
  }

  const escaped = text.replace(/`/g, '\\`');
  return `\`\`\`${language}\n${escaped}\n\`\`\``;
}

/**
 * Genera un mensaje de Telegram seguro con datos del usuario
 * Escapa automáticamente todos los valores variables
 *
 * @param {object} data - Objeto con datos a interpolar
 * @param {string} template - Template string con keys entre ${}
 * @returns {string} - Mensaje escapado
 *
 * @example
 * const message = safeMessage(
 *   { siteName: 'My_Site [API]', url: 'https://api.com?id=1' },
 *   '📌 $siteName\n🔗 $url'
 * );
 */
function safeMessage(data, template) {
  let result = template;

  if (typeof data !== 'object' || !data) {
    return result;
  }

  for (const [key, value] of Object.entries(data)) {
    const placeholder = new RegExp(`\\$${key}`, 'g');
    const sanitized = sanitizeName(String(value));
    result = result.replace(placeholder, sanitized);
  }

  return result;
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

/**
 * Wrapper seguro para enviar mensajes con Telegraf
 * Maneja errores de parsing y reintentos automáticos
 *
 * @param {object} context - Contexto de Telegraf (ctx)
 * @param {string} message - Mensaje a enviar
 * @param {object} options - Opciones adicionales
 * @returns {Promise} - Resultado del envío
 */
async function safeSendMessage(context, message, options = {}) {
  const { parseMode = 'MarkdownV2', maxRetries = 2, ...restOptions } = options;

  // Validar mensaje
  const validation = validateMessage(message, parseMode);
  if (!validation.isValid) {
    console.warn('⚠️  Validación de mensaje falló:', validation.warnings);
  }

  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await context.reply(message, {
        parse_mode: parseMode,
        disable_web_page_preview: true,
        ...restOptions,
      });
    } catch (err) {
      lastError = err;
      const analysis = analyzeTelegramError(err);

      console.error(
        `❌ Error enviando mensaje (intento ${attempt + 1}/${maxRetries}):`,
        analysis
      );

      if (analysis.isMarkdownError && attempt === 0) {
        // Reintentar con parse_mode desactivado
        console.log('🔄 Reintentando sin parse_mode...');
        try {
          return await context.reply(message, {
            disable_web_page_preview: true,
            ...restOptions,
          });
        } catch (retryErr) {
          console.error('❌ Reintento falló:', retryErr.message);
          lastError = retryErr;
        }
      }

      // Esperar antes de reintentar
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

module.exports = {
  escapeMarkdownV2,
  escapeMarkdown,
  isMarkdownSafe,
  sanitizeUrl,
  sanitizeName,
  codeBlock,
  preBlock,
  safeMessage,
  analyzeTelegramError,
  validateMessage,
  safeSendMessage,
};
