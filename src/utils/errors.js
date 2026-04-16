const STARTED_AT = Date.now();
const BOOT_ID = `${process.pid}-${STARTED_AT.toString(36)}`;

function serializeError(err) {
  if (!err) {
    return {
      name: 'UnknownError',
      message: 'Unknown error',
      stack: null,
    };
  }

  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint,
      status: err.status,
      stack: err.stack,
    };
  }

  return {
    name: typeof err,
    message: typeof err === 'string' ? err : JSON.stringify(err),
    raw: err,
    stack: null,
  };
}

function getBootContext(extra = {}) {
  return {
    bootId: BOOT_ID,
    pid: process.pid,
    uptimeSec: Math.round(process.uptime()),
    ...extra,
  };
}

function logError(context, err, extra = {}) {
  console.error(`[ERROR] ${context}`, {
    context,
    ...getBootContext(extra),
    ...serializeError(err),
  });
}

module.exports = {
  BOOT_ID,
  serializeError,
  getBootContext,
  logError,
};
