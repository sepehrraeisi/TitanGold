# راهنمای Build و Deploy – TitanGold

این مستند راهنمای کامل برای build و deploy پروژه TitanGold است.

---

## 📋 فهرست مطالب

1. [پیش‌نیاز](#پیش‌نیاز)
2. [معماری سرویس‌ها](#معماری-سرویس‌ها)
3. [حالت Development](#حالت-development)
4. [Build Production](#build-production)
5. [Deploy با PM2](#deploy-با-pm2)
6. [Deploy با Nginx](#deploy-با-nginx)
7. [خطایابی رایج](#خطایابی-رایج)

---

## پیش‌نیاز

### نسخه‌های مورد نیاز

```bash
node -v   # v20.19.5 (یا 18+)
npm -v    # 10.8.2
pm2 -v    # 5.x
```

### نصب PM2 (اگر نصب نیست)

```bash
sudo npm install -g pm2
pm2 startup systemd
```

---

## معماری سرویس‌ها

| سرویس | پورت | مسیر | نقش |
|-------|------|------|-----|
| **Backend** | 5002 | `/home/ubuntu/webapp/TitanGold/backend` | API اصلی (REST + WebSocket) |
| **Telegram Collector** | 3002 | `/home/ubuntu/webapp/TitanGold/telegram-collector` | API کلکتور تلگرام (MTProto) |
| **Frontend** | 3000 | `/home/ubuntu/webapp/TitanGold` | Vite dev server (فقط dev) |
| **Nginx** | 443 | `/etc/nginx/sites-available/titan-zala` | Reverse proxy برای production |

### مسیرهای Nginx

```nginx
# Static files (production)
root /home/ubuntu/webapp/TitanGold/dist;

# API Backend
location /api/ {
    proxy_pass http://127.0.0.1:5002;
}

# Telegram Collector
location ^~ /api/telegram-collector/ {
    proxy_pass http://127.0.0.1:3002;
}

# Uploads
location /uploads/ {
    alias /home/ubuntu/webapp/TitanGold/backend/uploads/;
}
```

---

## حالت Development

برای دیدن تغییرات UI در حالت توسعه، سه سرویس باید روشن باشند.

### 1️⃣ اجرای Backend

```bash
cd /home/ubuntu/webapp/TitanGold/backend
npm install
npm run dev
```

Backend با `nodemon` روشن می‌شود و خودکار reload می‌کند.

### 2️⃣ اجرای Telegram Collector

```bash
cd /home/ubuntu/webapp/TitanGold/telegram-collector
npm install
npm run build
npm run dev
```

یا اگر از TypeScript استفاده می‌کنید:

```bash
npm run build && node dist/index.js
```

### 3️⃣ اجرای Frontend (Vite Dev Server)

```bash
cd /home/ubuntu/webapp/TitanGold
npm install
npm run dev
```

سپس در مرورگر برو به:

```
http://localhost:3000
```

مسیر در اپ:
```
AI → Manage AI → Data Hub → Telegram Collector
```

---

## Build Production

### 1️⃣ Build Frontend

```bash
cd /home/ubuntu/webapp/TitanGold
npm run build
```

خروجی در پوشه `dist/` قرار می‌گیرد:
- `dist/index.html`
- `dist/assets/`

### 2️⃣ Build Backend (TypeScript)

اگر backend از TypeScript استفاده می‌کند:

```bash
cd /home/ubuntu/webapp/TitanGold/backend
npm run build
```

### 3️⃣ Build Telegram Collector

```bash
cd /home/ubuntu/webapp/TitanGold/telegram-collector
npm run build
```

---

## Deploy با PM2

### وضعیت فعلی سرویس‌ها

```bash
pm2 list
```

### شروع سرویس‌ها (اولین بار)

```bash
# Backend (2 instances - cluster mode)
cd /home/ubuntu/webapp/TitanGold/backend
pm2 start dist/server.js --name titan-backend -i 2

# Telegram Collector
cd /home/ubuntu/webapp/TitanGold/telegram-collector
pm2 start dist/index.js --name telegram-collector

# Frontend (serve static با serve یا http-server)
cd /home/ubuntu/webapp/TitanGold
pm2 start "npx serve dist -l 3000" --name titan-frontend
```

### Restart سرویس‌ها (بعد از تغییرات)

```bash
# Restart همه
pm2 restart all

# یا فقط یک سرویس
pm2 restart titan-backend
pm2 restart telegram-collector
pm2 restart titan-frontend
```

### Reload بدون Downtime

```bash
pm2 reload titan-backend
pm2 reload telegram-collector
```

### ذخیره‌سازی PM2

```bash
pm2 save
```

### لاگ‌ها

```bash
# همه لاگ‌ها
pm2 logs

# لاگ یک سرویس
pm2 logs titan-backend

# لاگ جدید (بدون tail)
pm2 logs --nostream

# Clear logs
pm2 flush
```

---

## Deploy با Nginx

### 1️⃣ Build جدید

```bash
cd /home/ubuntu/webapp/TitanGold
npm run build
```

### 2️⃣ تست Nginx Config

```bash
sudo nginx -t
```

### 3️⃣ Reload Nginx

```bash
sudo systemctl reload nginx
```

یا برای restart کامل:

```bash
sudo systemctl restart nginx
```

### 4️⃣ Restart Backend (PM2)

```bash
pm2 restart titan-backend
pm2 restart telegram-collector
```

### 5️⃣ تست Production

```bash
curl -I https://titan.zala.ir
curl https://titan.zala.ir/api/health
curl https://titan.zala.ir/api/telegram-collector/health
```

---

## خطایابی رایج

### ❌ مشکل: Frontend تغییرات را نشان نمی‌دهد

**راه‌حل:**

```bash
# پاک کردن cache
rm -rf node_modules/.vite
rm -rf dist

# Build مجدد
npm run build

# Hard refresh در مرورگر
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

### ❌ مشکل: API endpoint 404 می‌دهد

**بررسی Nginx routes:**

```bash
sudo grep -n "location.*api" /etc/nginx/sites-available/titan-zala
```

**بررسی Backend routes:**

```bash
cd /home/ubuntu/webapp/TitanGold/backend
grep -r "app.use\|router.get\|router.post" routes/
```

### ❌ مشکل: Telegram Collector کار نمی‌کند

**بررسی لاگ:**

```bash
pm2 logs telegram-collector --lines 50
```

**بررسی health:**

```bash
curl http://localhost:3002/api/telegram-collector/health
```

**بررسی session در database:**

```bash
cd /home/ubuntu/webapp/TitanGold/backend
psql -U postgres -d titangold_db -c "SELECT service_name, is_active, phone_number, last_used_at FROM telegram_sessions;"
```

### ❌ مشکل: Environment variable تغییر نمی‌کند

**Environment variables باید قبل از build set شوند:**

```bash
# ویرایش .env.local
nano .env.local

# مثال:
VITE_TELEGRAM_COLLECTOR_URL=https://titan.zala.ir
VITE_API_BASE_URL=https://titan.zala.ir/api/v1

# Build مجدد (مهم!)
npm run build

# Reload
pm2 reload titan-frontend
sudo systemctl reload nginx
```

### ❌ مشکل: PM2 بعد از reboot start نمی‌شود

```bash
# ثبت PM2 در startup
pm2 startup systemd

# اجرای دستور output شده (با sudo)
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# ذخیره configuration
pm2 save
```

---

## 🚀 دستورات سریع (Quick Commands)

### Deploy سریع (بعد از تغییرات Frontend)

```bash
cd /home/ubuntu/webapp/TitanGold && \
npm run build && \
sudo systemctl reload nginx && \
echo "✅ Deployed!"
```

### Deploy سریع (بعد از تغییرات Backend)

```bash
cd /home/ubuntu/webapp/TitanGold/backend && \
npm run build && \
pm2 restart titan-backend && \
echo "✅ Backend restarted!"
```

### Deploy سریع (بعد از تغییرات Telegram Collector)

```bash
cd /home/ubuntu/webapp/TitanGold/telegram-collector && \
npm run build && \
pm2 restart telegram-collector && \
echo "✅ Telegram Collector restarted!"
```

### Deploy کامل (همه چیز)

```bash
cd /home/ubuntu/webapp/TitanGold && \
npm run build && \
cd backend && npm run build && \
cd ../telegram-collector && npm run build && \
cd .. && \
pm2 restart all && \
sudo systemctl reload nginx && \
echo "✅ Full deploy complete!"
```

### Health Check سریع

```bash
echo "🔍 Backend:" && curl -s http://localhost:5002/api/health | python3 -m json.tool && \
echo "\n🔍 Telegram Collector:" && curl -s http://localhost:3002/api/telegram-collector/health | python3 -m json.tool && \
echo "\n🔍 Frontend:" && curl -I https://titan.zala.ir | grep "HTTP"
```

---

## 📝 نکات مهم

1. **همیشه قبل از deploy تست کنید:**
   ```bash
   npm test  # اگر test setup کرده‌اید
   npm run build  # بررسی build errors
   ```

2. **Backup قبل از deploy مهم:**
   ```bash
   # Backup dist directory
   cp -r dist dist.backup.$(date +%Y%m%d_%H%M%S)
   ```

3. **Git commit همیشه قبل از deploy:**
   ```bash
   git add .
   git commit -m "feat: your changes"
   git push origin main
   ```

4. **Environment variables در `.env.local` را در Git قرار ندهید:**
   - `.env.local` در `.gitignore` است
   - برای production از `.env.production` استفاده کنید

5. **Nginx logs برای debug:**
   ```bash
   sudo tail -f /var/log/nginx/titan-api-access.log
   sudo tail -f /var/log/nginx/titan-telegram-access.log
   sudo tail -f /var/log/nginx/error.log
   ```

---

## 🔐 Security Notes

- ✅ همیشه از HTTPS استفاده کنید (Cloudflare Origin Certificate)
- ✅ Rate limiting در Nginx فعال است
- ✅ Session encryption با AES-256-CBC
- ✅ API authentication با JWT tokens
- ✅ CORS محدود به `https://titan.zala.ir`

---

## 📞 پشتیبانی

برای مشکلات و سوالات:
1. بررسی logs: `pm2 logs` و `/var/log/nginx/`
2. بررسی health endpoints
3. بررسی Git commits جدید
4. بررسی این مستند (DEPLOY.md)

---

**آخرین به‌روزرسانی:** 2026-02-11
**نسخه پروژه:** 1.0.0
**محیط:** Production (titan.zala.ir)
