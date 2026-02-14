# گزارش وضعیت - TitanGold Data Hub & Telegram Collector

**تاریخ:** 2026-02-14  
**وضعیت کلی:** ✅ Production Ready  
**محیط:** Production (titan.zala.ir)

---

## 📊 وضعیت سرویس‌ها

### ✅ همه سرویس‌ها Online

| سرویس | Port | Status | Uptime | Version | PID |
|-------|------|--------|--------|---------|-----|
| **Backend** | 5002 | 🟢 Online | 3+ days | 1.0.0 | 3198552, 3198564 (cluster x2) |
| **Telegram Collector** | 3002 | 🟢 Online | 24+ hours | 0.5.0 | 3937544 |
| **Frontend** | 3000/443 | 🟢 Online | 30+ hours | N/A | 3840302 (via Nginx) |
| **Engine Worker** | N/A | 🟢 Online | 4+ days | 1.0.0 | 3157330 |

### Health Checks

```bash
# Backend
GET http://localhost:5002/api/v1/health
✅ {"status":"ok","service":"titan-backend","version":"1.0.0"}

# Telegram Collector
GET http://localhost:3002/api/telegram-collector/health
✅ {"status":"healthy","service":"telegram-collector","version":"0.5.0"}

# Nginx Routing
GET https://titan.zala.ir/api/telegram-collector/health
✅ {"status":"healthy"} (proxied to 3002)
```

---

## 🎯 تسک‌های کامل شده

### Phase 1: Data Hub Foundation (DH-001 to DH-006) ✅

- ✅ **DH-001:** Retry mechanism با exponential backoff
- ✅ **DH-002:** Rate limiting middleware (4 سطح)
- ✅ **DH-003:** Secure session storage (AES-256-CBC)
- ✅ **DH-004:** Enhanced frontend error handling
- ✅ **DH-005:** Data source creation flow
- ✅ **DH-006:** End-to-end testing framework

### Phase 2: Data Validation & Processing (DH-007 to DH-010) ✅

- ✅ **DH-007:** Data validation & normalization
- ✅ **DH-008:** Backend schema validation (Zod)
- ✅ **DH-009:** Automated session rotation (30 days)
- ✅ **DH-010:** Duplicate detection & deduplication

### Telegram Collector Tasks (TC-001 to TC-015) ✅

- ✅ **TC-001 to TC-015:** همه تسک‌ها کامل شده
- ℹ️ **TC-016:** Multi-channel per DataSource (optional, در بک‌لاگ)

### Recent Fixes (2026-02-14) ✅

- ✅ **Nginx Routing:** `/api/telegram-collector/` با priority matching
- ✅ **Sync Endpoint:** `/api/v1/data-sources/telegram-sync` fix
- ✅ **View Messages:** 404 رفع شد
- ✅ **Safe Property Access:** Optional chaining در DataHub UI
- ✅ **Environment Variables:** VITE_TELEGRAM_COLLECTOR_URL set شد

---

## 📝 مستندات موجود

| مستند | محتوا | وضعیت |
|-------|-------|--------|
| **DEPLOY.md** | راهنمای کامل deployment | ✅ Up-to-date |
| **TELEGRAM_COLLECTOR_REVIEW.md** | Troubleshooting guide | ✅ Up-to-date |
| **BUILD_AND_DEPLOY.md** | Build و اجرا | ✅ Up-to-date |
| **TELEGRAM_COLLECTOR_ANALYSIS.md** | معماری و بک‌لاگ | ✅ Available |
| **DESIGN_SYSTEM_DATAHUB.md** | طراحی UI Data Hub | ✅ Available |
| **TELEGRAM_E2E_TEST_PLAN.md** | تست E2E | ✅ Available |
| **DATAHUB_TELEGRAM_TASKS.md** | Task tracking | ✅ Available |

---

## 🏗️ معماری Production

```
Internet
    ↓
Cloudflare (CDN + SSL)
    ↓
Nginx (188.40.209.82:443)
    ├─ Static Files → /home/ubuntu/webapp/TitanGold/dist/
    ├─ /api/ → Backend (5002)
    ├─ /api/telegram-collector/ → Telegram Collector (3002) [Priority!]
    └─ /ws/ → Backend WebSocket (5002)

Backend (5002)
    ├─ Express + REST API
    ├─ PostgreSQL (5433)
    ├─ Redis (session)
    └─ PM2 Cluster (x2)

Telegram Collector (3002)
    ├─ MTProto/GramJS
    ├─ Session Management
    ├─ Circuit Breaker
    └─ PM2 Single Instance

Frontend (3000/443)
    ├─ Vite + React + TypeScript
    ├─ Served by Nginx from /dist
    └─ VITE_TELEGRAM_COLLECTOR_URL=https://titan.zala.ir
```

---

## 🔐 Security Features

- ✅ **HTTPS Only:** Cloudflare Origin Certificate
- ✅ **Session Encryption:** AES-256-CBC
- ✅ **Rate Limiting:**
  - Auth: 5 req/s (burst 10)
  - API: 30 req/s (burst 50)
- ✅ **JWT Authentication:** Backend API tokens
- ✅ **CORS:** Restricted to titan.zala.ir
- ✅ **Real IP Detection:** Cloudflare CF-Connecting-IP
- ✅ **Circuit Breaker:** Telegram API failures (5, 60s, 2)
- ✅ **Session Rotation:** Auto-rotate every 30 days

---

## 🧪 Testing Endpoints

### Production URLs

```bash
# Frontend
https://titan.zala.ir/

# Backend Health
https://titan.zala.ir/api/v1/health

# Telegram Collector Health
https://titan.zala.ir/api/telegram-collector/health

# Data Sources API
GET  https://titan.zala.ir/api/v1/data-sources
POST https://titan.zala.ir/api/v1/data-sources/telegram-sync

# Telegram Login
POST https://titan.zala.ir/api/telegram-collector/login/send
POST https://titan.zala.ir/api/telegram-collector/login/confirm
POST https://titan.zala.ir/api/telegram-collector/login/cancel

# Session Management
GET  https://titan.zala.ir/api/telegram-collector/session/status
GET  https://titan.zala.ir/api/telegram-collector/session/health
POST https://titan.zala.ir/api/telegram-collector/session/check-health
POST https://titan.zala.ir/api/telegram-collector/session/force-rotation
```

### Internal URLs (localhost)

```bash
# Backend
http://localhost:5002/api/v1/health

# Telegram Collector
http://localhost:3002/api/telegram-collector/health

# Frontend Dev Server (dev mode only)
http://localhost:3000/
```

---

## 🚀 Deployment Workflow

### Quick Deploy (Frontend Changes)

```bash
cd /home/ubuntu/webapp/TitanGold
npm run build
sudo systemctl reload nginx
```

**Time:** ~30 seconds

### Full Deploy (All Services)

```bash
cd /home/ubuntu/webapp/TitanGold

# Frontend
npm run build

# Backend
cd backend
npm run build  # if TypeScript
pm2 restart titan-backend

# Telegram Collector
cd ../telegram-collector
npm run build  # if changed
pm2 restart telegram-collector

# Nginx
sudo nginx -t
sudo systemctl reload nginx
```

**Time:** ~2-3 minutes

---

## 🔍 Monitoring & Logs

### PM2 Logs

```bash
# All services
pm2 logs

# Specific service
pm2 logs titan-backend
pm2 logs telegram-collector
pm2 logs titan-frontend

# No tail
pm2 logs --nostream

# Clear logs
pm2 flush
```

### Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/titan-api-access.log
sudo tail -f /var/log/nginx/titan-telegram-access.log

# Error logs
sudo tail -f /var/log/nginx/titan-api-error.log
sudo tail -f /var/log/nginx/titan-telegram-error.log
sudo tail -f /var/log/nginx/error.log
```

### Application Logs

```bash
# Backend logs (PM2)
pm2 logs titan-backend --lines 100

# Telegram Collector logs
pm2 logs telegram-collector --lines 100

# Database logs (if needed)
sudo tail -f /var/log/postgresql/postgresql-*.log
```

---

## 🛠️ Development Setup

برای development local:

### Terminal 1: Backend

```bash
cd /home/ubuntu/webapp/TitanGold/backend
npm install
npm run dev
```

**Port:** 5002  
**Hot Reload:** Yes (nodemon)

### Terminal 2: Telegram Collector

```bash
cd /home/ubuntu/webapp/TitanGold/telegram-collector
npm install
npm run build  # if TypeScript changed
npm run start  # or npm run dev
```

**Port:** 3002  
**Hot Reload:** Manual restart needed

### Terminal 3: Frontend

```bash
cd /home/ubuntu/webapp/TitanGold
npm install
npm run dev
```

**Port:** 3000  
**Hot Reload:** Yes (Vite HMR)  
**Access:** http://localhost:3000

---

## 📊 Performance Metrics

### Response Times (Average)

| Endpoint | Response Time | Status |
|----------|---------------|--------|
| Frontend (/) | <100ms | ✅ Fast |
| Backend API | 50-200ms | ✅ Good |
| Telegram Collector | 100-300ms | ✅ Good |
| Database Queries | 10-50ms | ✅ Fast |

### Resource Usage

| Service | CPU | Memory | Status |
|---------|-----|--------|--------|
| Backend | 0% | 103 MB | ✅ Normal |
| Telegram Collector | 0% | N/A | ✅ Normal |
| Frontend | 0% | N/A | ✅ Normal |
| PostgreSQL | N/A | N/A | ✅ Normal |

---

## ⚠️ Known Issues & Solutions

### ❌ Issue: Frontend shows old cached version
**Solution:**
```bash
# Hard refresh in browser
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)

# Or rebuild
npm run build
sudo systemctl reload nginx
```

### ❌ Issue: 404 on Telegram Collector endpoints
**Solution:**
```bash
# Check PM2
pm2 list | grep telegram-collector

# Restart if needed
pm2 restart telegram-collector

# Check Nginx routing
sudo grep -n "location.*telegram" /etc/nginx/sites-available/titan-zala
```

### ❌ Issue: Environment variable not updating
**Solution:**
```bash
# Edit .env.local
nano .env.local

# MUST rebuild (env vars are compile-time)
npm run build

# Reload
sudo systemctl reload nginx
```

---

## 🎯 Next Steps (Optional)

### Phase 3: Scale & Performance (Optional)

- **TASK-DH-011:** Caching strategy (Redis)
- **TASK-DH-012:** Database optimization (indexes)
- **TASK-DH-013:** Load balancing
- **TASK-DH-014:** Monitoring dashboard

### Phase 4: Advanced Features (Optional)

- **TASK-DH-015:** Multi-language support
- **TASK-DH-016:** Advanced analytics
- **TASK-DH-017:** Export/Import functionality
- **TASK-DH-018:** Webhook integrations

### Telegram Collector (Optional)

- **TASK-TC-016:** Multi-channel per DataSource
- **TASK-TC-017:** Advanced filtering
- **TASK-TC-018:** Media download

---

## ✅ Production Checklist

قبل از هر deploy:

- [ ] ✅ Git commit & push
- [ ] ✅ Run tests (if available)
- [ ] ✅ Build frontend (`npm run build`)
- [ ] ✅ Test Nginx config (`sudo nginx -t`)
- [ ] ✅ Reload Nginx (`sudo systemctl reload nginx`)
- [ ] ✅ Restart services if needed (`pm2 restart`)
- [ ] ✅ Check logs (`pm2 logs`)
- [ ] ✅ Test health endpoints
- [ ] ✅ Hard refresh in browser

---

## 📞 Support & Contact

### Documentation

- **Primary:** DEPLOY.md, BUILD_AND_DEPLOY.md
- **Troubleshooting:** TELEGRAM_COLLECTOR_REVIEW.md
- **Architecture:** TELEGRAM_COLLECTOR_ANALYSIS.md

### Logs & Debugging

```bash
# Quick health check
curl https://titan.zala.ir/api/v1/health
curl https://titan.zala.ir/api/telegram-collector/health

# Service status
pm2 status

# Recent errors
pm2 logs --err --lines 50
```

---

## 🎉 Summary

**✅ Production Status:** All systems operational  
**✅ Documentation:** Complete and up-to-date  
**✅ Deployment:** Automated and tested  
**✅ Monitoring:** Logs and health checks in place  
**✅ Security:** Multi-layer protection active  

**System is production-ready and stable!** 🚀

---

**Last Updated:** 2026-02-14  
**Version:** 1.0.0  
**Environment:** Production (titan.zala.ir)  
**Status:** ✅ All Green
