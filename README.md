# 🟢 LinkPulse v2 — Monitor de Disponibilidad Web

> Plataforma multiusuario de monitoreo web con autenticación vía Telegram,
> alertas instantáneas, dashboard en tiempo real y sitios globales compartidos.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram-Bot-26A5E4?logo=telegram&logoColor=white)
![Railway](https://img.shields.io/badge/Deploy-Railway-0B0D0E?logo=railway&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## ✨ Características

### 🔐 Autenticación

- **Registro vía Telegram**: Usa el bot para registrarte - sin emails, sin contraseñas
- **JWT Personalizado**: Tokens seguros con expiración de 7 días
- **Link Único**: Cada login genera un link personal e intransferible

### 📊 Dashboard Web

- **SPA Moderna**: Interfaz single-page responsive
- **Dark Industrial**: Tema minimalista dark profesional
- **Multiusuario**: Cada usuario ve solo sus sitios
- **Tiempo Real**: Actualizaciones en vivo

### 🌐 Sitios Globales

- **Compartir Públicamente**: Marca sitios como "Global"
- **Vista Pública**: Acceso sin autenticación
- **Búsqueda**: Encuentra sitios rápidamente

### 🤖 Bot de Telegram

- `/start` — Registrarse o generar link
- `/status` — Estado actual de sitios
- `/uptime` — Estadísticas
- `/mysites` — Listar mis sitios
- `/addsite` — Agregar sitio
- `/global` — Sitios públicos
- `/help` — Ayuda

### 📡 Monitoreo

- **HTTP Checks**: Cada 5 minutos (configurable)
- **Latencia Tracking**: Historial completo
- **Alertas Telegram**: Notificaciones al dueño
- **Incidentes**: Registro automático

---

## 🛠️ Stack

| Componente | Tecnología |
|---|---|
| **Backend** | Node.js + Express |
| **Frontend** | Vanilla JS (SPA) |
| **Base de Datos** | Supabase PostgreSQL |
| **Bot** | Telegraf |
| **Autenticación** | JWT |
| **Deploy** | Railway |

---

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+
- Cuenta Supabase (gratis)
- Bot de Telegram (gratis)

### Instalación

```bash
git clone https://github.com/tusuario/linkpulse.git
cd linkpulse
npm install
cp .env.example .env
# Editar .env con tus datos
npm run dev
```

Abre http://localhost:3000

---

## 🔑 Obtener APIs (Gratis)

### Supabase

1. https://supabase.com → Sign Up
2. Create Project
3. Settings > API → Copia URL y Service Role Key
4. SQL Editor → Ejecuta el schema (ver abajo)

### Telegram Bot

1. Telegram → @BotFather
2. `/newbot` → Sigue instrucciones
3. Copia el token

### JWT Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🗄️ Schema SQL (Supabase)

Ve a **SQL Editor** y ejecuta:

```sql
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id  BIGINT UNIQUE NOT NULL,
  telegram_username TEXT,
  display_name TEXT UNIQUE NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  last_login   TIMESTAMPTZ
);

CREATE TABLE sites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  visibility  TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'global')),
  enabled     BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE checks (
  id          BIGSERIAL PRIMARY KEY,
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('up', 'down', 'timeout', 'error')),
  http_code   INTEGER,
  latency_ms  INTEGER,
  checked_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE incidents (
  id           BIGSERIAL PRIMARY KEY,
  site_id      UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ,
  duration_ms  BIGINT
);

CREATE INDEX idx_checks_site_id   ON checks(site_id);
CREATE INDEX idx_checks_checked   ON checks(checked_at DESC);
CREATE INDEX idx_incidents_site   ON incidents(site_id);
CREATE INDEX idx_sites_user       ON sites(user_id);
CREATE INDEX idx_sites_visibility ON sites(visibility);

CREATE VIEW site_stats AS
SELECT
  s.id, s.name, s.url, s.visibility, s.user_id,
  COUNT(c.id) AS total_checks,
  SUM(CASE WHEN c.status = 'up' THEN 1 ELSE 0 END) AS up_count,
  ROUND(100.0 * SUM(CASE WHEN c.status = 'up' THEN 1 ELSE 0 END) / NULLIF(COUNT(c.id), 0), 2) AS uptime_pct,
  AVG(CASE WHEN c.status = 'up' THEN c.latency_ms END)::INT AS avg_latency_ms,
  MAX(c.checked_at) AS last_checked_at,
  (SELECT c2.status FROM checks c2 WHERE c2.site_id = s.id ORDER BY c2.checked_at DESC LIMIT 1) AS current_status,
  (SELECT c2.latency_ms FROM checks c2 WHERE c2.site_id = s.id ORDER BY c2.checked_at DESC LIMIT 1) AS last_latency_ms,
  (SELECT c2.http_code FROM checks c2 WHERE c2.site_id = s.id ORDER BY c2.checked_at DESC LIMIT 1) AS last_http_code
FROM sites s
LEFT JOIN checks c ON c.site_id = s.id
GROUP BY s.id;
```

**Desactiva RLS** en todas las tablas.

---

## ⚙️ Variables de Entorno (.env)

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...

JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_EXPIRES_IN=7d

TELEGRAM_BOT_TOKEN=123456789:AAxxxxxxxxxxxx
TELEGRAM_BOT_USERNAME=linkpulse_bot

PORT=3000
APP_URL=https://linkpulse.railway.app

CHECK_INTERVAL=*/5 * * * *
TIMEOUT_MS=10000
LATENCY_ALERT_MS=3000
```

---

## 🌐 Deploy en Railway

1. https://railway.app → Sign Up (con GitHub)
2. **New Project** → **Deploy from GitHub repo**
3. Selecciona tu repo `linkpulse`
4. Ve a **Variables** y agrega las de `.env`
5. **Deployments** → tu deploy → **Domain** → **Generate Domain**
6. Actualiza `APP_URL` en Variables
7. ¡Listo! 🎉

---

## 📁 Estructura

```
linkpulse/
├── src/
│   ├── index.js
│   ├── middleware/auth.js
│   ├── bot/telegram.js
│   ├── bot/commands/
│   ├── monitor/checker.js
│   ├── db/supabase.js
│   └── routes/
├── public/
│   ├── index.html
│   ├── css/
│   └── js/
├── .env.example
├── package.json
├── railway.json
└── README.md
```

---

## 🔍 API Endpoints

### Auth
```
POST /api/auth/verify
GET  /api/auth/me
POST /api/auth/refresh
```

### Sites (Con JWT)
```
GET    /api/sites
GET    /api/sites/:id
POST   /api/sites
PUT    /api/sites/:id
DELETE /api/sites/:id
```

### Historial (Con JWT)
```
GET /api/latency/:siteId
GET /api/checks
```

### Público
```
GET /api/public/config
GET /api/public/global
```

---

## 🛡️ Seguridad

✅ JWT con expiración
✅ Rate limiting (10/min auth)
✅ Validación de URLs
✅ Sanitización
✅ Aislamiento de datos
✅ Service key solo en backend

---

## 📝 Licencia

MIT

---

**LinkPulse v2** — Monitoreo web simple y poderoso.
