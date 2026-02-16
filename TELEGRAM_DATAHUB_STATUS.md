# وضعیت تلگرام و Data Hub

خلاصهٔ کارهای انجام‌شده و وضعیت فعلی (به‌روز: بهمن ۱۴۰۴).

---

## چطور تغییرات را در ظاهر ببینید

تغییرات در **کد** اعمال شده‌اند؛ برای دیدن آن‌ها در **ظاهر** اپ:

1. **اجرای فرانت‌اند با کد جدید**
   - از روت پروژه: `npm run dev`
   - یا اگر از پوشهٔ deploy استفاده می‌کنید، همانجا `npm run dev` را بزنید تا بیلد با فایل‌های به‌روز اجرا شود.

2. **رفتن به تب درست**
   - مسیر: **هوش مصنوعی (AI)** → **مدیریت AI (Manage AI)** → تب **Data Hub** → زیرتب **Telegram Collector**.

3. **محل دکمهٔ جدید**
   - در کارت **«Telegram Channels»** (ستون سمت راست)، کنار باکس جستجو و فیلترها، دکمهٔ سبز **«وارد کردن از تلگرام»** / **«Import from Telegram»** را می‌بینید.
   - با کلیک، مودال باز می‌شود و لیست کانال‌های عضو از تلگرام لود می‌شود؛ بعد می‌توانید انتخاب و ثبت کنید.

اگر اپ را از یک **build قدیمی** (مثلاً `dist/` یا سرور deploy بدون بیلد مجدد) اجرا می‌کنید، تا وقتی دوباره بیلد نگیرید یا از `npm run dev` استفاده نکنید، تغییرات در UI دیده نمی‌شوند.

**دستورهای دقیق build و deploy (مرحله‌به‌مرحله، با sudo در ترمینال خودتان):** فایل **`BUILD_AND_DEPLOY.md`** در روت پروژه.

---

## تب Telegram Collector

همهٔ تسک‌های `TELEGRAM_COLLECTOR_TASKS.md` انجام شده‌اند:

| تسک | شرح | وضعیت |
|-----|-----|--------|
| 1 | Import از تلگرام (دکمه + مودال + GET channels + POST register) | ✅ |
| 2 | View Messages (endpoint `/channels/:id/messages` + مودال پیام‌ها) | ✅ |
| 3 | Refresh Channels (آدرس صحیح + endpoint در collector) | ✅ |
| 4 | Link to Source (پاس دادن channelInfo از collectorChannels) | ✅ |
| 5 | ترجمه‌های ناقص (کلیدهای fa/en در deploy/blue/locales) | ✅ |

**مسیرهای مهم:**  
`TelegramPanel.tsx`, `useDataHub.ts`, `telegram-collector/dist/index.js`, `deploy/blue/locales/fa.json` و `en.json`.

---

## Data Hub – تسک‌های DHT

تقریباً همهٔ تسک‌های `DATAHUB_TELEGRAM_TASKS.md` انجام شده‌اند (Data Sources، Categories، Pipeline، Health، Access Logs، Advanced، Telegram Collector، Observability).

**تنها تسک باز (معوق برای فاز فعلی):**

- **TASK-DHT-012:** پشتیبانی از چند کانال برای یک DataSource  
  - تصمیم فعلی: رابطهٔ ۱به۱ کانال–منبع داده حفظ شده است.  
  - در فاز بعدی در صورت نیاز با `config.channels[]` و UI چندکاناله قابل توسعه است.

---

## گام‌های اختیاری بعدی

- پیاده‌سازی **TASK-DHT-012** در صورت نیاز به یک DataSource برای چند کانال.
- افزودن endpoint متریک دقیق‌تر (مثلاً `messages_24h` per account) در backend در صورت نیاز به نمایش در Account Summary.
- تکرار کلیدهای ترجمهٔ اضافه‌شده در `deploy/green/locales` در صورت استفاده از deploy سبز.

---

برای جزئیات هر تسک به فایل‌های `TELEGRAM_COLLECTOR_TASKS.md` و `DATAHUB_TELEGRAM_TASKS.md` مراجعه شود.
