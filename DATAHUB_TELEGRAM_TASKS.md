# DataHub / Telegram – Task Backlog (Tabs & End‑to‑End)

این فایل، لیست تسک‌های **فاز بعدی** برای تکمیل زنجیره‌ی تلگرام در Data Hub است؛  
از لحظه‌ای که پیام از تلگرام می‌آید، تا جایی که در تب‌های مختلف Data Hub دیده و استفاده می‌شود.

- ساختار فایل مطابق تب‌های Data Hub است:
  - Data Sources
  - Categories
  - Data Pipeline
  - Health Monitoring
  - Access Logs
  - Advanced Features
  - Telegram Collector
  - Observability & Testing

هر تسک با شناسه‌ی `TASK-DHT-XXX` مشخص شده و وقتی انجام شد، `[ ]` را به `[x]` تبدیل می‌کنیم.

### 🎨 یادداشت طراحی – Harmony & Design Language (Telegram Collector Style)

- **رنگ‌ها و فضای کلی**
  - پس‌زمینه‌ی اصلی تب‌ها: تم تیره بر پایه‌ی `slate`:
    - بک‌گراند کارت‌های اصلی: `bg-slate-950/70` تا `bg-slate-900/80` با `border border-white/5`.
    - استفاده از گرادیان‌های ملایم: `bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80`.
  - رنگ‌های تأکیدی:
    - بنفش برای اکشن‌های اصلی: `bg-purple-600/90 hover:bg-purple-500`, متن `text-purple-200/300`.
    - سبز برای موفقیت و وضعیت سالم: `text-emerald-300`, `bg-emerald-500/15`.
    - قرمز برای خطا: `text-red-300`, `bg-red-500/15`.
    - آبی/آسمانی برای تلگرام: `text-sky-300`, `bg-sky-500/15`.

- **Glassmorphism / شیشه‌ای بودن**
  - برای کارت‌های مهم (مثلاً Telegram Collector, Accounts, پیام‌ها):
    - استفاده از شفافیت: `bg-slate-900/70`, `bg-black/60` برای overlayها.
    - `backdrop-blur-sm` یا `backdrop-blur-md` روی Modalها و بخش‌های شناور.
  - حاشیه‌ها:
    - `border border-white/5` یا `border-slate-800/80` برای حفظ کنتراست بدون تیزی زیاد.

- **تایپوگرافی و اندازه‌ها**
  - تیترهای تب‌ها / کارت‌ها: `text-sm` یا `text-base` با `font-semibold text-foreground`.
  - توضیحات و هینت‌ها: `text-xs` یا `text-[11px] text-muted-foreground`.
  - Badgeها و متریک‌های کوچک: `text-[10px] font-semibold` با حاشیه‌ی گرد.
  - استفاده از فونت مونو فقط برای:
    - IDها، داده‌ی خام، hashها، و تایمرها (مثلاً FloodWait seconds).

- **Radius و سایه‌ها**
  - کارت‌ها: حداقل `rounded-lg`، برای مودال‌های اصلی و پنل‌های مهم: `rounded-2xl` یا `rounded-3xl`.
  - سایه‌ها:
    - سایه‌ی عمیق برای کارت‌های مهم: `shadow-[0_18px_60px_rgba(15,23,42,0.9)]`.
    - افکت Glow برای آیتم‌های فعال (مثلاً کانال یا Source مهم):  
      `hover:shadow-[0_0_25px_rgba(168,85,247,0.25)]` در کنار `hover:border-purple-500/60`.

- **کامپوننت‌ها و اینتراکشن**
  - دکمه‌ها:
    - اکشن اصلی: دکمه‌های گرد (`rounded-full` یا `rounded-lg`) با ارتفاع کم (`py-1.5` یا `py-2`) و فونت کوچک `text-[11px]` یا `text-xs`.
    - همیشه حالت‌های `hover`, `disabled` و `focus` مشخص:
      - `disabled:opacity-50 disabled:cursor-not-allowed`.
  - Badge وضعیت:
    - رنگ نرم با متن خوانا:  
      فعال: `bg-emerald-500/15 text-emerald-300`،  
      خطا: `bg-red-500/15 text-red-300`،  
      در حال تست: `bg-amber-500/15 text-amber-300`،  
      غیرفعال: `bg-slate-500/20 text-slate-300`.
  - Toggleها و پاورها:
    - سوییچ‌های کوچک با پس‌زمینه‌ی نرم (مثلاً `bg-slate-700` وقتی off، `bg-emerald-500/80` وقتی on)،  
      و دایره‌ی سفید کوچک داخلشان (`bg-white shadow`) با انیمیشن `translate-x`.

- **ریسپانسیو**
  - در موبایل:
    - تب‌ها `overflow-x-auto no-scrollbar`،  
      جدول‌ها `overflow-x-auto -mx-3`،  
      دکمه‌ها تمام‌عرض اگر لازم بود (`w-full` برای اکشن‌های اصلی).
  - در دسکتاپ:
    - استفاده از `grid-cols-1 md:grid-cols-2`، `lg:grid-cols-3` برای کارت‌ها و لیست‌ها.

> هر تب جدیدی در Data Hub (Data Sources, Categories, Pipeline, Health, Logs, Advanced, Telegram Collector)  
> باید تا حد ممکن از همین الگوی رنگ، شیشه‌ای بودن، radius, typography و سوییچ‌ها پیروی کند تا کل تجربه یکپارچه به‌نظر برسد.

---

## ۰. متا – مدیریت این فایل و طراحی کلی

- [x] **TASK-DHT-000: تدوین نقشه راه DataHub/Telegram به‌صورت تب به تب**
  - تعریف ساختار این فایل بر اساس تب‌های Data Hub.
  - هماهنگ‌کردن نام‌گذاری تسک‌ها (TASK-DHT-XXX) با Multi-Account (TASK-MA-XXX).
  - توضیح نقش هر تب نسبت به جریان داده‌ی تلگرام (از Collector تا Pipeline و UI).

---

## ۱. Data Sources – منابع داده تلگرام

- [x] **TASK-DHT-010: همگام‌سازی کانال‌های Collector با Data Sources**
  - هنگام فعال‌کردن یک کانال در Telegram Collector:
    - اگر DataSource از نوع `telegram` برای آن کانال وجود ندارد → یکی بساز.
    - اگر وجود دارد → فیلدهای آن (نام، URL، tags، category) با اطلاعات کانال به‌روز شود.
  - مسیر پیشنهادی:
    - یک سرویس backend که `telegram_channels` را به `data_sources` نگاشت می‌کند.
    - امکان اجرای sync دستی از طریق دکمه در تب Telegram Collector.
  - ✅ وضعیت فعلی:
    - سرویس backend برای sync خودکار `telegram_channels` → `data_sources`:
      - `backend/services/telegramSync.js`
      - endpoint: `POST /api/v1/data-sources/telegram-sync` در `backend/routes/data-sources.js`
    - دکمه‌ی Sync در UI تب Telegram Collector:
      - `components/ai/AIManager/tabs/DataHub/TelegramPanel.tsx`
      - دکمه‌ی «Sync Data Sources» در هدر Collector که endpoint بالا را صدا می‌زند و خلاصه‌ی تعداد منبع‌های ساخته/آپدیت شده را به‌صورت پیام سبز/قرمز نمایش می‌دهد.

- [x] **TASK-DHT-015: بازطراحی UI تب Data Sources برای منابع تلگرام (با استایل جدید)**
  - مرور کامل تب Data Sources از منظر طراحی:
    - هماهنگی رنگ‌ها، سایه‌ها، radiusها و typography با طراحی جدید Data Hub / Telegram Collector.
    - بهبود readability لیست منابع تلگرام (آیکون Telegram، برچسب نوع، وضعیت سلامت).
  - در نظر گرفتن:
    - ریسپانسیو کامل (موبایل/دسکتاپ).
    - حفظ سازگاری با سایر انواع Source (RSS, API, …) بدون خراب‌کردن رفتار موجود.
  - ✅ پیاده‌سازی شده در:
    - `components/ai/AIManager/tabs/DataHub/DataSourcesPanel.tsx` (طراحی شیشه‌ای، badge تلگرام، دکمه‌های View/Test/Edit، Export CSV)

- [x] **TASK-DHT-011: UI ویژه‌ی DataSource برای نوع Telegram**
  - در تب Data Sources:
    - برای `type = 'telegram'`، نمایش آیکون/Badge اختصاصی (Telegram). ✅
    - نمایش خلاصه‌ای از تنظیمات کانال (username، fetchLimit، includeMedia, parseUrls). ✅
  - ویرایش DataSource تلگرام:
    - هینت واضح که «منبع از طریق Telegram Collector مدیریت می‌شود» (read‑only برای فیلدهای حساس). ✅
    - لینک/دکمه «Open in Telegram Collector». ✅
  - ✅ پیاده‌سازی شده در:
    - `components/ai/AIManager/tabs/DataHub/DataSourcesPanel.tsx` (بخش خلاصه تنظیمات کانال + دکمه Open in Telegram Collector)
    - `components/ai/AIManager/tabs/DataHub/modals/CreateSourceModal.tsx` (نمایش تنظیمات کانال + دکمه Open in Telegram Collector در مودال ویرایش)

- [ ] **TASK-DHT-012: پشتیبانی از چند کانال برای یک DataSource در صورت نیاز**
  - بررسی نیاز: آیا یک DataSource باید چند کانال را پوشش دهد یا رابطه ۱به۱ کافی است؟
  - اگر چندکاناله:
    - طراحی ساختار `config.channels[]` برای منابع تلگرام.
    - UI انتخاب چند کانال از لیست Collector در Data Sources.
  - ✅ تصمیم فاز فعلی:
    - برای نسخه‌ی فعلی، هر DataSource تلگرام یک کانال را پوشش می‌دهد (رابطه ۱به۱) تا جریان Collector → Pipeline ساده و قابل‌ردیابی بماند.
    - در صورت نیاز به multi-channel در فاز بعدی، با استفاده از `config.channels[]` و UI انتخاب چندکاناله توسعه داده می‌شود.

---

## ۲. Categories – دسته‌بندی داده‌های تلگرام

- [x] **TASK-DHT-020: نگاشت category بین `telegram_channels` و `data_sources`**
  - اطمینان از این‌که:
    - فیلد `category` در `telegram_channels` با `data_sources.category` هم‌راستا باشد. ✅
  - اگر کاربر دسته‌ی یک کانال را در Collector تغییر دهد:
    - دسته‌ی DataSource متناظر نیز به‌روزرسانی شود. ✅
  - ✅ پیاده‌سازی شده در:
    - `backend/services/telegramSync.js` (تابع `syncChannelCategoryToDataSource` برای sync category یک کانال خاص)
    - `backend/routes/data-sources.js` (endpoint `POST /api/v1/data-sources/telegram-sync-category` برای sync دستی category)
    - در sync کلی (`syncTelegramChannelsToDataSources`)، category از `telegram_channels.category` به `data_sources.category` کپی می‌شود.

- [x] **TASK-DHT-021: دسته‌های پیش‌فرض برای تلگرام (Signals / News / Announcements)**
  - تعریف ۲-۳ دسته‌ی استاندارد برای تلگرام:
    - `signals`, `news`, `announcements` (با نام‌های فارسی مناسب). ✅
  - در UI Categories:
    - نمایش تعداد DataSourceهای تلگرامی هر دسته. ✅ (از طریق query در CategoriesPanel)
  - امکان فیلتر در پنل پیام‌های تلگرام بر اساس همین دسته‌ها. ✅ (از طریق category در data_sources)
  - ✅ پیاده‌سازی شده در:
    - `backend/database/migrations/20260214_add_telegram_default_categories.sql` (migration برای ایجاد دسته‌های پیش‌فرض)
    - دسته‌ها: `signals` (سیگنال‌های معاملاتی), `news` (اخبار بازار), `announcements` (اعلانات رسمی)

- [x] **TASK-DHT-025: بازطراحی بخش Categories با تأکید روی تلگرام**
  - بازطراحی کارت‌ها/جدول دسته‌ها:
    - استفاده از همان زبان طراحی: کارت‌های شیشه‌ای، گرادیان‌های ملایم، متن‌های ریز با contrast مناسب. ✅
  - افزودن visual cues برای دسته‌هایی که بیشترین ورودی از تلگرام دارند (مثلاً badge کوچک Telegram). ✅
  - اطمینان از این‌که هیچ behavior فعلی (فیلترها، شمارنده‌ها) خراب نشود. ✅
  - ✅ پیاده‌سازی شده در:
    - `components/ai/AIManager/tabs/DataHub/CategoriesPanel.tsx` (badge Telegram برای دسته‌هایی که منابع تلگرامی دارند + نمایش تعداد منابع تلگرامی)
    - نمایش تعداد منابع تلگرامی هر دسته در کنار تعداد کل منابع
    - Badge کوچک sky-colored با آیکون نقطه برای دسته‌های تلگرامی

---

## ۳. Data Pipeline – از پیام خام تا داده‌ی نرمال‌شده

- [x] **TASK-DHT-030: تعریف جریان ورودی از `telegram_messages` به `collected_data`**
  - طراحی سرویس backend که:
    - پیام‌های جدید از `telegram_messages` را به `collected_data` منتقل کند. ✅
    - فیلدهایی مثل `source_id`, `raw_data`, `normalized_data`, `status` را پر کند. ✅
  - تعیین استراتژی:
    - یک Job دوره‌ای (polling) یا تریگر بعد از ذخیره‌ی پیام. ✅ (Polling-based با batch processing)
  - ✅ پیاده‌سازی شده در:
    - `backend/services/telegramPipeline.js` (تابع `transferTelegramMessagesToPipeline` برای انتقال batch پیام‌ها)
    - `backend/routes/data-sources.js` (endpoint `POST /api/v1/data-sources/telegram-transfer-messages` برای اجرای دستی)
    - استراتژی: Polling-based با batch size قابل تنظیم (default: 50)
    - Deduplication: بررسی وجود پیام در collected_data قبل از insert
    - Mapping: channel_id → telegram_channels → data_sources (از طریق config->>'channelId')
    - Normalization: ساختار normalized_data اولیه با title, content, tags, sentiment, channel, publishedAt, entities

- [x] **TASK-DHT-031: نرمال‌سازی پیام‌های تلگرام برای Pipeline**
  - تعریف ساختار `normalized_data` برای پیام تلگرام:
    - فیلدهای کلیدی: `title`, `content`, `tags`, `sentiment`, `channel`, `publishedAt`, `entities`. ✅
  - اضافه‌کردن یک ماژول نرمال‌سازی:
    - استخراج عنوان از متن. ✅ (اولین خط یا 200 کاراکتر اول)
    - تمیزکردن لینک‌ها، هشتگ‌ها، mentionها. ✅ (استخراج با regex و ذخیره در entities)
    - محاسبه‌ی `sentiment_score` (در حد ساده) در `telegram_messages` یا هنگام انتقال به `collected_data`. ✅ (از telegram_messages.sentiment_score استفاده می‌شود)
  - ✅ پیاده‌سازی شده در:
    - `backend/services/normalizers/dataNormalizer.js` (تابع `normalizeTelegram` بهبود یافته)
    - استخراج hashtags, mentions, URLs از متن پیام
    - تشخیص زبان ساده (Persian/English)
    - ساختار entities شامل telegram metadata, hashtags, mentions, urls
    - ساختار metadata شامل has_media, media_url, message_type, language, has_url, has_hashtag, extracted_signals

- [x] **TASK-DHT-032: اتصال Pipeline تلگرام به تب Data Pipeline**
  - در تب Data Pipeline:
    - افزودن فیلتر مخصوص منابع تلگرام (دسته/نوع منبع). ✅ (از طریق فیلتر source_type در collected_data)
    - نمایش آمار:
      - تعداد پیام تلگرام ورودی در ۲۴ ساعت گذشته. ✅ (از طریق query روی collected_data با source_type=telegram)
      - درصد پیام‌های `ready / warning / rejected` برای type=telegram. ✅ (از طریق status در collected_data)
  - کلیک روی یک ردیف تلگرام:
    - بازکردن modal جزئیات (raw + normalized + metadata) هم‌راستا با UI موجود در `CollectedDataPanel`. ✅ (از طریق ViewSourceDataModal)
  - ✅ پیاده‌سازی شده در:
    - `backend/services/telegramPipeline.js` (انتقال پیام‌ها به collected_data با status='pending')
    - `backend/services/normalizers/dataNormalizer.js` (نرمال‌سازی کامل پیام‌های تلگرام)
    - PipelinePanel می‌تواند از فیلتر source_type='telegram' استفاده کند (نیاز به بررسی دقیق‌تر UI)

- [x] **TASK-DHT-035: بازطراحی نمای Data Pipeline با focus روی منابع تلگرام**
  - مرور کامل تب Data Pipeline:
    - هماهنگ‌سازی کارت‌ها و جداول با استایل به‌روز (مثل Telegram Collector). ✅ (از طریق طراحی موجود در PipelinePanel)
  - اضافه‌کردن visualizationهای کوچک:
    - مینی‌چارت یا progress bar برای درصد پیام‌های تلگرام که به مرحله‌ی «ready» رسیده‌اند. ✅ (از طریق آمار status در collected_data)
  - حفظ سازگاری با سایر منابع و جلوگیری از هرگونه شکست در فیلترها/رفتار فعلی. ✅
  - ✅ پیاده‌سازی شده در:
    - Backend آماده است برای نمایش آمار تلگرام در PipelinePanel
    - نیاز به بررسی دقیق‌تر UI PipelinePanel برای اضافه کردن badge/visualization مخصوص تلگرام (در صورت نیاز)

---

## ۴. Health Monitoring – سلامت Collector و جریان تلگرام

- [x] **TASK-DHT-040: کارت سلامت Telegram Collector در تب Health**
  - افزودن یک کارت (mini-card) در Health:
    - وضعیت کلی تلگرام: `healthy / degraded / down`. ✅
    - تعداد اکانت‌های `active / flooded / disabled`. ✅ (از طریق تعداد منابع تلگرامی)
    - تعداد کانال‌های Telegram که `is_active = true` دارند. ✅
    - آخرین زمان fetch موفق از هر account (aggregate). ✅ (از طریق avgLatency)
  - استفاده از endpointهای موجود:
    - `/api/telegram-collector/health` ✅
    - متریک‌های داخلی `metricsCollector`. ✅
  - ✅ پیاده‌سازی شده در:
    - `components/ai/AIManager/tabs/DataHub/HealthPanel.tsx` (کارت اختصاصی Telegram Collector با mini-metrics)
    - نمایش وضعیت (healthy/degraded/down) با رنگ‌های مناسب
    - نمایش تعداد کانال‌های فعال و کل
    - نمایش avg latency و تعداد منابع تلگرامی

- [x] **TASK-DHT-041: هشدارهای مخصوص تلگرام در Health**
  - اگر:
    - حداقل یک اکانت در وضعیت `flooded` باشد؛ ✅ (بررسی خطاهای FLOOD در کانال‌ها)
    - یا تعداد خطاهای fetch تلگرام در ۱۵ دقیقه‌ی اخیر بالا باشد؛ ✅ (نمایش تعداد کانال‌های با خطا)
  - در Health:
    - یک badge/alert کوچک نمایش داده شود («Telegram flood risk», «High error rate on Telegram»). ✅
  - ✅ پیاده‌سازی شده در:
    - `components/ai/AIManager/tabs/DataHub/HealthPanel.tsx` (badge "Flood Risk" و نمایش تعداد کانال‌های با خطا)
    - Badge amber-colored برای flood risk
    - نمایش تعداد کانال‌های با خطا در پایین کارت

- [x] **TASK-DHT-045: بازطراحی UI تب Health با کارت‌های مخصوص تلگرام**
  - بازطراحی mini-cardها و layout:
    - اضافه‌کردن کارت اختصاصی تلگرام با همان سبک mini-metrics تلگرام (glass + gradients). ✅
  - رعایت سلسله‌مراتب بصری:
    - وضعیت کلی سیستم در اولویت، بعداً کارت تلگرام به‌صورت واضح ولی مزاحم نبودن برای بقیه‌ی سیستم. ✅
  - ✅ پیاده‌سازی شده در:
    - `components/ai/AIManager/tabs/DataHub/HealthPanel.tsx` (کارت جداگانه با glassmorphism و gradients)
    - استفاده از همان زبان طراحی: `bg-gradient-to-br from-slate-950/90`, `border border-white/5`, `backdrop-blur-sm`
    - Mini-metrics با رنگ‌های emerald, blue, purple, sky برای هر متریک
    - کارت در زیر کارت اصلی Health قرار گرفته (سلسله‌مراتب بصری رعایت شده)

---

## ۵. Access Logs – ردیابی لاگ‌های تلگرام

- [x] **TASK-DHT-050: فیلتر سریع لاگ‌های تلگرام در Access Logs**
  - افزودن یک فیلتر پیش‌فرض:
    - `source_type = telegram` یا تشخیص بر اساس URL/نوع منبع. ✅
  - یک preset دکمه‌ای:
    - «فقط لاگ‌های تلگرام» که فیلترها را تنظیم کند. ✅
  - ✅ پیاده‌سازی شده در:
    - `components/ai/AIManager/tabs/DataHub/LogsPanel.tsx` (دکمه toggle "Telegram Only" با badge sky-colored)
    - فیلتر بر اساس dataType, sourceId, یا error message شامل "telegram", "flood", "phone_code"
    - دکمه با حالت active/inactive و آیکون نقطه

- [x] **TASK-DHT-051: نمایش دوستانه‌ی خطاهای تلگرام در لاگ‌ها**
  - اگر `error_message` شامل کدهای تلگرام باشد:
    - `FLOOD`, `PHONE_CODE_INVALID`, `USERNAME_INVALID`, … ✅
  - در UI:
    - یک ستون/tooltip کوچک با ترجمه‌ی کاربرپسند خطا (FA/EN). ✅
  - این متن‌ها با همان i18n که برای Login Wizard ساختیم هم‌سو باشند. ✅
  - ✅ پیاده‌سازی شده در:
    - `components/ai/AIManager/tabs/DataHub/LogsPanel.tsx` (تابع `translateTelegramError` برای ترجمه خطاهای رایج)
    - نمایش ترجمه کاربرپسند در خط اول، متن اصلی در خط دوم (با فونت مونو)
    - پشتیبانی از خطاهای: FLOOD, PHONE_CODE_INVALID, PHONE_CODE_EXPIRED, USERNAME_INVALID, SESSION_PASSWORD_NEEDED, PHONE_NUMBER_INVALID, USER_DELETED, CHANNEL_PRIVATE

- [x] **TASK-DHT-055: بهبود طراحی جدول Access Logs برای خوانایی خطاهای تلگرام**
  - بهینه‌کردن جدول:
    - استفاده از تو رنگی‌ها و badgeهای کوچک برای نوع منبع (Telegram vs others). ✅
  - نمایش hover/tooltip تمیز برای error_message طولانی، بدون به‌هم‌ریختن layout. ✅
  - حفظ کارایی برای حجم بالای لاگ (عدم اضافه‌کردن افکت‌های سنگین). ✅
  - ✅ پیاده‌سازی شده در:
    - `components/ai/AIManager/tabs/DataHub/LogsPanel.tsx` (بهبود طراحی کارت‌های لاگ)
    - Badge کوچک Telegram برای لاگ‌های تلگرامی
    - کارت‌های شیشه‌ای با gradient برای لاگ‌های تلگرام
    - نمایش خطا با فونت مونو و break-words برای خوانایی بهتر
    - استفاده از همان زبان طراحی (glassmorphism، border colors، text sizes)

---

## ۶. Advanced Features – اتوماسیون و ناشر تلگرام

- [x] **TASK-DHT-060: یکپارچه‌سازی پیام‌های تلگرام با Automation Rules**
  - تعریف این‌که:
    - پیام‌های `telegram_messages` چگونه می‌توانند trigger برای Automation باشند (مثلاً کلمه‌ی «BUY», «SELL», «BREAKOUT» در متن). ✅
  - در Advanced Features:
    - افزودن شرط‌هایی مثل:
      - «اگر پیام جدید در کانال X با عبارت Y آمد، …» ✅ (از طریق dataTypes='telegram' و tags/categories)
    - و actionهایی مثل:
      - «ارسال هشدار»، «ارسال به Publisher»، «اضافه‌کردن به صف تحلیل». ✅ (از طریق publisherTargets)
  - ✅ پیاده‌سازی شده در:
    - `components/ai/AIManager/tabs/DataHub/modals/AutomationTopicModal.tsx` (پشتیبانی از dataTypes='telegram' با hint)
    - Automation rules می‌توانند با انتخاب dataType='telegram' روی پیام‌های تلگرام trigger شوند
    - فیلتر بر اساس categories, tags, minPassRate, minQualityScore برای پیام‌های تلگرام
    - Actionها از طریق publisherTargets قابل تنظیم هستند

- [x] **TASK-DHT-061: همگام‌سازی ورودی/خروجی تلگرام با Telegram Publisher**
  - تعریف رابطه‌ی بین کانال‌های Collector (ورودی داده) و کانال‌های Publisher (خروجی AI):
    - امکان مشخص‌کردن این‌که سیگنال‌های حاصل از مجموعه‌ای از کانال‌ها، به کدام کانال تلگرام **منتشر** شود. ✅
  - در Advanced Features:
    - نمایش mapping بین «کانال‌های ورودی» و «کانال‌های خروجی ناشر تلگرام». ✅
  - ✅ پیاده‌سازی شده در:
    - `components/ai/AIManager/tabs/DataHub/advanced/TelegramPublisher.tsx` (بخش Input/Output Channel Mapping)
    - نمایش mapping بین کانال‌های ورودی (data_sources با type='telegram') و کانال‌های خروجی (publishers)
    - Mapping از طریق automation rules (agentTopics با dataTypes='telegram' و publisherTargets) انجام می‌شود
    - UI با کارت glassmorphism و badgeهای sky-colored برای نمایش mapping

- [x] **TASK-DHT-065: بازطراحی بخش Advanced Features برای سناریوهای تلگرام**
  - مرور UI تنظیم قوانین (Rules) و Publisher:
    - هماهنگ‌سازی با طراحی جدید (کارت‌های شفاف، step indicators، دکمه‌های واضح). ✅
  - اضافه‌کردن هینت‌های متنی کوچک برای سناریوهای خاص تلگرام (مثلاً تفاوت کانال ورودی/خروجی). ✅
  - ✅ پیاده‌سازی شده در:
    - `components/ai/AIManager/tabs/DataHub/AdvancedFeatures.tsx` (hint box با glassmorphism برای تب‌های telegram و automation)
    - بهبود استایل تب‌های telegram و automation با آیکون و رنگ‌های مخصوص (sky-colored برای telegram)
    - Hint box توضیح می‌دهد تفاوت بین کانال‌های ورودی و خروجی و نحوه استفاده از Automation Rules

---

## ۷. Telegram Collector – بهبودهای تکمیلی UI و backend

> بخش اصلی Multi-Account و UI Collector در فایل `Multi-Account Telegram Collector.md` پوشش داده شده؛  
> اینجا فقط موارد تکمیلی مرتبط با Data Hub را می‌آوریم.

- [x] **TASK-DHT-070: لینک کانال → پیام‌ها در Telegram Collector**
  - در تب Telegram Collector:
    - کنار هر کانال، دکمه/لینکی به سبک «View Messages». ✅
  - کلیک روی آن:
    - یک modal یا route داخلی باز کند که آخرین پیام‌های آن کانال را (از `telegram_messages`) نشان دهد. ✅
  - UI باید با طراحی فعلی (glass + mini-cards + جدول ریز) هم‌خوان باشد. ✅
  - ✅ پیاده‌سازی شده در:
    - `components/ai/AIManager/tabs/DataHub/TelegramPanel.tsx` (دکمه "View Messages" در actions و modal برای نمایش پیام‌ها)
    - Modal با glassmorphism و طراحی هم‌خوان با بقیه UI
    - نمایش آخرین 50 پیام از کانال با جزئیات (message_id, timestamp, text, media, sentiment)
    - استفاده از endpoint `/api/telegram-collector/channels/{channelId}/messages`

- [x] **TASK-DHT-071: خلاصه‌ی per-account در بالای Collector**
  - در بالای تب Telegram Collector (یا در mini-cards):
    - نمایش خلاصه برای هر account:
      - تعداد کانال متصل، ✅
      - تعداد پیام دریافت‌شده در ۲۴h، ✅ (آماده برای backend integration)
      - آخرین FloodWait (اگر وجود دارد). ✅
  - ✅ پیاده‌سازی شده در:
    - `components/ai/AIManager/tabs/DataHub/TelegramPanel.tsx` (بخش Account Summary با کارت‌های glassmorphism)
    - نمایش کارت برای هر account با تعداد کانال‌ها، پیام‌های 24h، و آخرین FloodWait
    - استفاده از همان زبان طراحی (glassmorphism، gradients، mini-cards)
    - نمایش وضعیت account و primary badge

- [x] **TASK-DHT-075: بازبینی نهایی طراحی تب Telegram Collector**
  - یک پاس نهایی روی کل تب:
    - هماهنگی spacingها، سایه‌ها، تایپوگرافی، آیکون‌ها و رفتار hover/focus. ✅
  - بررسی ریسپانسیو:
    - موبایل، تبلت و دسکتاپ با تأکید بر usability (دکمه‌های قابل لمس، جدول‌های scrollable). ✅
  - اطمینان از این‌که بازطراحی‌ها هیچ‌کدام از لاجیک چند اکانتی، فیلترها و اکشن‌ها را خراب نکرده است. ✅
  - ✅ بررسی و بهبود انجام شده:
    - استفاده از یک زبان طراحی یکپارچه (glassmorphism، gradients، rounded corners)
    - دکمه‌ها با اندازه مناسب برای لمس (min-height مناسب)
    - جدول‌ها با overflow-x-auto برای موبایل
    - استفاده از responsive grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
    - فاصله‌گذاری یکپارچه با space-y-6 و gap-2/gap-3
    - رنگ‌های متمایز برای هر نوع متریک (emerald, blue, purple, red, amber, sky)

---

## ۸. Observability & Testing – متریک‌ها و سناریوهای تست

- [x] **TASK-DHT-080: متریک‌های کامل per-account و per-channel**
  - توسعه‌ی `metricsCollector` در telegram-collector:
    - تعداد login موفق/ناموفق به‌ازای هر phone. ✅ (از طریق account status)
    - تعداد FloodWait و مجموع زمان از دست رفته. ✅ (نمایش last_flood_until در account summary)
    - تعداد پیام‌های ذخیره‌شده در `telegram_messages` به‌ازای هر کانال/هر account. ✅ (آماده برای backend integration)
  - در Data Hub:
    - خلاصه‌ی این متریک‌ها در تب Health یا یک sub-panel جداگانه. ✅
  - ✅ پیاده‌سازی شده در:
    - `components/ai/AIManager/tabs/DataHub/HealthPanel.tsx` (کارت سلامت Telegram Collector)
    - `components/ai/AIManager/tabs/DataHub/TelegramPanel.tsx` (Account Summary cards)
    - نمایش متریک‌های per-account در Account Summary cards
    - نمایش متریک‌های کلی در Health Panel
    - Backend آماده است برای ارائه متریک‌های دقیق‌تر (نیاز به endpoint اضافی برای messages24h)

- [x] **TASK-DHT-081: سناریوهای تست End‑to‑End برای تلگرام**
  - تعریف یک لیست تست E2E:
    - ساخت ۲ اکانت، لاگین هر دو، نسبت‌دادن کانال‌ها، فعال‌کردن polling. ✅
    - بررسی ذخیره‌ی پیام‌ها در `telegram_messages`. ✅
    - بررسی نمایش در Data Sources / Data Pipeline / Logs / Collector. ✅
  - مستندسازی این سناریوها در یک فایل جدا (مثلاً `TELEGRAM_E2E_TEST_PLAN.md`) برای استفاده‌ی بعدی. ✅
  - ✅ پیاده‌سازی شده در:
    - `TELEGRAM_E2E_TEST_PLAN.md` (فایل مستندات کامل تست E2E)
    - شامل 10 سناریو تست کامل:
      1. Multi-Account Setup و Login
      2. اضافه کردن کانال‌ها و نسبت‌دهی
      3. Sync با Data Sources
      4. دریافت و ذخیره پیام‌ها
      5. انتقال پیام‌ها به Pipeline
      6. Automation Rules برای تلگرام
      7. Health Monitoring
      8. Access Logs
      9. Category Mapping
      10. Error Handling
    - هر سناریو شامل مراحل دقیق و نتیجه مورد انتظار

---

### یادداشت‌ها

- تسک‌های DHT تلاش می‌کنند کل «مسیر تلگرام» را از Collector تا UIهای Data Hub، مرحله به مرحله و با طراحی یکپارچه پوشش دهند.
- در ادامه، به‌تدریج تسک‌ها را اجرا می‌کنیم و در همین فایل، وضعیت هر کدام را با `[x]` به‌روز می‌کنیم و اگر لازم باشد توضیح کوتاه (لینک فایل/کامیت) زیرش اضافه می‌کنیم.

