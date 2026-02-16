# Multi‑Account Telegram Collector – Task Backlog & Design

این فایل طراحی و لیست کامل تسک‌های مرتبط با **Multi‑Account Telegram Collector** را نگه می‌دارد.  
هر وقت تسکی انجام شد، تیک آن را از `[ ]` به `[x]` تغییر می‌دهیم و در صورت نیاز توضیح کوتاهی زیرش می‌نویسیم.

---

## ۱. طراحی مدل داده و معماری

- [x] **TASK-MA-001: طراحی مدل داده چند اکانتی**
  - تعریف جدول/مدل `telegram_accounts` با فیلدهای پیشنهادی:
    - `id`, `phone`, `label`, `status`, `session_string`, `last_login_at`, `last_used_at`, `last_flood_until`, `is_primary`, `created_at`, `updated_at`.
  - اتصال کانال‌ها به اکانت‌ها از طریق `telegram_channels.account_id`.
  - در صورت نیاز، افزودن فیلد نمایشی مثل `account_label` در نمای کانال‌ها برای UI.
  - ✅ پیاده‌سازی شده در مایگریشن‌های:
    - `backend/migrations/20260213_add_telegram_accounts.sql`
    - `deploy/blue/backend/migrations/20260213_add_telegram_accounts.sql`
    - `deploy/green/backend/migrations/20260213_add_telegram_accounts.sql`

- [x] **TASK-MA-002: تعریف وضعیت‌ها و حالت‌ها برای اکانت**
  - تعریف enum وضعیت‌ها: `active`, `disabled`, `flooded`, `error`, `pending_login`.
  - پیاده‌سازی قوانینی که:
    - در login/start اگر اکانت در وضعیت `flooded` باشد و `last_flood_until > now`، درخواست با کد 429 و پیام FloodWait رد می‌شود.
    - در login/confirm روی FloodWait، وضعیت `flooded` و `last_flood_until` برای آن phone در جدول `telegram_accounts` ست می‌شود.
    - روی login موفق، `status = 'active'`، `last_login_at` و `last_used_at` آپدیت و `last_flood_until` خالی می‌شود.
  - ✅ منطق وضعیت‌ها در:
    - `telegram-collector/dist/utils/accountManager.js`
    - `telegram-collector/dist/index.js` (login/start و login/confirm چند اکانتی)

---

## ۲. بک‌اند – مدیریت سشن‌ها و چند اکانت

- [x] **TASK-MA-010: API مدیریت اکانت‌ها**
  - طراحی و پیاده‌سازی endpoint‌ها زیر `/api/telegram-collector`:
    - `POST /login/start` و `POST /login/confirm` اکنون **multi-account aware** هستند و session هر phone را در `telegram_accounts` ذخیره می‌کنند.
    - `GET /accounts` (لیست همه‌ی اکانت‌ها + وضعیت فعلی، flood_until، last_used_at، …).
    - `POST /accounts/:id/logout` (غیرفعال‌کردن اکانت و پاک‌کردن session_string).
    - `PATCH /accounts/:id` (تغییر `label`, `status`، `is_primary`).
  - ✅ پیاده‌سازی شده در:
    - `telegram-collector/dist/utils/accountManager.js`
    - `telegram-collector/dist/index.js` (endpointهای `/accounts` و تغییر login flow)

- [x] **TASK-MA-011: لایه Session Manager چند اکانتی**
  - تعریف abstraction‌هایی مانند:
    - `getDecryptedSessionForAccount(accountId)` برای گرفتن سشن decrypt شده‌ی هر اکانت به‌صورت امن + آپدیت خودکار `last_used_at`.
    - `getPrimaryAccountSession()` برای سناریوهای legacy که `account_id` مشخص نیست.
  - قوانین:
    - روی login موفق، `upsertAccountSession` مقداردهی `last_login_at` و `last_used_at` را انجام می‌دهد.
    - روی FloodWait، `markFloodForPhone` وضعیت را به `flooded` و `last_flood_until` را ست می‌کند.
  - ✅ پیاده‌سازی شده در:
    - `telegram-collector/dist/utils/accountManager.js`

- [x] **TASK-MA-012: انتخاب سشن مناسب برای هر کانال**
  - در Jobهای polling:
    - `channelPollingService` ستون `account_id` را از `telegram_channels` می‌خواند و به `getTelegramClient(accountId)` پاس می‌دهد.
    - اگر `account_id` مقدار داشته باشد، از سشن همان اکانت استفاده می‌شود؛ در غیر این صورت از primary account و در نهایت از سشن legacy.
  - در Test Fetch:
    - در `POST /api/telegram-collector/channels/:channelId/test` ابتدا تلاش می‌شود از روی `telegram_channels`، `account_id` پیدا شود و سشن همان اکانت استفاده شود، در غیر این صورت primary و در نهایت env.
  - ✅ پیاده‌سازی شده در:
    - `telegram-collector/dist/services/channelPollingService.js`
    - `telegram-collector/dist/index.js` (endpointهای `/telegram/:channel/recent` و `/channels/:channelId/test`)

---

## ۳. بک‌اند – مدیریت کانال‌ها و toggle per‑channel

- [x] **TASK-MA-020: API مدیریت کانال‌ها با نسبت به اکانت**
  - توسعه/اصلاح endpointهای کانال:
    - `GET /api/telegram-collector/collector-channels?account_id=...&status=enabled|disabled` برای فیلتر لیست کانال‌های ثبت‌شده در جدول `telegram_channels`.
    - `POST /api/telegram-collector/channels/register` برای ثبت/آپدیت کانال (با `is_active=true` به‌صورت پیش‌فرض، قابل ویرایش بعدی).
    - `PATCH /api/telegram-collector/collector-channels/:id` برای تغییر `is_active` (toggle per-channel) و `account_id`.
  - ✅ پیاده‌سازی شده در:
    - `telegram-collector/dist/index.js` (بخش CHANNEL MANAGEMENT ENDPOINTS)

- [x] **TASK-MA-021: منطق polling فقط روی کانال‌های فعال**
  - `channelPollingService` فقط کانال‌هایی را از دیتابیس می‌خواند که `is_active = true` دارند.
  - در `getTelegramClient(accountId)`:
    - اگر `account_id` ست باشد، سعی می‌کند سشن همان اکانت را لود کند و اگر در وضعیت `flooded` یا غیر `active` باشد، خطا می‌دهد و کانال در آن سیکل poll نمی‌شود.
    - در صورت نبود اکانت مشخص، به‌ترتیب از primary account و سشن legacy استفاده می‌کند.
  - ✅ پیاده‌سازی شده در:
    - `telegram-collector/dist/services/channelPollingService.js`
    - `telegram-collector/dist/index.js` (برای test fetch و API لیست کانال‌های Collector)

---

## ۴. بک‌اند – مدیریت Flood و خطاها

- [x] **TASK-MA-030: هندلینگ کامل FloodWait per‑account** (TASK-TC-008)
  - در زمان دریافت `FloodWaitError(seconds)` از GramJS:
    - ست‌کردن `last_flood_until = now + seconds` برای آن account در دیتابیس (markFloodForPhone؛ در confirm از authSession.phoneNumber).
    - بازگرداندن 429 و `retry_after_seconds` به frontend.
  - جلوگیری از:
    - ارسال مجدد `auth.SignIn` برای account تا قبل از `last_flood_until` (login/start چک می‌کند؛ accountManager getDecryptedSessionForAccount هم Flood را چک می‌کند).
    - استفاده از این account در polling و test fetch در بازه‌ی Flood (از طریق همان چک در getDecryptedSessionForAccount).

- [ ] **TASK-MA-031: نگاشت خطاها به پیام‌های کاربرپسند (multi‑account aware)**
  - به‌روزرسانی لایه‌ی map خطاها برای:
    - `PHONE_CODE_INVALID`, `PHONE_CODE_EXPIRED`, `SESSION_PASSWORD_NEEDED`, `FLOOD`, `FLOOD_WAIT`, `AUTH_KEY_UNREGISTERED`, …
  - پیام‌هایی که:
    - phone/account را مشخص کنند (در صورت لزوم).
    - به‌صورت دوزبانه (FA/EN) توضیح دهند مشکل دقیقاً چیست و کاربر چه کار باید بکند.

---

## ۵. فرانت‌اند – مدیریت چند اکانت

- [x] **TASK-MA-040: UI لیست اکانت‌ها + کارت وضعیت**
  - افزودن یک بخش «Accounts» در Telegram Collector:
    - نمایش لیست اکانت‌ها با ستون‌های: Phone, Label, Status, Last used, Flood until, Is primary.
    - نمایش badgeهای رنگی برای وضعیت‌ها (`active`, `disabled`, `flooded`, …).
  - اکشن‌های UI:
    - دکمه «Start Login Wizard» برای اضافه‌کردن اکانت جدید یا رفرش سشن.
    - دکمه «Logout / Disable» کنار هر اکانت.
    - امکان set کردن یک اکانت به‌عنوان Primary (در صورت نیاز معماری).
  - ✅ پیاده‌سازی شده در:
    - `components/ai/AIManager/tabs/DataHub/TelegramPanel.tsx` (بخش Accounts)

- [x] **TASK-MA-041: به‌روزرسانی Login Wizard برای حالت چند اکانتی**
  - Wizard بداند:
    - آیا در حال ایجاد account جدید است یا به‌روزرسانی account موجود (با استفاده از phone به عنوان کلید).
  - بعد از موفقیت:
    - در بک‌اند از طریق `upsertAccountSession` رکورد در `telegram_accounts` ایجاد/به‌روزرسانی می‌شود.
    - در فرانت‌اند بعد از لاگین موفق، `loadDataHub` صدا زده می‌شود تا وضعیت جدید در UI منعکس شود.
  - نمایش واضح FloodWait:
    - پیام مشخص برای محدودیت تلگرام (FloodWait) و شمارش معکوس `retry_after_seconds` در Wizard و هدر.
    - غیرفعال‌کردن دکمه «Start Login Wizard» و دکمه‌های login/confirm در بازه‌ی Flood.
  - ✅ پیاده‌سازی شده در:
    - `useDataHub.ts` (لاجیک شروع و تأیید لاگین + map خطاها + cooldown)
    - `TelegramPanel.tsx` (Modal Wizard چند مرحله‌ای با تکیه بر همان handlers)

---

## ۶. فرانت‌اند – مدیریت کانال‌ها و نسبت به اکانت

- [x] **TASK-MA-050: نمایش account برای هر کانال + فیلتر**
  - افزودن ستون/Badge در جدول کانال‌ها برای نمایش:
    - `account_label` یا `phone` (مثلاً `+98...5555 (Main)`).
  - فیلترهای UI:
    - فیلتر بر اساس account (dropdown یا pills).
    - فیلتر بر اساس وضعیت کانال (enabled/disabled).
  - ✅ پیاده‌سازی شده در:
    - `components/ai/AIManager/tabs/DataHub/TelegramPanel.tsx` (فیلتر account و status + نمایش account برای هر کانال)

- [x] **TASK-MA-051: toggle per‑channel (دکمه پاور برای هر کانال)**
  - افزودن سوییچ/دکمه پاور کنار هر ردیف کانال:
    - پیش‌فرض بعد از import: همه‌ی کانال‌ها `disabled`.
    - با روشن‌کردن toggle، کانال وارد جریان polling شود.
  - در بالای جدول:
    - mini‑cards برای تعداد کانال فعال، غیرفعال، و تفکیک‌شده بر اساس account (در صورت امکان).
  - ✅ پیاده‌سازی شده در:
    - `components/ai/AIManager/tabs/DataHub/TelegramPanel.tsx` (دکمه پاور per‑channel و محدودکردن اکشن‌ها در صورت نبود اکانت فعال)

---

## ۷. فرانت‌اند – UX و پیام‌ها

- [x] **TASK-MA-060: پیام‌های واضح برای Flood و محدودیت‌ها**
  - در Wizard و لیست اکانت‌ها:
    - نمایش پیام مشخص برای FloodWait همراه با مدت تقریبی.
    - تفکیک خطاهای:
      - اشتباه بودن کد،
      - منقضی‌شدن کد،
      - نیاز به پسورد 2FA،
      - Flood و محدودیت‌های زمانی.
  - i18n:
    - افزودن کلیدهای لازم به فایل‌های `en` و `fa` برای همه‌ی پیام‌های جدید.
  - ✅ پیاده‌سازی شده در:
    - `useDataHub.ts` (map خطاهای لاگین تلگرام به پیام‌های کاربرپسند برای FloodWait، کد اشتباه، کد منقضی، نیاز به پسورد)
    - `deploy/blue/locales/en.json` و `deploy/blue/locales/fa.json` (کلیدهای ترجمه جدید تلگرام)

- [x] **TASK-MA-061: جلوگیری از اکشن‌های نامعتبر**
  - غیرفعال‌کردن:
    - دکمه‌های `login/confirm` برای اکانت‌های `flooded` یا `disabled`.
    - دکمه‌های مربوط به polling/test fetch اگر هیچ اکانت فعال و سالمی وجود ندارد.
  - نمایش هشدار قبل از logout:
    - توضیح این‌که با logout، کانال‌های مربوطه دیگر داده دریافت نخواهند کرد تا account دیگری ست شود.
  - ✅ پیاده‌سازی شده در:
    - `useDataHub.ts` (جلوگیری از شروع login در بازه‌ی Flood و نمایش پیام مناسب)
    - `TelegramPanel.tsx` (غیرفعال‌کردن Test Fetch / Link to Source در صورت نبود اکانت active، نمایش شمارش معکوس Flood)

---

## ۸. Observability و تست

- [ ] **TASK-MA-070: متریک‌ها و لاگ‌ها برای multi‑account**
  - متریک‌های per‑account:
    - تعداد login موفق/ناموفق.
    - تعداد رخدادهای FloodWait و مدت آن‌ها.
    - تعداد کانال‌های متصل به هر account.
  - متریک‌های per‑channel:
    - آخرین fetch موفق، آخرین خطا، از کدام account انجام شده است.
  - به‌روزرسانی dashboard متریک‌ها در Data Hub (در صورت وجود).

- [ ] **TASK-MA-071: سناریوهای تست end‑to‑end**
  - تعریف سناریوهای تست دستی/اتوماتیک:
    - ساخت حداقل ۲ اکانت و لاگین موفق هر دو.
    - نسبت‌دادن چند کانال به هر اکانت.
    - فعال/غیرفعال‌کردن کانال‌ها و بررسی تأثیر روی polling.
    - شبیه‌سازی Flood روی یک اکانت و اطمینان از این‌که:
      - آن اکانت تا پایان Flood استفاده نمی‌شود،
      - بقیه‌ی اکانت‌ها و کانال‌هایشان بدون مشکل کار می‌کنند.

---

### یادداشت‌ها

- این تسک‌ها عمداً مقداری ریز و ماژولار نوشته شده‌اند تا بتوانیم آن‌ها را به‌تدریج و با کنترل خوب روی رفتار تلگرام و Flood پیاده‌سازی کنیم.
- هر زمان بخشی از این‌ها را پیاده کردیم، در همین فایل تیک مربوطه را می‌زنیم و در صورت نیاز لینک به commit یا توضیح کوتاه اضافه می‌کنیم.

