# 🔒 راهنمای نهایی HTTPS/SSL برای TitanGold
**تاریخ**: 2025-12-23  
**وضعیت**: ✅ همه چیز آماده - فقط DNS باقی مانده

---

## 🎯 خلاصه وضعیت

### ✅ کارهای انجام شده
- ✅ **Backend**: دو نمونه آنلاین (`titan-backend` پورت 5002)
- ✅ **Frontend**: بیلد Production آماده (Vite build کامل)
- ✅ **Nginx**: پیکربندی HTTPS روی پورت 443
- ✅ **SSL Certificate**: Cloudflare Origin Certificate نصب شده (اعتبار تا 2040)
- ✅ **Git**: همه تغییرات push شده به GitHub

### ⏳ فقط باقی مانده
- ⏳ **DNS Record**: افزودن رکورد A برای `titan.zala.ir`

---

## 🚨 مشکل فعلی شما

### 1️⃣ مشکل: `titan.zala.ir` کار نمی‌کند
```
ERR_NAME_NOT_RESOLVED
DNS_PROBE_FINISHED_NXDOMAIN
```

**علت**: رکورد DNS اضافه نشده  
**راه‌حل**: به بخش «راه‌حل قطعی» بروید 👇

### 2️⃣ مشکل: `https://188.40.209.82/` کار می‌کند اما Login نمی‌شود
**علت**: شما هنوز از Vite Dev Server (پورت 3000) استفاده می‌کردید  
**راه‌حل**: حالا Nginx مستقیماً فایل‌های production را سرو می‌کند ✅

---

## 🎯 راه‌حل قطعی (3 مرحله ساده)

### مرحله 1️⃣: افزودن DNS Record در Cloudflare
1. برو به Cloudflare Dashboard
2. دامنه `zala.ir` را انتخاب کن
3. برو به `DNS` → `Records`
4. روی `Add record` کلیک کن
5. این مقادیر را وارد کن:
   ```
   Type: A
   Name: titan
   IPv4 address: 188.40.209.82
   Proxy status: Proxied (☁️ آیکن نارنجی)
   TTL: Auto
   ```
6. روی `Save` کلیک کن

**مدت زمان**: DNS معمولاً 5-60 دقیقه طول می‌کشد

### مرحله 2️⃣: تنظیمات SSL در Cloudflare
1. برو به `SSL/TLS` → `Overview`
2. روی **Full (strict)** کلیک کن
3. برو به `SSL/TLS` → `Edge Certificates`
4. این گزینه‌ها را فعال کن:
   - ✅ `Always Use HTTPS`: **ON**
   - ✅ `TLS 1.3`: **ON**
   - ✅ `Automatic HTTPS Rewrites`: **ON**
   - ✅ `Minimum TLS Version`: **TLS 1.2**

### مرحله 3️⃣: تست نهایی
بعد از 5-60 دقیقه، این لینک‌ها باید کار کنند:

```
✅ Frontend: https://titan.zala.ir/
✅ Backend API: https://titan.zala.ir/api/
✅ WebSocket: wss://titan.zala.ir/ws/favorites
```

---

## 🔧 راه‌حل موقت (همین الان کار می‌کند)

اگر نمی‌خواهید منتظر DNS بمانید:

### گزینه A: از IP استفاده کنید
```
Frontend: https://188.40.209.82/
Backend: https://188.40.209.82/api/

⚠️ مرورگر هشدار SSL می‌دهد - طبیعی است
   روی "Advanced" → "Proceed to 188.40.209.82" کلیک کنید
```

### گزینه B: موقتاً از HTTP استفاده کنید
```
Frontend: http://188.40.209.82:3000/

⚠️ فقط برای تست - امن نیست
```

---

## 📊 مشخصات فنی

### Backend API
```bash
# چک کردن Backend Health
curl -k https://188.40.209.82/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser2","password":"Test123456"}'

# خروجی موفق:
# {"user":{...},"accessToken":"...","refreshToken":"..."}
```

### Frontend Production Build
```bash
# چک کردن فایل‌های بیلد
ls -lh /home/ubuntu/webapp/TitanGold/dist/

# خروجی:
# index.html          (9.5 KB)
# assets/             (بیش از 10 فایل JS/CSS)
```

### Nginx Configuration
```bash
# چک کردن پیکربندی
sudo nginx -t

# چک کردن لاگ‌ها
sudo tail -f /var/log/nginx/titan-access.log
sudo tail -f /var/log/nginx/titan-api-access.log
```

### SSL Certificate
```bash
# اعتبار تا: 2040-12-19 (15 سال)
# دامنه‌ها: *.zala.ir, zala.ir
# مسیر: /etc/ssl/cloudflare/zala.ir.origin.pem
```

---

## 🔍 عیب‌یابی

### مشکل: "This site can't be reached"
```
✅ چک کنید: DNS record اضافه شده؟
✅ منتظر بمانید: 5-60 دقیقه برای propagation
✅ تست کنید: nslookup titan.zala.ir
```

### مشکل: "Your connection is not private"
```
✅ اگر از IP استفاده می‌کنید: طبیعی است، روی "Advanced" کلیک کنید
✅ اگر از titan.zala.ir استفاده می‌کنید: SSL mode را Full (strict) کنید
```

### مشکل: Login کار نمی‌کند
```
✅ چک کنید: از https:// استفاده می‌کنید؟
✅ تست کنید: Backend API مستقیماً (curl command بالا)
✅ چک کنید: Console در Developer Tools
```

### مشکل: API دریافت نمی‌شود
```bash
# چک کردن Backend logs
pm2 logs titan-backend --lines 50

# چک کردن Nginx logs
sudo tail -50 /var/log/nginx/error.log
```

---

## 📝 Checklist نهایی

### Server
- ✅ Backend online (2 instances)
- ✅ Frontend build created
- ✅ Nginx configured
- ✅ SSL certificate installed
- ✅ PM2 services running

### Cloudflare
- ⏳ DNS A record: `titan` → `188.40.209.82`
- ⏳ SSL Mode: `Full (strict)`
- ⏳ Edge Certificates: Always HTTPS, TLS 1.3

### Testing
- ⏳ `https://titan.zala.ir/` بدون هشدار باز می‌شود
- ⏳ Login با `testuser2` / `Test123456` کار می‌کند
- ⏳ API calls successful در Network tab

---

## 📚 مستندات مرتبط

1. **CLOUDFLARE_SSL_COMPLETE.md**: راهنمای کامل SSL
2. **FINAL_DEPLOYMENT_REPORT.md**: گزارش نهایی deploy
3. **TEST_RESULTS.md**: نتایج تست API

---

## 🎉 بعد از تکمیل DNS

وقتی DNS آماده شد، این آدرس‌ها کار می‌کنند:

```
🌐 Frontend:  https://titan.zala.ir/
🔌 Backend:   https://titan.zala.ir/api/
💬 WebSocket: wss://titan.zala.ir/ws/favorites

👤 Test Login:
   Username: testuser2
   Password: Test123456
```

---

## 💡 نکات مهم

1. **Cloudflare Origin Certificate**:
   - فقط برای ارتباط Cloudflare ↔ Server
   - برای دسترسی مستقیم از IP، مرورگر هشدار می‌دهد (طبیعی است)

2. **DNS Propagation**:
   - معمولاً 5-15 دقیقه
   - گاهی تا 1 ساعت طول می‌کشد
   - با `nslookup titan.zala.ir` چک کنید

3. **Production vs Development**:
   - ✅ Production: Nginx مستقیماً `/dist` را سرو می‌کند
   - ❌ Development: Vite dev server (پورت 3000) - فقط برای توسعه

---

## 📞 پشتیبانی

اگر مشکلی داشتید:
1. لاگ‌های Server: `pm2 logs titan-backend`
2. لاگ‌های Nginx: `sudo tail -f /var/log/nginx/error.log`
3. لاگ‌های Browser: F12 → Console & Network tabs

---

**✅ خلاصه**: همه چیز آماده است، فقط DNS Record را اضافه کنید و 15 دقیقه صبر کنید.
