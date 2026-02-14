# بررسی و رفع مشکلات Telegram Collector

این مستند شرح کامل مشکلات شناسایی‌شده در Telegram Collector و راه‌حل‌های اعمال‌شده را ارائه می‌دهد.

---

## 📋 فهرست

1. [مشکلات شناسایی‌شده](#مشکلات-شناسایی‌شده)
2. [راه‌حل‌های اعمال‌شده](#راه‌حل‌های-اعمال‌شده)
3. [تنظیمات Nginx](#تنظیمات-nginx)
4. [تست و بررسی](#تست-و-بررسی)
5. [رفع خطاهای رایج](#رفع-خطاهای-رایج)

---

## مشکلات شناسایی‌شده

### 1️⃣ Sync Data Sources → 404 Not Found

**علت:**
- بک‌اند endpoint را به صورت `POST /api/v1/data-sources/telegram-sync` تعریف کرده
- فرانت‌اند به `POST /api/data-sources/telegram-sync` (بدون `/v1`) درخواست می‌فرستاد
- نتیجه: 404 Not Found

**نمونه خطا:**
```
POST https://titan.zala.ir/api/data-sources/telegram-sync
Status: 404 Not Found
Response: {"error":"Not Found"}
```

**محل کد مشکل‌دار:**
```typescript
// components/ai/AIManager/tabs/DataHub/TelegramPanel.tsx
// قبل از تغییر:
const response = await fetch('/api/data-sources/telegram-sync', {
    method: 'POST',
    // ...
});
```

---

### 2️⃣ View Messages → 404 Not Found

**علت:**
- درخواست: `GET /api/telegram-collector/channels/:id/messages`
- این endpoint در سرویس Telegram Collector (port 3002) تعریف شده
- Nginx همه `/api/*` را به Backend (port 5002) می‌فرستاد
- Backend این مسیر را نداشت → 404

**نمونه خطا:**
```
GET https://titan.zala.ir/api/telegram-collector/channels/123/messages
Status: 404 Not Found
Response: Cannot GET /api/telegram-collector/channels/123/messages
```

**دلیل:**
در Nginx، اگر `location /api/` قبل از `location /api/telegram-collector/` باشد، همه requests به backend می‌روند.

---

## راه‌حل‌های اعمال‌شده

### ✅ رفع مشکل 1: Sync Data Sources

**تغییر در Frontend:**

```typescript
// components/ai/AIManager/tabs/DataHub/TelegramPanel.tsx
// بعد از تغییر:
const response = await fetch('/api/v1/data-sources/telegram-sync', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
        collectorChannels: selectedChannels,
    }),
});
```

**مراحل Deploy:**

```bash
cd /home/ubuntu/webapp/TitanGold
npm run build
sudo systemctl reload nginx
```

**تست:**

```bash
# با token معتبر
curl -X POST https://titan.zala.ir/api/v1/data-sources/telegram-sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"collectorChannels":[]}'
```

---

### ✅ رفع مشکل 2: View Messages

**تغییر در Nginx:**

در `/etc/nginx/sites-available/titan-zala`، باید این بلاک **قبل از** `location /api/` قرار گیرد:

```nginx
# Telegram Collector Service (direct proxy to port 3002)
# IMPORTANT: must be BEFORE the general /api/ location
location ^~ /api/telegram-collector/ {
    proxy_pass http://127.0.0.1:3002;
    proxy_http_version 1.1;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Timeouts
    proxy_connect_timeout 30s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
    
    access_log /var/log/nginx/titan-telegram-access.log;
    error_log  /var/log/nginx/titan-telegram-error.log;
}

# General API endpoints (rate limited)
location /api/ {
    limit_req zone=titan_api_zone burst=50 nodelay;
    proxy_pass http://127.0.0.1:5002;
    # ...
}
```

**نکته مهم:**
- استفاده از `^~` prefix باعث می‌شود Nginx این location را با **اولویت بالاتر** match کند
- بدون `^~`، ممکن است `location /api/` عمومی اول match شود

**مراحل اعمال:**

```bash
# ویرایش config
sudo nano /etc/nginx/sites-available/titan-zala

# تست config
sudo nginx -t

# reload Nginx
sudo systemctl reload nginx
```

---

## تنظیمات Nginx

### ساختار کامل Nginx Config

```nginx
server {
    listen 443 ssl http2;
    server_name titan.zala.ir;
    
    root /home/ubuntu/webapp/TitanGold/dist;
    
    # 1. Health check (no rate limit)
    location /api/health {
        proxy_pass http://127.0.0.1:5002;
        # ...
    }
    
    # 2. Auth endpoints (strict rate limit)
    location ~ ^/api/auth/(login|register|logout) {
        limit_req zone=titan_auth_zone burst=10 nodelay;
        proxy_pass http://127.0.0.1:5002;
        # ...
    }
    
    # 3. Autopilot endpoints
    location /api/autopilot/ {
        proxy_pass http://127.0.0.1:5002;
        # ...
    }
    
    # 4. Telegram Collector (PRIORITY!)
    location ^~ /api/telegram-collector/ {
        proxy_pass http://127.0.0.1:3002;
        # ...
    }
    
    # 5. General API (catch-all)
    location /api/ {
        limit_req zone=titan_api_zone burst=50 nodelay;
        proxy_pass http://127.0.0.1:5002;
        # ...
    }
}
```

### اولویت‌بندی Location در Nginx

Nginx location matching order:

1. `location = /exact/path` (Exact match)
2. `location ^~ /prefix/` (Priority prefix)
3. `location ~ /regex/` (Regex, case-sensitive)
4. `location ~* /regex/` (Regex, case-insensitive)
5. `location /prefix/` (Prefix match)

در کد ما:
- `location ^~ /api/telegram-collector/` → اولویت 2
- `location /api/` → اولویت 5

بنابراین `/api/telegram-collector/*` همیشه به port 3002 می‌رود.

---

## تست و بررسی

### 1️⃣ تست Health Endpoint

```bash
curl https://titan.zala.ir/api/telegram-collector/health
```

**انتظار:**
```json
{
  "status": "healthy",
  "service": "telegram-collector",
  "version": "0.5.0",
  "timestamp": "2026-02-11T...",
  "configured": {
    "apiId": true,
    "apiHash": true,
    "session": true
  }
}
```

### 2️⃣ تست View Messages

```bash
# با channel ID واقعی
curl https://titan.zala.ir/api/telegram-collector/channels/CHANNEL_ID/messages
```

**انتظار:**
```json
{
  "messages": [...],
  "channel": {...},
  "pagination": {...}
}
```

### 3️⃣ تست Sync Data Sources

```bash
# نیاز به token معتبر
curl -X POST https://titan.zala.ir/api/v1/data-sources/telegram-sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"collectorChannels":[]}'
```

**انتظار:**
```json
{
  "success": true,
  "synced": 0,
  "message": "Data sources synced successfully"
}
```

### 4️⃣ بررسی Nginx Logs

```bash
# Access log برای telegram collector
sudo tail -f /var/log/nginx/titan-telegram-access.log

# Error log
sudo tail -f /var/log/nginx/titan-telegram-error.log

# General API log
sudo tail -f /var/log/nginx/titan-api-access.log
```

### 5️⃣ بررسی PM2 Logs

```bash
# Telegram Collector logs
pm2 logs telegram-collector --lines 50

# Backend logs
pm2 logs titan-backend --lines 50
```

---

## رفع خطاهای رایج

### ❌ خطا: 404 Not Found روی `/api/telegram-collector/...`

**علت محتمل:**
1. Nginx location order اشتباه است
2. Telegram Collector service روشن نیست
3. Nginx reload نشده

**راه‌حل:**

```bash
# 1. بررسی location order
sudo grep -n "location.*api" /etc/nginx/sites-available/titan-zala

# باید خروجی به این شکل باشد:
# 182:    location ^~ /api/telegram-collector/
# 201:    location /api/

# اگر order اشتباه بود، config را ویرایش کن
sudo nano /etc/nginx/sites-available/titan-zala

# 2. بررسی PM2
pm2 list | grep telegram-collector

# اگر offline بود:
pm2 restart telegram-collector

# 3. Reload Nginx
sudo nginx -t && sudo systemctl reload nginx

# 4. تست
curl http://localhost:3002/api/telegram-collector/health
curl https://titan.zala.ir/api/telegram-collector/health
```

---

### ❌ خطا: 502 Bad Gateway

**علت:**
- Telegram Collector service crash کرده یا down است

**راه‌حل:**

```bash
# بررسی logs
pm2 logs telegram-collector --lines 100

# Restart service
pm2 restart telegram-collector

# بررسی port
sudo netstat -tlnp | grep 3002

# اگر port باز نیست، سرویس start نشده
cd /home/ubuntu/webapp/TitanGold/telegram-collector
pm2 start dist/index.js --name telegram-collector
```

---

### ❌ خطا: CORS Error

**علت:**
- CORS headers در Nginx یا Backend درست set نشده

**راه‌حل:**

در Nginx config، مطمئن شو CORS headers اضافه شده:

```nginx
location /api/ {
    # ...
    
    # CORS headers
    add_header Access-Control-Allow-Origin "https://titan.zala.ir" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Request-ID" always;
    add_header Access-Control-Allow-Credentials "true" always;
    
    if ($request_method = OPTIONS) {
        return 204;
    }
}
```

---

### ❌ خطا: Cannot read properties of undefined

**علت:**
- Frontend property access بدون null check

**راه‌حل:**

استفاده از optional chaining:

```typescript
// ❌ اشتباه
const value = data.property.nested;

// ✅ درست
const value = data?.property?.nested ?? 'default';
```

---

### ❌ خطا: Environment variable not found

**علت:**
- `VITE_TELEGRAM_COLLECTOR_URL` در build time set نشده

**راه‌حل:**

```bash
# 1. ویرایش .env.local
nano .env.local

# اضافه کن:
VITE_TELEGRAM_COLLECTOR_URL=https://titan.zala.ir

# 2. Build مجدد (مهم!)
npm run build

# 3. Reload
sudo systemctl reload nginx
```

---

## 📊 خلاصه تغییرات

### Frontend Changes

| فایل | تغییر | دلیل |
|------|-------|------|
| `TelegramPanel.tsx` | `/api/data-sources/telegram-sync` → `/api/v1/data-sources/telegram-sync` | همخوانی با Backend API |
| `.env.local` | `VITE_TELEGRAM_COLLECTOR_URL=https://titan.zala.ir` | Base URL برای Telegram Collector |

### Backend/Infrastructure Changes

| کامپوننت | تغییر | دلیل |
|----------|-------|------|
| Nginx | اضافه شدن `location ^~ /api/telegram-collector/` | Proxy به port 3002 |
| Nginx | Fix location order | اولویت Telegram Collector بالاتر از `/api/` عمومی |
| Nginx | Fix symlink | `sites-enabled` → `sites-available` |

### Commits

```
06cd664 - docs: Add comprehensive deployment guide (DEPLOY.md)
478cb5f - fix(nginx): Add telegram-collector proxy route
[current] - fix: Sync Data Sources endpoint and View Messages routing
```

---

## 🚀 Checklist نهایی

قبل از تست در production:

- [ ] ✅ Frontend build شده (`npm run build`)
- [ ] ✅ Nginx config تست شده (`sudo nginx -t`)
- [ ] ✅ Nginx reload شده (`sudo systemctl reload nginx`)
- [ ] ✅ Telegram Collector service روشن است (`pm2 list`)
- [ ] ✅ Backend service روشن است (`pm2 list`)
- [ ] ✅ Health endpoints پاسخ می‌دهند
- [ ] ✅ Logs خطا ندارند (`pm2 logs`)

تست در مرورگر:

- [ ] ✅ Hard refresh (`Ctrl+Shift+R`)
- [ ] ✅ DataHub → Telegram Collector باز می‌شود
- [ ] ✅ دکمه "Sync Data Sources" کار می‌کند
- [ ] ✅ دکمه "View Messages" کار می‌کند
- [ ] ✅ Login flow کامل است

---

## 📝 نکات مهم

1. **همیشه قبل از deploy:**
   ```bash
   npm run build
   sudo nginx -t
   sudo systemctl reload nginx
   ```

2. **برای debug:**
   ```bash
   # Backend logs
   pm2 logs titan-backend --lines 100
   
   # Telegram Collector logs
   pm2 logs telegram-collector --lines 100
   
   # Nginx logs
   sudo tail -100 /var/log/nginx/titan-telegram-error.log
   ```

3. **Environment variables:**
   - `.env.local` فقط برای development
   - برای production از `.env.production` استفاده کن
   - همیشه بعد از تغییر env، rebuild کن

4. **Nginx location order:**
   - Specific locations (مثل `/api/telegram-collector/`) باید **قبل از** generic locations (مثل `/api/`) باشند
   - استفاده از `^~` prefix برای اولویت بالاتر

---

### ✅ Git Commits

تمام تغییرات در Git commit شده‌اند:

**1. مستندسازی:**
```bash
# Commit 249b531
docs: Add Telegram Collector troubleshooting guide
```

**2. رفع Sync Endpoint:**
```bash
# Commit 361507c
fix(telegram): Use /api/v1/data-sources/telegram-sync for Sync Data Sources
```

**3. Deploy به Production:**
```bash
npm run build               # ✅ انجام شد (33.50s)
sudo systemctl reload nginx # ✅ انجام شد
```

**وضعیت:** ✅ همه تغییرات commit، push و deploy شده‌اند

---

**آخرین به‌روزرسانی:** 2026-02-11  
**نسخه:** 1.0.0  
**وضعیت:** ✅ همه مشکلات برطرف شده
