# 📘 راهنمای اضافه کردن کانال‌های جدید به Telegram Collector

**تاریخ**: 2026-02-16  
**نسخه**: 1.0.0  
**وضعیت**: تأیید شده ✅

---

## 🎯 خلاصه سریع

برای اضافه کردن کانال‌های جدید به سیستم، **فقط از UI استفاده کنید** - همه چیز خودکار است! ✨

---

## 📋 روش‌های اضافه کردن کانال

### روش 1️⃣: استفاده از UI (توصیه می‌شود) ⭐

این روش **کاملاً خودکار** است و نیازی به دسترسی به دیتابیس یا API ندارد.

#### مرحله 1: ورود به UI
```
https://titan.zala.ir/?view=ai
```

1. کلیک روی **"AI Center"** (بالای صفحه)
2. انتخاب **"Data Hub"** tab
3. انتخاب **"Telegram Collector"** از منوی چپ

---

#### مرحله 2: Import کانال‌ها از Telegram

**2.1. باز کردن Import Modal**
- کلیک روی دکمه **"📥 Import from Telegram"**
- پنجره‌ای باز می‌شود با لیست کانال‌های شما

**2.2. بارگذاری کانال‌ها**
- کلیک روی **"Load Channels"**
- سیستم به صورت خودکار تمام کانال‌های Telegram شما را بارگذاری می‌کند

**2.3. انتخاب کانال‌های مورد نظر**
- لیست کانال‌ها نمایش داده می‌شود
- کانال‌هایی که از قبل اضافه شده‌اند، با تیک ✅ مشخص می‌شوند
- کانال‌های جدیدی که می‌خواهید اضافه کنید را با کلیک انتخاب کنید
- می‌توانید چند کانال را به صورت همزمان انتخاب کنید

**2.4. ثبت کانال‌ها**
- کلیک روی **"Sync Data Sources"**
- سیستم کانال‌های انتخابی را به دیتابیس اضافه می‌کند
- پیام موفقیت نمایش داده می‌شود: "✅ X channels registered"

---

#### مرحله 3: تأیید اضافه شدن کانال‌ها

**3.1. بررسی لیست کانال‌ها**
- کانال‌های جدید در جدول "Collector Channels" نمایش داده می‌شوند
- وضعیت اولیه: `lastSyncedAt: never`
- حساب تلگرام: باید یک account به کانال assign کنید

**3.2. انتساب Account به کانال**
- در ستون "Account"، drop-down را باز کنید
- یکی از account‌های موجود را انتخاب کنید (مثلاً "TelegramDefault")
- سیستم به صورت خودکار account را به کانال assign می‌کند

**3.3. فعال‌سازی کانال**
- در ستون "Active"، دکمه toggle را روشن کنید (سبز)
- کانال حالا فعال است و پیام‌های آن sync می‌شوند

---

#### مرحله 4: همگام‌سازی اولیه (اختیاری)

اگر می‌خواهید فوراً پیام‌های کانال را دریافت کنید:

**4.1. تست اتصال**
- کلیک روی **"Test Fetch"** در ستون Actions
- سیستم اتصال به کانال را تست می‌کند
- اگر موفق بود، پیام تأیید نمایش داده می‌شود

**4.2. مشاهده پیام‌ها**
- کلیک روی **"View Messages"**
- modal باز می‌شود و پیام‌های اخیر کانال نمایش داده می‌شوند

---

### روش 2️⃣: استفاده از API (برای توسعه‌دهندگان)

اگر می‌خواهید به صورت برنامه‌نویسی کانال اضافه کنید:

#### API Endpoint:
```
POST http://127.0.0.1:3002/api/telegram-collector/channels/register
```

#### Request Body:
```json
{
  "channel_id": "bbcpersian",
  "username": "bbcpersian",
  "title": "BBC Persian",
  "description": "BBC Persian News Channel",
  "category": "news",
  "config": {
    "priority": "high",
    "sync_interval": 600
  }
}
```

#### Response:
```json
{
  "success": true,
  "message": "Channel registered successfully",
  "channelId": "bbcpersian"
}
```

#### مثال با cURL:
```bash
curl -X POST http://127.0.0.1:3002/api/telegram-collector/channels/register \
  -H "Content-Type: application/json" \
  -d '{
    "channel_id": "myNewChannel",
    "username": "myNewChannel",
    "title": "My New Channel",
    "description": "Description of my channel",
    "category": "general"
  }'
```

---

### روش 3️⃣: اضافه کردن مستقیم به دیتابیس (پیشرفته)

**⚠️ هشدار:** این روش فقط برای کاربران پیشرفته توصیه می‌شود.

```sql
-- اضافه کردن یک کانال جدید
INSERT INTO telegram_channels (
  channel_id,
  username,
  title,
  description,
  category,
  priority,
  active,
  created_at,
  updated_at
) VALUES (
  'myNewChannel',
  'myNewChannel',
  'My New Channel',
  'Description of my channel',
  'general',
  'normal',
  true,
  NOW(),
  NOW()
);

-- تأیید اضافه شدن
SELECT channel_id, title, priority, active 
FROM telegram_channels 
WHERE channel_id = 'myNewChannel';
```

**نکته:** بعد از اضافه کردن مستقیم، باید در UI یک account به کانال assign کنید.

---

## 🔧 تنظیمات اولویت برای کانال‌های جدید

### اولویت‌بندی کانال‌ها

کانال‌ها به سه سطح اولویت تقسیم می‌شوند:

| اولویت | Sync Interval | Stale Threshold | استفاده |
|--------|---------------|-----------------|----------|
| **High** | 10 دقیقه | 10 دقیقه | کانال‌های خبری مهم |
| **Normal** | 15 دقیقه | 30 دقیقه | کانال‌های عمومی |
| **Low** | 30 دقیقه | 60 دقیقه | کانال‌های کم‌اهمیت |

---

### تنظیم اولویت از UI

**متأسفانه، در نسخه فعلی UI امکان تنظیم اولویت وجود ندارد.**

برای تنظیم اولویت، از دیتابیس یا API استفاده کنید:

#### از دیتابیس:
```sql
-- تنظیم اولویت HIGH
UPDATE telegram_channels 
SET priority = 'high' 
WHERE channel_id = 'myNewChannel';

-- تنظیم اولویت NORMAL
UPDATE telegram_channels 
SET priority = 'normal' 
WHERE channel_id = 'myNewChannel';

-- تنظیم اولویت LOW
UPDATE telegram_channels 
SET priority = 'low' 
WHERE channel_id = 'myNewChannel';
```

#### یا از API:
```bash
# تنظیم اولویت با API (نیاز به endpoint جدید دارد - در TODO)
curl -X PATCH http://127.0.0.1:3002/api/telegram-collector/channels/myNewChannel \
  -H "Content-Type: application/json" \
  -d '{"priority": "high"}'
```

---

## 📊 بررسی وضعیت کانال‌های جدید

### از UI:
1. رفتن به **Telegram Collector** در Data Hub
2. مشاهده لیست کانال‌ها
3. فیلتر بر اساس وضعیت:
   - **All**: همه کانال‌ها
   - **Active**: فقط کانال‌های فعال
   - **Inactive**: فقط کانال‌های غیرفعال

4. فیلتر بر اساس اولویت:
   - **All**: همه اولویت‌ها
   - **High**: فقط کانال‌های پرایوریتی
   - **Normal**: فقط کانال‌های عادی
   - **Low**: فقط کانال‌های کم‌اهمیت

---

### از دیتابیس:
```sql
-- بررسی همه کانال‌ها
SELECT 
  channel_id,
  title,
  priority,
  active,
  last_synced_at,
  CASE 
    WHEN last_synced_at IS NULL THEN 'Never synced'
    WHEN NOW() - last_synced_at > INTERVAL '30 minutes' THEN 'Stale'
    ELSE 'Fresh'
  END as sync_status
FROM telegram_channels
ORDER BY priority DESC, last_synced_at DESC NULLS LAST;

-- فقط کانال‌های جدید (هرگز sync نشده)
SELECT channel_id, title, priority, created_at
FROM telegram_channels
WHERE last_synced_at IS NULL AND active = true
ORDER BY created_at DESC;

-- فقط کانال‌های با اولویت بالا
SELECT channel_id, title, last_synced_at,
       EXTRACT(EPOCH FROM (NOW() - last_synced_at))/60 as minutes_since_sync
FROM telegram_channels
WHERE priority = 'high' AND active = true
ORDER BY last_synced_at DESC NULLS LAST;
```

---

### از API:
```bash
# لیست همه کانال‌ها
curl http://127.0.0.1:3002/api/telegram-collector/collector-channels

# فقط کانال‌های فعال
curl "http://127.0.0.1:3002/api/telegram-collector/collector-channels?status=active"

# فقط کانال‌های با اولویت بالا
curl "http://127.0.0.1:3002/api/telegram-collector/collector-channels?priority=high"

# ترکیب فیلترها
curl "http://127.0.0.1:3002/api/telegram-collector/collector-channels?status=active&priority=high"
```

---

## 🚀 همگام‌سازی خودکار

### چگونه کار می‌کند؟

بعد از اضافه کردن کانال‌های جدید:

1. **Polling Service** هر 15 دقیقه یک بار اجرا می‌شود
2. کانال‌های **فعال** (active = true) و **با account** را پیدا می‌کند
3. پیام‌های جدید هر کانال را fetch می‌کند
4. پیام‌ها را در جدول `telegram_messages` ذخیره می‌کند
5. فیلد `last_synced_at` را به روز می‌کند

---

### Sync Interval براساس اولویت:

| اولویت | Interval | توضیحات |
|--------|----------|---------|
| High | 10 دقیقه | کانال‌های خبری و مهم - نیاز به آپدیت سریع |
| Normal | 15 دقیقه | کانال‌های عمومی - sync منظم |
| Low | 30 دقیقه | کانال‌های کم‌اهمیت - sync کمتر |

**نکته:** در نسخه فعلی، همه کانال‌ها با interval 15 دقیقه sync می‌شوند. برای پیاده‌سازی interval متفاوت، نیاز به توسعه بیشتر است.

---

## 🔍 Force-Sync برای کانال‌های جدید

اگر می‌خواهید **فوراً** یک کانال جدید را sync کنید (بدون انتظار برای polling):

### از UI:
1. **فقط برای کانال‌های HIGH priority**: دکمه **"⚡ Sync Now"** در Actions ظاهر می‌شود
2. کلیک روی **"⚡ Sync Now"**
3. سیستم فوراً پیام‌های کانال را fetch می‌کند
4. نتیجه نمایش داده می‌شود:
   - تعداد پیام‌های fetch شده
   - تعداد پیام‌های ذخیره شده
   - Latency (ms)

**⚠️ محدودیت:** دکمه Sync Now فقط برای کانال‌های با اولویت HIGH نمایش داده می‌شود.

---

### از API:
```bash
# Force-sync یک کانال
curl -X POST http://127.0.0.1:3002/api/telegram-collector/channels/myNewChannel/force-sync

# Response:
{
  "success": true,
  "channelId": "myNewChannel",
  "messagesFetched": 10,
  "messagesSaved": 5,
  "latency": 234,
  "timestamp": "2026-02-16T17:00:00.000Z"
}
```

---

## ✅ Checklist اضافه کردن کانال جدید

- [ ] **1. Login به تلگرام** (اگر session منقضی شده)
- [ ] **2. Import کانال از Telegram** (دکمه "Import from Telegram")
- [ ] **3. بارگذاری لیست کانال‌ها** (دکمه "Load Channels")
- [ ] **4. انتخاب کانال‌های مورد نظر** (کلیک روی کانال‌ها)
- [ ] **5. Sync Data Sources** (دکمه "Sync Data Sources")
- [ ] **6. Assign Account** (انتخاب account از drop-down)
- [ ] **7. فعال‌سازی کانال** (toggle button روشن)
- [ ] **8. تنظیم اولویت** (اختیاری - از دیتابیس یا API)
- [ ] **9. تست اتصال** (دکمه "Test Fetch")
- [ ] **10. بررسی همگام‌سازی** (منتظر polling بمانید یا force-sync استفاده کنید)

---

## 🐛 مشکلات رایج و راه‌حل

### مشکل 1: کانال اضافه نمی‌شود
**راه‌حل:**
- بررسی کنید که Login به تلگرام موفق باشد
- Hard refresh کنید: `Ctrl+Shift+R`
- لاگ‌ها را بررسی کنید: `pm2 logs telegram-collector`

---

### مشکل 2: کانال sync نمی‌شود
**راه‌حل:**
- مطمئن شوید که کانال **فعال** است (toggle روشن باشد)
- یک **account** به کانال assign کنید
- بررسی کنید که session تلگرام معتبر است:
  ```bash
  curl http://127.0.0.1:3002/health | jq '.session'
  ```

---

### مشکل 3: پیام‌ها در دیتابیس ذخیره نمی‌شوند
**راه‌حل:**
- بررسی کنید که پیام‌های جدید در کانال وجود داشته باشد
- سیستم فقط پیام‌های **جدیدتر از آخرین sync** را ذخیره می‌کند
- برای تست، از force-sync استفاده کنید
- لاگ‌های polling service را بررسی کنید:
  ```bash
  pm2 logs telegram-collector --lines 100 | grep "Fetched messages"
  ```

---

### مشکل 4: دکمه "Sync Now" نمایش داده نمی‌شود
**راه‌حل:**
- این دکمه فقط برای کانال‌های **HIGH priority** نمایش داده می‌شود
- اولویت کانال را به HIGH تغییر دهید:
  ```sql
  UPDATE telegram_channels SET priority = 'high' WHERE channel_id = 'myChannel';
  ```
- صفحه را refresh کنید

---

### مشکل 5: خطای 401 AUTH_KEY_UNREGISTERED
**راه‌حل:**
- Session تلگرام منقضی شده است
- دوباره Login کنید (مراجعه به `TELEGRAM_LOGIN_GUIDE.md`)

---

## 📚 منابع بیشتر

- **راهنمای Login**: `TELEGRAM_LOGIN_GUIDE.md`
- **راهنمای Monitoring**: `TELEGRAM_MONITORING_PHASE1.md`
- **راهنمای Priority & Error Tracking**: `TELEGRAM_MONITORING_PHASE2.md`
- **راهنمای Data Flow**: `TELEGRAM_COLLECTOR_DATA_FLOW.md`
- **مستندات کامل**: `TELEGRAM_DEPLOYMENT_COMPLETE.md`

---

## 🎯 خلاصه

برای اضافه کردن کانال‌های جدید:

1. **از UI استفاده کنید** (ساده‌ترین روش) ✨
2. **Import from Telegram** را بزنید
3. **کانال‌ها را انتخاب کنید**
4. **Sync Data Sources** را بزنید
5. **Account assign کنید**
6. **کانال را فعال کنید**
7. **صبر کنید تا خودکار sync شود** (15 دقیقه) یا **Force-Sync** استفاده کنید

همین! 🎉

---

**آخرین بروزرسانی:** 2026-02-16  
**نسخه:** 1.0.0  
**وضعیت:** تأیید شده و تست شده ✅
