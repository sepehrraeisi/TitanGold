# Telegram Collector End-to-End Test Plan

این فایل شامل سناریوهای تست End-to-End برای یکپارچه‌سازی Telegram Collector با Data Hub است.

**تست‌های خودکار Backend (TASK-TC-015):**  
برای endpointهای backend (telegram-sync, telegram-transfer-messages, telegram-account-metrics) تست یکپارچگی در  
`backend/__tests__/integration/telegramCollector.test.js`  
تعریف شده است. اجرا: از پوشهٔ backend دستور `npm test -- __tests__/integration/telegramCollector.test.js` (یا `npm run test:integration` برای همهٔ integration tests).

## پیش‌نیازها

- دسترسی به محیط تست/توسعه
- حداقل 2 شماره تلفن معتبر برای تست multi-account
- دسترسی به کانال‌های تست تلگرام

---

## سناریو 1: Multi-Account Setup و Login

### مراحل:
1. باز کردن تب **Telegram Collector** در Data Hub
2. کلیک روی **Start Login Wizard**
3. وارد کردن API ID و API Hash (از https://my.telegram.org)
4. وارد کردن شماره تلفن اول
5. وارد کردن کد تأیید دریافتی
6. در صورت نیاز، وارد کردن رمز 2FA
7. تکرار مراحل 4-6 برای اکانت دوم

### نتیجه مورد انتظار:
- ✅ هر دو اکانت در لیست Accounts نمایش داده شوند
- ✅ وضعیت هر دو اکانت `active` باشد
- ✅ یکی از اکانت‌ها به عنوان `primary` مشخص شود

---

## سناریو 2: اضافه کردن کانال‌ها و نسبت‌دهی به اکانت‌ها

### مراحل:
1. در تب Telegram Collector، بخش **Channels**
2. استفاده از دکمه **Refresh Channels** برای بارگذاری کانال‌های موجود
3. برای هر کانال، انتخاب اکانت از dropdown **Account**
4. فعال کردن toggle **Enabled** برای حداقل 3 کانال

### نتیجه مورد انتظار:
- ✅ کانال‌ها در جدول نمایش داده شوند
- ✅ هر کانال به اکانت مناسب نسبت داده شود
- ✅ کانال‌های فعال با toggle سبز نمایش داده شوند
- ✅ در Account Summary، تعداد کانال‌های هر اکانت به‌درستی نمایش داده شود

---

## سناریو 3: Sync با Data Sources

### مراحل:
1. در تب Telegram Collector، کلیک روی **Sync Data Sources**
2. بررسی تب **Data Sources** در Data Hub
3. بررسی اینکه منابع تلگرامی ایجاد شده‌اند

### نتیجه مورد انتظار:
- ✅ برای هر کانال فعال، یک DataSource با `type='telegram'` ایجاد شود
- ✅ DataSource‌ها با نام و URL مناسب نمایش داده شوند
- ✅ در تب **Categories**، تعداد منابع تلگرامی برای هر دسته نمایش داده شود

---

## سناریو 4: دریافت و ذخیره پیام‌ها

### مراحل:
1. اطمینان از اینکه کانال‌ها فعال هستند و به اکانت‌ها نسبت داده شده‌اند
2. صبر کردن برای polling خودکار (یا trigger دستی)
3. بررسی جدول `telegram_messages` در دیتابیس
4. استفاده از دکمه **View Messages** در Telegram Collector

### نتیجه مورد انتظار:
- ✅ پیام‌های جدید در `telegram_messages` ذخیره شوند
- ✅ Modal "View Messages" آخرین پیام‌ها را نمایش دهد
- ✅ پیام‌ها با جزئیات کامل (text, timestamp, media, sentiment) نمایش داده شوند

---

## سناریو 5: انتقال پیام‌ها به Pipeline

### مراحل:
1. در تب Telegram Collector، کلیک روی **Transfer Messages to Pipeline** (یا استفاده از endpoint `POST /api/v1/data-sources/telegram-transfer-messages`)
2. بررسی تب **Data Pipeline**
3. فیلتر کردن بر اساس `source_type='telegram'`

### نتیجه مورد انتظار:
- ✅ پیام‌های جدید از `telegram_messages` به `collected_data` منتقل شوند
- ✅ `raw_data` و `normalized_data` به‌درستی پر شوند
- ✅ پیام‌ها در Data Pipeline با status `pending` نمایش داده شوند
- ✅ نرمال‌سازی شامل title, content, tags, sentiment, entities باشد

---

## سناریو 6: Automation Rules برای تلگرام

### مراحل:
1. رفتن به تب **Advanced Features** → **Automation**
2. کلیک روی **Add Topic**
3. انتخاب `dataType='telegram'`
4. تنظیم categories و tags مناسب
5. انتخاب publisher target (اگر موجود است)
6. ذخیره rule

### نتیجه مورد انتظار:
- ✅ Rule ایجاد شود و در لیست نمایش داده شود
- ✅ Hint box توضیح دهد که rule برای پیام‌های تلگرام فعال است
- ✅ Rule در routing pipeline اعمال شود

---

## سناریو 7: Health Monitoring

### مراحل:
1. رفتن به تب **Health Monitoring**
2. بررسی کارت **Telegram Collector Health**
3. بررسی متریک‌ها (status, active channels, avg latency)

### نتیجه مورد انتظار:
- ✅ کارت سلامت Telegram Collector نمایش داده شود
- ✅ وضعیت کلی (healthy/degraded/down) به‌درستی نمایش داده شود
- ✅ تعداد کانال‌های فعال و کل نمایش داده شود
- ✅ در صورت وجود FloodWait، badge هشدار نمایش داده شود

---

## سناریو 8: Access Logs

### مراحل:
1. رفتن به تب **Access Logs**
2. کلیک روی دکمه **Telegram Only** filter
3. بررسی لاگ‌های مربوط به تلگرام

### نتیجه مورد انتظار:
- ✅ فقط لاگ‌های مربوط به تلگرام نمایش داده شوند
- ✅ خطاهای تلگرام با ترجمه کاربرپسند نمایش داده شوند
- ✅ Badge کوچک Telegram برای لاگ‌های تلگرامی نمایش داده شود

---

## سناریو 9: Category Mapping

### مراحل:
1. تغییر category یک کانال در Telegram Collector
2. بررسی sync با Data Source
3. بررسی تب **Categories** برای نمایش تعداد منابع تلگرامی

### نتیجه مورد انتظار:
- ✅ Category در DataSource به‌روز شود
- ✅ در تب Categories، تعداد منابع تلگرامی برای هر دسته نمایش داده شود
- ✅ Badge کوچک Telegram برای دسته‌های دارای منابع تلگرامی نمایش داده شود

---

## سناریو 10: Error Handling

### مراحل:
1. شبیه‌سازی FloodWait (یا استفاده از اکانت با FloodWait واقعی)
2. بررسی نمایش FloodWait در Account Summary
3. بررسی نمایش در Health Panel
4. بررسی لاگ‌های خطا

### نتیجه مورد انتظار:
- ✅ FloodWait در Account Summary نمایش داده شود
- ✅ Badge "Flood Risk" در Health Panel نمایش داده شود
- ✅ خطاها در Access Logs با ترجمه مناسب نمایش داده شوند

---

## چک‌لیست نهایی

- [ ] Multi-account login موفق
- [ ] کانال‌ها اضافه و نسبت داده شدند
- [ ] Sync با Data Sources انجام شد
- [ ] پیام‌ها دریافت و ذخیره شدند
- [ ] انتقال به Pipeline انجام شد
- [ ] Automation Rules کار می‌کنند
- [ ] Health Monitoring متریک‌ها را نمایش می‌دهد
- [ ] Access Logs فیلتر می‌شوند
- [ ] Category mapping کار می‌کند
- [ ] Error handling مناسب است

---

## یادداشت‌ها

- این تست‌ها باید در محیط تست/توسعه انجام شوند
- برای تست‌های production، باید از داده‌های واقعی با احتیاط استفاده شود
- در صورت نیاز، می‌توان سناریوهای اضافی برای edge cases اضافه کرد
