# راهنمای Build و Deploy – مرحله‌به‌مرحله

این دستورها را **خودت در ترمینال** اجرا کن. هر جا به `sudo` نیاز بود، پس از زدن Enter رمز را فقط خودت وارد کن (رمز در تاریخچهٔ شل ذخیره نشود).

> **Production (titan.zala.ir):** راهنمای کامل deploy با PM2، Nginx و مسیرهای واقعی در **`DEPLOY.md`** است. روی این سرور Nginx مستقیماً از `root /home/ubuntu/webapp/TitanGold/dist` سرو می‌کند؛ پس بعد از `npm run build` فقط Nginx را reload کن (و در صورت نیاز PM2 را restart کن).

---

## ۱. پیش‌نیاز

```bash
cd /home/ubuntu/webapp/TitanGold
node -v   # ترجیحاً 18+
npm -v
```

اگر `node` یا `npm` نصب نبود، با sudo نصب کن (مثلاً از مخزن NodeSource یا nvm).

---

## ۲. دیدن تغییرات در حالت توسعه (Development)

برای دیدن تغییرات UI (مثل دکمهٔ «وارد کردن از تلگرام») باید سه سرویس روشن باشند:

| سرویس            | پورت | نقش                    |
|------------------|------|-------------------------|
| Backend          | 5002 | API اصلی اپ             |
| Telegram Collector | 3002 | API کلکتور تلگرام      |
| Frontend (Vite)  | 3000 | UI؛ درخواست‌ها را به 5002 و 3002 پراکسی می‌کند |

### ۲.۱ اجرای Backend

یک ترمینال باز کن و اجرا کن:

```bash
cd /home/ubuntu/webapp/TitanGold/backend
npm install
npm run dev
```

بگذار همین‌طور روشن بماند (با `nodemon` خودش ریلود می‌شود).

### ۲.۲ اجرای Telegram Collector (در صورت نیاز به تب Telegram Collector)

**مهم (TASK-TC-010):** سرویس اصلی کلکتور همان **root** پروژه است (`telegram-collector/dist`). پوشه‌های `deploy/blue/telegram-collector` و `deploy/green/telegram-collector` فقط کپی ساده‌تر (تک‌اکانت) هستند؛ در **production** همیشه از root اجرا کن.

ترمینال دوم:

```bash
cd /home/ubuntu/webapp/TitanGold/telegram-collector
npm install
npm run dev
```

یا اگر اسکریپت `dev` نداشت:

```bash
node dist/index.js
```

بگذار روشن بماند.

### ۲.۳ اجرای Frontend

ترمینال سوم:

```bash
cd /home/ubuntu/webapp/TitanGold
npm install
npm run dev
```

بعد در مرورگر برو به: **http://localhost:3000**  
مسیر در اپ: **AI → Manage AI → Data Hub → Telegram Collector**.  
دکمهٔ «وارد کردن از تلگرام» کنار جستجوی کانال‌ها باید دیده شود.

---

## ۳. بیلد فرانت‌اند (Production)

فقط یک بار بیلد بگیر (بدون sudo):

```bash
cd /home/ubuntu/webapp/TitanGold
npm run build
```

خروجی داخل **`dist/`** قرار می‌گیرد (مثلاً `dist/index.html` و `dist/assets/`).

### ۳.۱ متغیر محیط Telegram Collector (اختیاری)

برای تب **Telegram Collector** در Data Hub، فرانت‌اند باید آدرس سرویس کلکتور را بداند:

- **`VITE_TELEGRAM_COLLECTOR_URL`** در **زمان بیلد** خوانده می‌شود (Vite آن را در کد فرانت جایگزین می‌کند).
- اگر **خالی** بگذاری یا set نکنی: درخواست‌های کلکتور به همان origin (مثلاً `https://titan.zala.ir`) و مسیر `/api/telegram-collector/...` می‌روند و Nginx آن‌ها را به پورت 3002 پراکسی می‌کند. برای production پشت Nginx معمولاً همین کافی است.
- اگر در **توسعه** کلکتور روی آدرس دیگری است (مثلاً `http://localhost:3002`)، می‌توانی قبل از بیلد set کنی:
  ```bash
  export VITE_TELEGRAM_COLLECTOR_URL=http://localhost:3002
  npm run build
  ```
- در **CI/CD**: برای production اغلب نیازی به set کردن نیست؛ در صورت نیاز همان base URL اپ را بگذار (مثلاً `https://titan.zala.ir`).

بعد از هر تغییر این متغیر حتماً **دوباره بیلد** بگیر.

---

## ۴. Deploy روی سرور (با Nginx)

**سرور فعلی (titan.zala.ir):** Nginx مستقیماً از `root /home/ubuntu/webapp/TitanGold/dist` سرو می‌کند؛ سرویس‌ها با **PM2** اجرا می‌شوند. دستورهای دقیق و کامل در **`DEPLOY.md`** است. خلاصه:

### ۴.۱ بیلد و به‌روزرسانی (بدون کپی؛ dist همان مسیر است)

```bash
cd /home/ubuntu/webapp/TitanGold
npm run build
```

### ۴.۲ Reload Nginx

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### ۴.۳ ریستارت سرویس‌ها با PM2 (در صورت تغییر backend یا telegram-collector)

```bash
pm2 restart titan-backend
pm2 restart telegram-collector
# فرانت فقط از dist سرو می‌شود؛ بعد از build کافی است Nginx را reload کن
```

برای جزئیات PM2، health check و عیب‌یابی → **`DEPLOY.md`**.

---

*اگر روی سرور دیگری با مسیر جدا (مثلاً `/var/www/...`) سرو می‌دهی، بعد از `npm run build` فایل‌های `dist/*` را به آن مسیر کپی کن و سپس Nginx را reload کن.*

---

## ۵. خلاصهٔ دستورها (کپی‑پیست)

**توسعه (سه ترمینال):**

```bash
# ترمینال ۱ – Backend
cd /home/ubuntu/webapp/TitanGold/backend && npm install && npm run dev
```

```bash
# ترمینال ۲ – Telegram Collector
cd /home/ubuntu/webapp/TitanGold/telegram-collector && npm install && npm run dev
```

```bash
# ترمینال ۳ – Frontend
cd /home/ubuntu/webapp/TitanGold && npm install && npm run dev
```

بعد در مرورگر: **http://localhost:3000** → AI → Data Hub → Telegram Collector.

**بیلد و به‌روزرسانی (Production روی titan.zala.ir – Nginx از همین `dist` سرو می‌کند):**

```bash
cd /home/ubuntu/webapp/TitanGold && npm run build
sudo nginx -t && sudo systemctl reload nginx
```

برای دستورهای کامل PM2 و Nginx → **`DEPLOY.md`**.

---

اگر مسیر Nginx یا نام سرویس‌های systemd با این فرق دارد، در همین فایل یا در یک فایل جدا (مثلاً `deploy/README.md`) یادداشت کن تا در بار بعد همان دستورها را بزنی.
