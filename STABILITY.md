# 🛡️ Guía de Estabilidad en Producción

## Auditoría Completada - 2026-04-16

Este documento describe las mejoras aplicadas para garantizar estabilidad en Railway.

---

## ✅ Problemas Corregidos

### 1. **Global Error Handlers** ✓
**Problema**: Faltaba captura de excepciones síncronas no capturadas
**Solución**: 
- Agregado `process.on('uncaughtException')` en `src/index.js`
- Agregado `process.on('unhandledRejection')` (ya existía, mejorado)
- Logs detallados de crashes con contexto de boot

### 2. **Graceful Shutdown** ✓
**Problema**: El servidor no esperaba a que conexiones se cerraran
**Solución**:
- Implementado shutdown graceful con timeout de 10s
- El bot se detiene antes que HTTP
- HTTP server cierra ordenadamente las conexiones

### 3. **Monitor Blocking** ✓
**Problema**: `runChecks()` podía bloquear el event loop si BD se colgaba
**Solución**:
- Agregado timeout global de `CHECK_TIMEOUT_MS` (default: 60s)
- Implementado control de overlapping con `isCheckRunning`
- Health check cada 5 minutos para detectar si monitor se congela

### 4. **Bot Launch Protection** ✓
**Problema**: `bot.launch()` podía ejecutarse múltiples veces
**Solución**:
- Ya estaba implementado con `launchPromise`
- Agregada validación post-launch con `bot.getMe()`
- Estado de "bot healthy" (`botHealthy`) para prevenir envíos si falla

### 5. **Database Error Handling** ✓
**Problema**: Errores de Supabase podían no manejarse adecuadamente
**Solución**:
- Validación adicional en startup (retorna error pero continúa si falla)
- Cada operación DB tiene try-catch con logging
- Las alertas de Telegram fallan gracefully sin romper el monitor

### 6. **Express Error Handling** ✓
**Problema**: Errores no manejados en rutas podían dejar requests colgados
**Solución**:
- Global error handler en Express (último middleware)
- Todos los endpoints usan try-catch con `logError()`
- Respuestas JSON consistentes con status codes

### 7. **Bot Healthy Check** ✓
**Problema**: No había forma de saber si el bot estaba realmente funcional
**Solución**:
- Flag `botHealthy` que se valida antes de enviar mensajes
- Función `isBotHealthy()` exportada para monitoreo
- Post-launch validation con `bot.getMe()`

---

## 🔧 Configuración Recomendada para Railway

Crea un archivo `.env` en Railway con:

```env
# ── Base de Datos ──
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# ── Telegram Bot ──
TELEGRAM_BOT_TOKEN=your-bot-token

# ── App ──
PORT=3000
APP_URL=https://linkpulse.railway.app
NODE_ENV=production

# ── Monitor ──
CHECK_INTERVAL=*/5 * * * *
TIMEOUT_MS=10000
LATENCY_ALERT_MS=3000
CHECK_TIMEOUT_MS=60000

# ── Logging ──
LOG_LEVEL=info
```

---

## 📊 Health Checks

### 1. **Application Health**
```bash
curl http://localhost:3000/
# Devuelve: HTML del dashboard (SPA)
```

### 2. **Monitor Status**
El monitor loga cada ciclo:
```
🔍 Chequeando 5 sitios — 14:23:45
🟢 [example.com] UP — HTTP 200 — 245ms
⏰ Monitor iniciado — Intervalo: "*/5 * * * *"
```

### 3. **Bot Status**
El bot valida después de launch:
```
[TG launch] bot iniciado correctamente {
  botName: 'LinkPulse Bot',
  botUsername: 'linkpulse_bot'
}
```

---

## 🚨 Señales de Alerta

Si ves estos logs, algo está mal:

| Log | Significa | Acción |
|-----|-----------|--------|
| `[FATAL] Uncaught Exception` | Crash no capturado | Revisar logs completos |
| `⚠️ Check cycle timeout` | Monitor se congela | BD probablemente lenta |
| `⚠️ Bot no está healthy` | Bot no responde | Reiniciar (Railway lo hará) |
| `no hay chequeos exitosos en 15 min` | Monitor parado | Posible bloqueo del event loop |

---

## 🔄 Reinicio Automático en Railway

Railway reinicia la app automáticamente si:
1. Crash no capturado (`uncaughtException`)
2. Process exit code != 0
3. SIGTERM sin shutdown graceful después de 10s

**Configuración recomendada en Railway:**
- Health Check: `GET /` (timeout: 30s)
- Restart Policy: Automatic on failure

---

## 📈 Límites y Timeouts

| Config | Default | Máximo | Mínimo |
|--------|---------|--------|--------|
| `TIMEOUT_MS` | 10s | 30s | 2s |
| `CHECK_TIMEOUT_MS` | 60s | 120s | 30s |
| `LATENCY_ALERT_MS` | 3000ms | 10000ms | 500ms |
| Graceful shutdown | 10s | - | - |

---

## 🛠️ Debugging en Producción

Para ver logs en tiempo real:
```bash
# Desde Railway Dashboard o
railway logs -f
```

Busca estos patrones para entender el estado:

```
[TG launch]     → Bot initialization
[TG update]     → Telegram events  
[TG stop]       → Graceful shutdown
🔍 Chequeando   → Monitor running
[ERROR]         → Logged errors
[FATAL]         → Critical crashes
⏰ Monitor      → Monitor startup
```

---

## ✨ Cambios Principales en el Código

### `src/index.js`
- ✅ Graceful shutdown handler
- ✅ Global `uncaughtException` handler
- ✅ Error handler middleware en Express
- ✅ HTTP server lifecycle management

### `src/bot/runtime.js`
- ✅ Bot health check post-launch
- ✅ `isBotHealthy()` function
- ✅ Improved error logging

### `src/monitor/checker.js`
- ✅ Overlapping check prevention
- ✅ Global timeout with `Promise.race()`
- ✅ Health monitoring
- ✅ Detailed error logging

### `src/routes/api.js`
- ✅ Enhanced error logging with context

---

## 🎯 Stability Guarantees

✓ El proceso **nunca** muere sin logs  
✓ El bot **no** se lanza múltiples veces  
✓ El monitor **no** bloquea el event loop  
✓ Los errores **siempre** se registran  
✓ El shutdown es **graceful**  
✓ Supabase errors **no** rompen la app  
✓ Telegram errors **no** rompen el monitor  

---

## 📝 Notas

- Todos los timeouts son configurables via `.env`
- Los logs incluyen `bootId` + `pid` para trackear reboots
- No se agregó `process.exit()` en rutas - solo en shutdown controlado
- Las conexiones DB tienen retry logic en la librería Supabase
