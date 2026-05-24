## TITAN AI – SSOT v3.0 Finalization & Task List

**Owner**: Backend / Full-Stack Engineer  
**Goal**: تکمیل نهایی، نرمال‌سازی، و اتصال کامل کل AI Center (UI ↔ API ↔ DB ↔ Engine) تا رسیدن به یک SSOT v3.0 کاملاً عملیاتی و Production-grade.

این سند **فقط یک برنامه Audit نیست**؛ معیار موفقیت نهایی:

- [ ] هیچ تب یا زیرتب AI Center ناقص نباشد.
- [ ] هیچ UI-only بدون backend واقعی (مگر آگاهانه و مستند) باقی نماند.
- [ ] هیچ `UNKNOWN` در SSOT نهایی وجود نداشته باشد.
- [ ] همه تب‌ها و زیرتب‌ها (شامل DataHub و Telegram) از نظر UI ↔ API ↔ DB ↔ Worker کاملاً متصل و عملیاتی باشند.
- [ ] سیستم از نظر Confidence، Migration و Routing کاملاً Production-grade باشد.
- [ ] Training و Analytics واقعاً عملیاتی (نه فقط UI) و به backend و DB واقعی متصل باشند.
- [ ] Normalization اعتماد (Confidence) به‌صورت end-to-end (Agents ↔ Artemis ↔ Trading ↔ UI ↔ DB) کامل شده باشد.

در تمام تسک‌ها دو خط سراسری باید رعایت شوند:

- [ ] **نوسازی طراحی** طبق `DESIGN_SYSTEM_DATAHUB.md` (زبان طراحی تب Telegram Collector به‌عنوان مرجع واحد).
- [ ] **تکمیل فایل‌های ترجمه** (`en.json` و `fa.json` برای blue/green) برای هر UI جدید یا تغییر یافته.

---

## ۱. اصول و ریل‌های حاکم بر کار

### ۱.۱. روش R&D و استانداردسازی شواهد

- [x] تعریف و رعایت یک قاعده مشترک برای **شواهد**: هر ادعا در SSOT باید حداقل یک **File + Line** داشته باشد.
- [x] استفاده از `docs/ssot_v3/*` به‌عنوان **SSOT واحد**؛ عدم پراکندگی مستندات در فایل‌های متفرقه.
- [x] ثبت هر Gap / UNKNOWN / تصمیم معماری در `docs/ssot_v3/GAPS_AND_PLAN.md` قبل از اعمال تغییرات بزرگ.
- [x] پس از هر فاز Audit، بلافاصله تسک‌های **Completion فنی** همان فاز را اجرا کنیم (اجتناب از Documentation Loop).

### ۱.۲. Delivery Cadence (ضد Documentation Loop)

- [ ] هر فاز (۱ تا ۶) باید با یک **Demo قابل اجرا** ختم شود، نه فقط آپدیت فایل‌های `.md`.
- [ ] Demo هر فاز باید نشان دهد که:
  - [ ] Endpointهای مرتبط **واقعاً کار می‌کنند** (در محیط dev).
  - [ ] UI تب/زیرتب مربوطه **داده واقعی** را از backend/DB نمایش می‌دهد (نه mock).
- [ ] برای هر فاز، حداقل یکی از این دو نوع خروجی Demo وجود داشته باشد:
  - [ ] Screen recording کوتاه (گام‌های اجرا + نتیجه).
  - [ ] لیست دقیق مراحل تست (Steps to Reproduce) که هر کسی بتواند Demo را تکرار کند.
- [ ] هر PR مرتبط با این برنامه باید شامل سه جزء باشد:
  - [ ] **کد** (backend/frontend/scripts)؛
  - [ ] **آپدیت مستندات** (فایل‌های `docs/ssot_v3/*` متناسب با تغییرات)؛
  - [ ] **Evidence lines** (ارجاع به File+Line در `EVIDENCE.md`).

### ۱.۳. Owner / Reviewer Gate

- [ ] برای هر فاز، یک **Review checkpoint** تعریف می‌شود که در آن:
  - [ ] خروجی‌های فاز (کد + docs + Demo) مرور می‌شوند.
  - [ ] وضعیت آیتم‌های DOD مرتبط با همان فاز بررسی می‌شود.
- [ ] تغییر در Scope یا جابه‌جایی فازها فقط بعد از:
  - [ ] ثبت دلیل و تغییر در `GAPS_AND_PLAN.md`؛
  - [ ] تأیید Owner (همین نقش Backend/Full-Stack این سند).
- [ ] تا زمانی که Owner خروجی فاز را به‌صورت صریح تأیید نکرده، فاز «تمام شده» محسوب نمی‌شود.

### ۱.۴. تعریف دقیق «No UNKNOWN»

- [ ] مقدار `UNKNOWN` در Coverage Matrix فقط در حین Audit اولیه مجاز است و در پایان پروژه باید صفر شود.
- [ ] هر مورد `UNKNOWN` فقط در یکی از سه حالت زیر می‌تواند بسته شود:
  - [ ] **Resolved / Implemented**: منبع/مسیر/ماژول پیدا شده و پیاده‌سازی آن کامل شده است (Status به Implemented/Partial تغییر می‌کند).
  - [ ] **Deferred (Planned)**: عمداً به نسخه‌ی بعدی (مثلاً v3.1) موکول شده است؛ در این حالت باید:
    - [ ] دلیل defer؛
    - [ ] نسخه/تاریخ هدف؛
    - [ ] راه‌حل/جایگزین موقت (اگر لازم است)  
    در `GAPS_AND_PLAN.md` ثبت شود و در SSOT به‌عنوان Deferred علامت بخورد، نه UNKNOWN.
  - [ ] **Out of Scope / Removed**: به‌طور صریح تأیید شده که در Scope این نسخه نیست و حذف شده؛ در این صورت:
    - [ ] توضیح Out-of-scope بودن در `GAPS_AND_PLAN.md` ثبت شود؛
    - [ ] از ماتریس حذف یا به‌عنوان Removed علامت‌گذاری شود.

### ۱.۵. نوسازی طراحی (Design System DataHub)

### ۱.۲. نوسازی طراحی (Design System DataHub)

مرجع: `DESIGN_SYSTEM_DATAHUB.md` (ردیف‌های ۱۵ و چک‌لیست پایانی).

- [ ] شناسایی همه تب‌ها و زیرتب‌های مربوط به DataHub و Telegram در AI Center.
- [ ] برای هر تب:
  - [ ] بررسی وضعیت فعلی UI نسبت به Design System.
  - [ ] تعریف Delta (چه چیز باید از نظر رنگ، فاصله، تایپوگرافی، کارت، دکمه، جدول، مودال و … تغییر کند).
  - [ ] پیاده‌سازی تغییرات UI با کلاس‌های Tailwind پیشنهادی (`bg-slate-950`, `border-white/5`, `text-xs`, `badge`ها، `toggle`، مودال‌ها، جداول و…).
  - [ ] چک‌کردن دوباره طبق چک‌لیست سکشن ۱۵ سند Design System.
  - [ ] ثبت در SSOT (بخش UI آن تب) با شواهد.

### ۱.۶. ترجمه‌ها (i18n)

- [ ] تعریف قانون نام‌گذاری کلیدهای ترجمه برای AI Center (مثلاً `aiCenter.dataHub.telegram.*` و …).
- [ ] استخراج تمام متن‌های UI در تب‌ها و زیرتب‌های AI Center که:
  - [ ] ثابت متنی (hard-coded) هستند.
  - [ ] ترجمه ندارند یا ناقص هستند.
- [ ] اضافه‌کردن/اصلاح کلیدها در:
  - [ ] `deploy/blue/locales/en.json`
  - [ ] `deploy/blue/locales/fa.json`
  - [ ] `deploy/green/locales/en.json`
  - [ ] `deploy/green/locales/fa.json`
- [ ] اطمینان از استفاده از `t()` یا مکانیسم ترجمه رسمی پروژه در همه کامپوننت‌های AI Center.
- [ ] ثبت کلیدهای مهم در SSOT (کدام متن ↔ کدام کلید).

### ۱.۷. AI Center Tab Registry (برای عدم جاافتادن زیرتب‌ها)

- [x] ایجاد یک Registry رسمی برای همه تب‌ها و زیرتب‌های AI Center بر اساس کد UI.
- [x] تولید یک فایل خودکار/نیمه‌خودکار:
  - [x] `docs/ssot_v3/generated/UI_TABS.json`
- [x] ساختار پیشنهادی `UI_TABS.json`:
  - [x] `id` (کلید یکتا، مثلاً `aiManager.dataHub.telegram`)
  - [x] `labelKey` (کلید ترجمه)
  - [x] `routeOrViewKey` (query string یا مسیر router)
  - [x] `componentPath` (مسیر فایل React/Next)
- [x] Coverage Matrix (در `SSOT_v3.0.md`) باید:
  - [x] دقیقاً بر اساس این Registry پر شود.
  - [x] هیچ تب/زیرتب خارج از این Registry نداشته باشد.
  - [x] هیچ سطر Registry بدون سطر متناظر در Coverage Matrix باقی نماند.

### ۱.۸. API Contract Freeze برای Training / Analytics / Topic Routing

- [ ] قبل از پیاده‌سازی نهایی برای Training و Analytics و Topic Routing:
  - [x] `TRAINING_API_MAP.md` و `ANALYTICS_API_MAP.md` و بخش API مربوط به Topic Routing باید نوشته یا به‌روز شوند (API Map).
  - [ ] schemaها (مثلاً با zod یا TypeScript types) در backend و frontend sync شوند:
  - [ ] تعریف type/shared schema در لایه مشترک (در صورت وجود).
  - [ ] استفاده از همین schemaها برای validation در backend و typing در frontend.
- [ ] بعد از این مرحله، هر **تغییر در API Contract** برای این ماژول‌ها باید:
  - [ ] در یک PR جداگانه انجام شود.
  - [ ] دلیل تغییر و impact آن در `GAPS_AND_PLAN.md` یا `EVIDENCE.md` ثبت شود.

### ۱.۹. Production Hardening (Logging / Monitoring / Recovery)

- [ ] تعریف حداقل‌های Production-grade برای ماژول‌های AI:
  - [ ] Logging استاندارد برای:
    - [ ] Training jobs (start/end, status, errors).
    - [ ] Analytics aggregations (زمان اجرا، تعداد رکورد، خطا).
    - [ ] Trading Engine start/stop + emergency stop (چه زمانی، چه کسی/چه ماژولی).
    - [ ] Artemis decision calls (با `requestId` یا `correlationId` برای trace).
  - [ ] Health endpoints برای سرویس‌های حیاتی:
    - [ ] Backend API.
    - [ ] Workers اصلی (ingestion, training, analytics, trading).
  - [ ] حداقل Rate-limit و Auth check برای endpoints حساس:
    - [ ] endpoints مربوط به trading actions، autopilot، topic routing rules، training triggers.
- [ ] مستندسازی این موارد در:
  - [ ] `ENVIRONMENT.md` (نحوه مانیتورینگ و health).
  - [ ] `EVIDENCE.md` (ارجاع به پیاده‌سازی logging/health/rate-limit).

### ۱.۱۰. Data Migration Safety برای Backfill Confidence

- [x] اسکریپت backfill confidence باید:
  - [x] یک **dry-run mode** داشته باشد که:
    - [x] فقط تعداد ردیف‌های کاندید و نمونه‌ای از آن‌ها را گزارش کند.
    - [x] هیچ تغییری در DB ایجاد نکند.
  - [x] **transaction-safe** باشد:
    - [x] تا حد امکان آپدیت‌ها در تراکنش‌های منطقی (batch) انجام شود.
  - [x] یک **گزارش خروجی** (report) تولید کند:
    - [x] تعداد rows updated برای هر جدول (`ai_decisions`, `autopilot_actions`).
    - [x] تعداد rows skipped و دلیل (مثلاً null, out-of-range).
  - [x] یک **rollback plan** داشته باشد:
    - [x] یا با استفاده از snapshot/backup قبل از اجرای script (توصیه و مستند در `NORMALIZATION.md`).
    - [x] یا با نگه‌داشتن مقدار قبلی در ستون جداگانه/backup موقت (اگر معماری اجازه دهد).

---

## ۲. فاز ۱ – Baseline & Health Verification

### ۲.۱. Task 1.1 – Environment Audit → `docs/ssot_v3/audit/ENVIRONMENT.md`

**هدف**: مستندسازی وضعیت محیط اجرا (Node، DB، Package Manager، نحوه استارت سرویس‌ها، ENV keys).

- [x] استخراج نسخه Node:
  - [x] بررسی `package.json` (scripts و نوع پروژه).
  - [x] اجرای `node -v` در محیط (ثبت نسخه مشاهده‌شده).
- [x] تعیین Package Manager اصلی (npm / yarn / pnpm) و نسخه:
  - [x] اجرای `npm -v` و `yarn -v` (ثبت نسخه مشاهده‌شده).
- [x] تعیین نسخه DB (Postgres):
  - [x] اجرای `psql --version` (ثبت نسخه مشاهده‌شده).
  - [x] تست اتصال DB با `psql` (ثبت به‌عنوان Runtime evidence در ENVIRONMENT).
- [x] لیست کردن **نام** متغیرهای ENV موردنیاز (بدون مقادیر):
  - [x] استخراج از `.env.example`ها + `ecosystem.config.json`.
  - [x] جست‌وجو در backend برای `process.env.*` و تکمیل لیست.
- [x] مستندسازی نحوه استارت Backend:
  - [x] scripts: `backend/package.json` (`start/dev/migrate`).
  - [x] PM2 ecosystem (runtime-external) برای production: `backend/ecosystem.config.json`.
- [x] مستندسازی نحوه استارت Workers:
  - [x] in-process workers در `backend/server.js`.
  - [x] worker جدا (PM2): `titan-engine-worker` با entrypoint مشخص.
- [x] مستندسازی نحوه استارت Frontend:
  - [x] scripts ریشه پروژه (`dev/build/preview`).

**خروجی مورد انتظار `ENVIRONMENT.md`:**

- [x] Section: Runtime Stack (Node, DB, Package Manager).
- [x] Section: Services (Backend، Frontend، Workers) + دستورات دقیق.
- [x] Section: ENV Keys (فهرست اسمی).
- [x] ارجاع و Evidence (source files + کشف‌های کلیدی).

### ۲.۲. Task 1.2 – Health & Runtime Verification → `docs/ssot_v3/audit/HEALTHCHECK.md`

**هدف**: اطمینان از زنده‌بودن و صحت اندپوینت‌های اصلی AI/Trading/Artemis و ثبت وضعیت واقعی آن‌ها.

- [x] پیدا کردن پیاده‌سازی‌های زیر در backend:
  - [x] `/api/v1/artemis/health`
  - [x] `/api/v1/trading-engine/status`
  - [x] `/api/v1/ai-agents`
  - [x] `/api/v1/topic-routing`
  - [x] Training: `/api/v1/training/sessions`
  - [x] Analytics-like: `/api/v1/artemis/logs`, `/api/v1/artemis/learning`, `/api/v1/artemis/orchestration`
- [x] اجرای عملی هر endpoint (در محیط dev):
  - [x] تست با curl و JWT dev (بدون session).
  - [x] ثبت status code و خلاصه body در `HEALTHCHECK.md`.
- [x] Completion فوری روی مشکلات کشف‌شده:
  - [x] Fix: `GET /api/v1/artemis/health` (validation schema mismatch روی `weight`).
  - [x] Fix: `GET /api/v1/artemis/logs` (ستون‌های اشتباه `input/output`).

**خروجی `HEALTHCHECK.md`:**

- [x] جدول: Path | Method | Status (OK/Fail/Partial) | Sample Response | Evidence (File+Line).
- [x] بخش «Runtime Notes» برای dependencyهای external (PM2, Docker, systemd).

### ۲.۳. Task 1.3 – Backend Route Inventory → `ROUTES.md` + `ROUTES.json`

**هدف**: ایجاد یک نقشه کامل و قابل اتکا از همه روت‌های backend برای SSOT و Automation.

- [x] خواندن `backend/routes/v1/index.js` و تمامی روت‌فایل‌هایی که از آن import می‌شوند.
- [x] شناسایی همه routeها:
  - [x] Method (GET/POST/PUT/DELETE/…).
  - [x] Path کامل.
  - [x] Middlewareهای Auth (JWT) و Role (از `authorize(requiredRoles)`).
  - [x] فایل مبدأ handler (module source file).
- [x] تعریف ساختار استاندارد JSON برای هر route:
  - [x] `method`
  - [x] `path`
  - [x] `authRequired` (bool)
  - [x] `requiredRole` (string/array/nullable)
  - [x] `sourceFile`
- [x] تولید `docs/ssot_v3/generated/ROUTES.json` بر اساس همین ساختار (بدون فرضیات؛ فقط بر پایه‌ی کد).
- [x] تولید `docs/ssot_v3/generated/ROUTES.md` به‌صورت جدول خوانا از روی JSON.

قواعد:

- [ ] هیچ فیلدی بدون شاهد کدی تنظیم نشود (No assumptions).
- [ ] اگر نقش/سطح دسترسی در خود handler چک می‌شود، این موضوع در SSOT توضیح داده شود.

---

## ۳. فاز ۲ – AI Center Full Coverage Matrix → `docs/ssot_v3/SSOT_v3.0.md`

### ۳.۱. طراحی ماتریس پوشش

**هدف**: پوشش کامل همه تب‌ها و زیرتب‌های AI Center با وضعیت دقیق پیاده‌سازی.

- [ ] تعریف جدول Coverage با ستون‌ها:
  - [ ] `Module`
  - [ ] `UI`
  - [ ] `API`
  - [ ] `DB`
  - [ ] `Worker`
  - [ ] `Status` (Implemented / Partial / UI-Only / Missing / UNKNOWN)
  - [ ] `Evidence` (حداقل File+Line)
- [ ] توضیح قواعد پر کردن ستون Status:
  - [ ] Implemented: همه لایه‌ها (UI, API, DB, Worker) عملیاتی و متصل.
  - [ ] Partial: بخشی از لایه‌ها یا سناریوها ناقص.
  - [ ] UI-Only: UI وجود دارد اما backend واقعی ندارد (باید آگاهانه و مستند باشد).
  - [ ] Missing: تب/زیرتب در طراحی در نظر گرفته شده ولی پیاده‌سازی نشده.
  - [ ] UNKNOWN: **در پایان کار باید صفر شود**؛ فقط در فازهای اولیه مجاز است.

### ۳.۲. AI Manager – DataHub و زیرتب‌ها

تب‌ها و زیرتب‌های DataHub (نمونه‌ها، بسته به ساختار واقعی):

- Telegram
- Data Sources
- Categories
- Data Pipeline
- Health
- Logs / Access Logs
- Advanced Features

برای **هر تب/زیرتب**:

- [ ] Audit UI:
  - [ ] شناسایی کامپوننت‌های React/Next مربوطه.
  - [ ] شناسایی stateها، hooks، useSWR / fetch / axios callها.
  - [ ] بررسی استفاده از Design System (`DESIGN_SYSTEM_DATAHUB.md`) و ثبت اختلاف‌ها.
- [ ] Audit API:
  - [ ] شناسایی اندپوینت‌های backend که این تب استفاده می‌کند.
  - [ ] بررسی وجود واقعی endpointها، schema ورودی/خروجی، error handling.
- [ ] Audit DB:
  - [ ] جداول، ستون‌ها، ایندکس‌ها و روابط مرتبط با این تب.
  - [ ] هرگونه logging / history / audit trail مربوطه.
- [ ] Audit Workers:
  - [ ] jobها و workers درگیر با این تب (ingestion, health checks, background sync و …).
- [ ] تکمیل سطر Coverage Matrix برای این تب:
  - [ ] پرکردن ستون‌های UI, API, DB, Worker.
  - [ ] تعیین Status نهایی (هدف: Implemented).
  - [ ] اضافه‌کردن Evidence (File+Line) برای هر ستون.
- [ ] در صورت وجود Gap:
  - [ ] ثبت در `GAPS_AND_PLAN.md`.
  - [ ] **اجرای تسک‌های Completion فنی**: پیاده‌سازی backend/DB/Worker تا جایی که شکاف برطرف شود.
- [ ] اعمال نوسازی طراحی طبق Design System برای این تب.
- [ ] به‌روزرسانی ترجمه‌ها برای متن‌های UI این تب.

#### ۳.۲.۱. Telegram Panel / Collector / Agent Detail

**به‌صورت ویژه، چون تب مرجع طراحی و همچنین قلب DataHub است:**

- [x] بررسی کامل `Telegram` DataHub:
  - [x] UI: لیست accountها، channelها، status، health، flood detection، و …
  - [x] API: endpointهای health, stats, agents feed, breaking-news و …
  - [x] DB: جداول تلگرام، messageها، agent impacts، health stats.
  - [x] Workers: collectorها و پردازشگرهای تلگرام در سرویس `telegram-collector` (فعال در محیط‌های اصلی).
- [x] Agent Detail Panel:
  - [x] Wiring بین Agent Detail UI و backend (`/api/v1/telegram/agents/:agentKey/feed` و `mark-processed`).
  - [x] نمایش confidence و سایر متریک‌ها (impact, priority, sentiment، timestamps).
  - [x] Queue / Automation toggles (فعال/غیرفعال) به‌صورت آماده برای توسعه‌ی بعدی (با placeholder امن).
- [x] ثبت وضعیت Confidence (قبل و بعد از normalization) برای استفاده در فاز ۳ در `NORMALIZATION.md` و تست‌های `transformAgentResultForUI`.
- [x] اطمینان از اینکه این تب **به‌طور کامل عملیاتی** است (UI ↔ API ↔ DB ↔ Workers) و با داده واقعی کار می‌کند، نه فقط UI زیبا.

### ۳.۳. Agents

- [ ] یافتن registry اصلی agents (ماژول مرکزی).
- [ ] یافتن و مرور `agentSchemas`.
- [ ] بررسی `transformAgentResultForUI`:
  - [ ] شکل نهایی دیتا برای UI.
  - [ ] فیلدهای مربوط به confidence، scores، explanations.
- [ ] بررسی logging نتایج به جدول `ai_decisions`:
  - [ ] Schema جدول.
  - [ ] زمان ثبت، ارتباط با agent و context.
- [ ] بررسی accuracy metrics:
  - [ ] نحوه محاسبه accuracy، precision/recall (در صورت وجود).
  - [ ] نقش confidence در این محاسبات.
- [ ] تکمیل سطرهای Coverage Matrix برای ماژول Agents (Status هدف: Implemented).
- [ ] در صورت نبود یا ناقص بودن توابع/مسیرها:
  - [ ] ثبت Gap و سپس پیاده‌سازی/تکمیل backend و DB تا رفع Gap.

### ۳.۴. Training

**نکته مهم**: Training نباید در حالت «UI زیبا ولی backend ناقص» باقی بماند.

- [ ] جست‌وجو و بررسی:
  - [ ] `fetchTrainingData`
  - [ ] `scheduleAITrainingSession`
  - [ ] `completeAITrainingSession`
  - [ ] `artemisAutoConfigureTraining`
- [ ] Mapping بین این توابع و اندپوینت‌های backend:
  - [ ] وجود routهای واقعی برای هرکدام.
  - [ ] مدل درخواست/پاسخ.
- [ ] اتصال به DB:
  - [ ] جداول training jobs, training datasets, training sessions (در صورت وجود / طراحی).
- [ ] اگر backend واقعی برای Training وجود نداشت یا ناقص بود:
  - [ ] پیاده‌سازی **حداقل REST contract واقعی** (CRUD/operations لازم).
  - [ ] اتصال UI به این APIها (حذف/کاهش هرگونه mock/IndexedDB simulation نامناسب).
  - [ ] مستندسازی کامل در `TRAINING_API_MAP.md`.
- [ ] تکمیل سطر Training در Coverage Matrix (Status هدف: Implemented).

### ۳.۵. Analytics

**نکته مهم**: Analytics باید واقعاً به `ai_decisions` و `ai_learning_events` متصل باشد، نه شبیه‌سازی.

- [ ] بررسی `fetchAnalyticsData` و سایر توابع/اندپوینت‌های مربوط به Analytics.
- [ ] بررسی aggregationهای روی `ai_decisions`:
  - [ ] چه متریک‌هایی محاسبه می‌شود (win rate, hit rate, PnL, accuracy و…).
  - [ ] استفاده از confidence در این محاسبات.
- [ ] بررسی استفاده از `ai_learning_events`:
  - [ ] چه رویدادهایی ثبت می‌شود.
  - [ ] چگونه در Analytics مصرف می‌شود.
- [ ] اتصال UI Analytics به API واقعی:
  - [ ] حذف/اصلاح هرگونه mock.
- [ ] اگر backend Analytics ناقص است:
  - [ ] پیاده‌سازی endpointهای لازم و اتصال به DB.
  - [ ] مستندسازی در `ANALYTICS_API_MAP.md`.
- [ ] تکمیل سطر Analytics در Coverage Matrix (Status هدف: Implemented).

### ۳.۶. API Config

- [ ] بررسی تب API Config در UI.
- [ ] تأیید اینکه رفتار آن redirect به Settings → Configuration → Integrations است (در صورت صحت).
- [ ] اگر فقط نقش redirect/Link دارد:
  - [ ] علامت‌گذاری به‌عنوان UI-Only **آگاهانه** در Coverage Matrix.
  - [ ] مستندسازی Evidence (کامپوننت UI + absence of backend routes).

### ۳.۷. Topic Routing

- [ ] یافتن تمام CRUD routes مربوط به Topic Routing:
  - [ ] create/update/delete/get rules.
- [ ] بررسی جداول DB:
  - [ ] topic routing rules, logs, history (در صورت وجود).
- [ ] بررسی UI toggle activation:
  - [ ] درک اینکه toggle در UI چگونه endpoint و DB را تغییر می‌دهد.
- [ ] در صورت وجود Gap:
  - [ ] تکمیل backend/DB/Workers تا wiring کامل شود.
- [ ] تکمیل سطرهای Topic Routing در Coverage Matrix (هدف: Implemented).

### ۳.۸. Trading Engine Integration

- [x] پیدا کردن routهای start/stop برای trading engine.
- [x] بررسی opportunity queue:
  - [x] شکل صف.
  - [x] نحوه ورود داده‌ها (signals/decisions).
- [x] بررسی DB writes:
  - [x] جداول trades, portfolios, positions و… .
- [x] بررسی Artemis decision call:
  - [x] از کجا و چگونه صدا زده می‌شود (کدام فایل/فانکشن).
- [x] بررسی ENV-based worker startup:
  - [x] نحوه روشن شدن workers مرتبط با trading/Artemis بر اساس ENV.
- [x] تکمیل سطرهای Trading Engine در Coverage Matrix (هدف: Implemented).

---

## ۴. فاز ۳ – Confidence Normalization (Critical) → `docs/ssot_v3/NORMALIZATION.md`

**قانون نهایی**: همه‌ی Confidenceهای عملیاتی باید در بازه **۰–۱۰۰ درصد** باشند.  
استثناء: فقط سطوح آماری A/B (مثل `confidence_level` در تست‌های آماری) می‌توانند ۰–۱ باقی بمانند و باید واضح مستند شوند.

### ۴.۱. شناسایی وضعیت فعلی

- [x] جست‌وجوی global برای `confidence` در Backend.
- [x] جست‌وجوی استفاده‌های confidence در Frontend (UI).
- [x] دسته‌بندی همه‌ی استفاده‌ها:
  - [x] نمونه‌های ۰–۱ float.
  - [x] نمونه‌های ۰–۱۰۰ percent.
  - [x] نمونه‌هایی که در UI `* 100` انجام می‌دهند.
- [x] ثبت جدول «قبل/بعد» در `NORMALIZATION.md`:
  - [x] ماژول | فایل | Line | نوع فعلی | توضیح (شامل استثناءهای non-operational مثل impact/type-detection).

### ۴.۲. Task 3.1 – ایجاد `backend/utils/normalizeConfidence.js`

- [x] طراحی API تابع:
  - [x] مثال: `normalizeConfidence(raw: number | null | undefined): number | null`.
- [x] پیاده‌سازی منطق:
  - [x] اگر مقدار null/undefined/NaN است، رفتار مشخص و مستند (مثلاً `null` برگردد).
  - [x] اگر `0 ≤ c ≤ 1` → `c * 100`.
  - [x] در نهایت مقدار را بین ۰ تا ۱۰۰ clamp کند.
- [x] اضافه‌کردن تست‌های واحد برای سناریوهای:
  - [x] ورودی ۰، ۰.۵، ۱.
  - [x] ورودی ۵۰، ۷۵، ۱۲۰ (clamp).
  - [x] null، undefined، NaN.

### ۴.۳. Task 3.2 – اعمال در سطح Agent Output

- [x] شناسایی تمام فایل‌های agents: `technical.js`, `fundamental.js`, و سایر agents.
- [x] در خروجی همه‌ی agents (لایه‌ی Adapter/UI/Logging):
  - [x] اطمینان از اینکه فیلد confidence توسط `normalizeConfidence` عبور می‌کند (در `transformAgentResultForUI` و `logAndReturn`).
  - [x] اطمینان از اینکه خروجی مصرف‌شده در UI/DB همیشه ۰–۱۰۰ است.
- [x] به‌روزرسانی یا ایجاد تست‌های مناسب برای هر agent (در صورت وجود test suite).
- [x] ثبت نقاط اصلی استفاده از `normalizeConfidence` در `NORMALIZATION.md` با توضیح لایه‌ها.

### ۴.۴. Task 3.3 – Artemis Decision

- [x] یافتن endpoint `/api/v1/artemis/decision`.
- [x] شناسایی فیلدهای زیر در منطق Artemis:
  - [x] `opportunity.confidence`
  - [x] `mixture.confidence`
  - [x] `totalConfidence` یا هر متغیر مشابه.
- [x] اطمینان از اینکه:
  - [x] همه‌ی این فیلدها از `normalizeConfidence` عبور می‌کنند (در لایه ورودی مناسب).
  - [x] همه در بازه ۰–۱۰۰ عمل می‌کنند.
- [x] تنظیم thresholdهای Artemis بر اساس ۰–۱۰۰ (مثلاً ۷۵%):
  - [x] حذف هرگونه وابستگی به ۰–۱ در threshold.
  - [x] مستندسازی threshold جدید در `NORMALIZATION.md`.

### ۴.۵. Task 3.4 – UI Multipliers

- [x] جست‌وجوی تمام نقاطی که در UI از `* 100` برای confidence استفاده می‌کنند (به‌ویژه در تب‌های DataHub و AIAgents).
- [x] پس از استانداردسازی backend:
  - [x] حذف این ضرب‌ها در Telegram DataHub (AgentDetailPanel, TelegramDataPanel, BreakingNewsMonitor) و `AIAgents`.
  - [x] تطبیق labels (نمایش `%` در UI) بر اساس ۰–۱۰۰.
  - [x] اطمینان از سازگاری با Tooltipها، متون توضیحی و رنگ‌بندی status در همین تب‌ها.

### ۴.۶. Task 3.5 – Historical DB Backfill Script → `backend/scripts/backfill_confidence_to_percent.js`

- [x] ایجاد اسکریپت Node برای backfill:
  - [x] هدف: جداول `ai_decisions` و `autopilot_actions`.
- [x] منطق:
  - [x] انتخاب همه‌ی ردیف‌هایی که `confidence <= 1` و `confidence IS NOT NULL`.
  - [x] بروزرسانی مقدار آن‌ها به `confidence * 100`.
  - [x] log (خروجی JSON) شامل تعداد کاندیدها و به‌روزرسانی‌ها برای هر جدول.
- [x] اجرای dry-run روی محیط dev/test.
- [x] مستندسازی:
  - [x] وضعیت کلی قبل/بعد backfill و محل اسکریپت در `NORMALIZATION.md`.
  - [x] اضافه‌کردن آمار دقیق تعداد ردیف‌های اصلاح‌شده و هر issue احتمالی پس از اجرای واقعی.

---

## ۵. فاز ۴ – Migration Standardization

**هدف**: حذف دوگانگی migrationها و اطمینان از اینکه یک مسیر مشخص و تمیز برای bootstrap DB وجود دارد.

### ۵.۱. Task 4.1 – Single Migration Authority

- [x] بررسی وضعیت فعلی:
  - [x] `backend/database/migrations` (node-pg-migrate، استفاده‌شده توسط `database/migrate.js` و اسکریپت‌های npm).
  - [x] `backend/migrations` (legacy SQL/JS که در اسکریپت‌های فعلی استفاده نمی‌شود).
- [x] تصمیم معماری:
  - [x] اعلام رسمی در SSOT که تنها منبع معتبر migration: مسیر node-pg-migrate (`database/migrations`) + دستور `npm run migrate`.
- [x] مستندسازی این تصمیم در:
  - [x] `ENVIRONMENT.md` (نحوه اجرای migrations).
  - [x] `DOD_CHECKLIST.md` (آیتم Single migration path).

### ۵.۲. Task 4.2 – Legacy Migrations

- [x] تحلیل محتوای `backend/migrations`:
  - [x] شناسایی فایل‌های legacy (چند migration قدیمی برای AI/Backtest/Liquidity که در chain فعلی node-pg-migrate لحاظ نشده‌اند).
- [x] انتخاب استراتژی:
  - [x] علامت‌گذاری `backend/migrations` به‌عنوان Legacy/Archive با README واضح (بدون استفاده در مسیر رسمی).
- [x] اطمینان از اینکه در CI و scripts دپلوی، از مسیر legacy استفاده نمی‌شود (اسکریپت‌های `backend/package.json` فقط از `database/migrate.js` استفاده می‌کنند).

### ۵.۳. Task 4.3 – Greenfield Bootstrap Migration – `000_init_ai_schema.sql`

- [x] طراحی schema پایه AI:
  - [x] جدول `ai_agents` (registry اصلی agents).
  - [x] جدول `artemis_state` (وضعیت سراسری Artemis).
  - [x] جدول پایه برای `autopilot_actions` و `ai_decisions` (برای greenfield؛ جزئیات تکمیلی در migrationهای بعدی).
- [x] نوشتن migration/SQL که:
  - [x] یک DB خالی را برای AI Center آماده کند (`backend/database/migrations/000_init_ai_schema.sql`).
  - [x] وابستگی‌ها را رعایت کند (Foreign keys, indices اولیه و سازگاری با migrationهای بعدی).
- [x] تست:
  - [x] اجرای chain کامل migrations روی یک DB خالی dev/test (`titangold_ai_bootstrap_test`) با استفاده از `DATABASE_URL` جداگانه.
  - [x] اطمینان از این‌که `000_init_ai_schema.sql` و migrationهای AI بدون خطا جداول AI (`ai_agents`, `artemis_state`, `autopilot_actions`, `ai_decisions`) را ایجاد می‌کنند (در عین این‌که migrationهای وابسته به جداول core مانند `users` نیازمند اسکیما‌ی کامل اپلیکیشن هستند).
- [x] مستندسازی نحوه bootstrap در `ENVIRONMENT.md`.

---

## ۶. فاز ۵ – Training & Analytics Unknown Resolution

**هدف**: حذف حالت «UI زیبا ولی backend ناقص» برای Training و Analytics و اتصال آن‌ها به API و DB واقعی.**

### ۶.۱. Training – کشف و تکمیل

- [x] جست‌وجو برای همه routeها و serviceهای Training:
  - [x] شناسایی توابع: `fetchTrainingData`, `scheduleAITrainingSession`, `completeAITrainingSession`, `artemisAutoConfigureTraining`.
- [x] بررسی mapping UI ↔ API:
  - [x] کدام اندپوینت‌ها توسط UI Training استفاده می‌شود.
  - [x] کدام props / state در UI به این APIها متصل‌اند.
- [x] بررسی اتصال به DB:
  - [x] جداول training job/session/dataset.
  - [x] وضعیت schema و داده‌ی فعلی.
- [ ] اگر backend واقعی برای برخی سناریوها وجود ندارد:
  - [x] طراحی و پیاده‌سازی **حداقل REST contract عملیاتی**:
    - [x] اندپوینت‌های لازم (مثلاً `/api/v1/training/overview`, `/api/v1/training/sessions` حداقلی).
    - [x] مدل درخواست/پاسخ پایه (استفاده از adapter در `fetchTrainingData` برای نگاشت به `AITrainingStats`).
  - [x] اتصال کامل UI به این endpointها (برای fetch/schedule/complete؛ config/auto-config هنوز IndexedDB-based است).
  - [x] حذف یا محدودکردن هرگونه IndexedDB simulation / mock که دیگر مناسب نیست.
- [x] تکمیل Training در Coverage Matrix (Status: Implemented).

### ۶.۲. Training API Map → `docs/ssot_v3/TRAINING_API_MAP.md`

- [x] مستندسازی همه‌ی اندپوینت‌های Training:
  - [x] Path, Method, Description.
  - [x] Request model.
  - [x] Response model.
  - [x] جداول DB مرتبط.
  - [x] Status (Implemented / Partial / Planned) – در پایان باید برای موارد اصلی Implemented باشد.

### ۶.۳. Analytics – کشف و تکمیل

- [x] تحلیل کامل چرخه Analytics:
  - [x] بررسی اندپوینت‌های `fetchAnalyticsData` و مشابه.
  - [x] بررسی aggregationها روی `ai_decisions` (برای decisionRate و summary در `/api/v1/analytics/overview`).
  - [x] بررسی استفاده از `ai_learning_events`.
- [x] شناسایی متریک‌ها: accuracy, hit rate, PnL, drawdown، و …
- [x] بررسی wiring UI ↔ API ↔ DB:
  - [x] کدام نمودار/جدول در UI از کدام endpoint و جدول پشتیبانی می‌شود.
- [x] اگر backend Analytics ناقص است:
  - [x] پیاده‌سازی اندپوینت‌های لازم برای aggregationهای موردنیاز (حداقل `/api/v1/analytics/overview` با summary از `ai_agents`, `ai_decisions`, `ai_learning_events`).
  - [x] اتصال UI به این endpointها از طریق `fetchAnalyticsData` (backend-first + IndexedDB fallback).
  - [x] حذف mockها / داده‌های ساختگی در صورت وجود (الان فقط fallback آفلاین مبتنی بر داده واقعی استفاده می‌شود).
- [ ] تکمیل Analytics در Coverage Matrix (Status: Implemented).

### ۶.۴. Analytics API Map → `docs/ssot_v3/ANALYTICS_API_MAP.md`

- [x] مستندسازی اندپوینت‌های Analytics:
  - [x] Path, Method, Description.
  - [x] Request / Response models.
  - [x] جداول DB و aggregationهای اصلی.
  - [x] Status (در پایان: Implemented برای مسیرهای اصلی).

---

## ۷. فاز ۶ – Living SSOT Automation

**هدف**: خودکارسازی بخشی از SSOT (routes, agents) برای کاهش ریسک divergence بین کد و مستندات.**

### ۷.۱. `dump_routes.js`

- [x] ایجاد اسکریپت Node در backend که:
  - [x] routها را از registry مرکزی یا تعریف‌های Express (`backend/routes/v1/index.js`) استخراج کند.
  - [x] ساختار JSON مشابه `ROUTES.json` تولید کند.
  - [x] `docs/ssot_v3/generated/ROUTES.json` را بازنویسی کند.
  - [x] `ROUTES.md` را نیز به‌صورت جدول خوانا از روی همین JSON ایجاد/به‌روز کند.
- [x] اضافه‌کردن اسکریپت npm (مثلاً `npm run ssot:routes`).

### ۷.۲. `dump_agents_ssot.js` (dump_agents)

- [x] ایجاد اسکریپت Node که:
  - [x] همه agents ثبت‌شده در registry را لیست کند.
  - [x] وضعیت جدول `ai_agents` را (read-only) بخواند.
  - [x] خروجی را در `docs/ssot_v3/generated/AGENTS.md` و در صورت نیاز `AGENTS.json` ذخیره کند.
- [x] اضافه‌کردن اسکریپت npm (مثلاً `npm run ssot:agents`).

### ۷.۳. اتصال به CI (اختیاری ولی پیشنهادی)

- [ ] تعریف دستور کلی SSOT generation (مثلاً `npm run ssot:generate` که هر دو اسکریپت را اجرا کند).
- [ ] پیشنهاد/پیاده‌سازی step در CI تا روی PRهای مرتبط، این اسکریپت‌ها اجرا شوند و خروجی‌ها به‌روزرسانی شوند.

---

## ۸. بسته مستندات نهایی – SSOT v3.0

این بخش خروجی نهایی و قابل ارائه به تیم/سرمایه‌گذار است و باید بعد از تکمیل فازهای قبلی به‌روز شود.

### ۸.۱. `docs/ssot_v3/SSOT_v3.0.md`

- [x] نوشتن Overview معماری AI Center:
  - [x] ارتباط UI ↔ API ↔ DB ↔ Engine (Trading/Artemis/Autopilot).
- [x] افزودن Coverage Matrix کامل برای همه تب‌ها و زیرتب‌ها.
- [x] افزودن بخش خلاصه وضعیت Confidence:
  - [x] قبل/بعد normalization.
- [x] لینک‌دهی به:
  - [x] `generated/ROUTES.md`
  - [x] `generated/AGENTS.md`
  - [x] `TRAINING_API_MAP.md`
  - [x] `ANALYTICS_API_MAP.md`

### ۸.2. `docs/ssot_v3/EVIDENCE.md`

- [x] لیست کردن مهم‌ترین claimهای معماری و پیاده‌سازی:
  - [x] هر سطر: Claim | File | Line | توضیح کوتاه.
- [x] دسته‌بندی بر اساس ماژول:
  - [x] AI Manager / DataHub / Telegram
  - [x] Agents
  - [x] Training
  - [x] Analytics
  - [x] Topic Routing
  - [x] Trading Engine / Artemis / Autopilot

### ۸.۳. `docs/ssot_v3/GAPS_AND_PLAN.md`

- [x] برای هر Gap کشف‌شده:
  - [x] Description.
  - [x] Impact (Low/Medium/High).
  - [x] Module.
  - [x] Status (Open / In-Progress / Resolved).
  - [x] Link به PR/Commit (در صورت وجود).
- [ ] اطمینان از اینکه در پایان کار:
  - [ ] تمام Gapهای Critical برای این فاز Resolved یا دارای برنامه‌ی زمان‌بندی شده هستند.

### ۸.۴. `docs/ssot_v3/NORMALIZATION.md`

- [x] مستندسازی وضعیت Confidence:
  - [x] قبل از تغییر.
  - [x] بعد از تغییر.
- [x] لیست نقاط اصلی استفاده از `normalizeConfidence`.
- [x] توصیف thresholdهای Artemis و نحوه استفاده از ۰–۱۰۰.
- [x] خلاصه نتایج backfill DB.

### ۸.۵. `docs/ssot_v3/DOD_CHECKLIST.md`

تبدیل Definition of Done به چک‌لیست قابل تیک‌خوردن:

- [x] Every AI tab & subtab classified در Coverage Matrix.
- [x] No UNKNOWN remains در `SSOT_v3.0.md`.
- [x] Confidence unified to 0–100 در تمام مسیرها (Agents ↔ Artemis ↔ Trading ↔ UI ↔ DB).
- [x] No UI multiplies confidence (تمام ضرب‌های `* 100` غیرضروری حذف شده‌اند).
- [x] Artemis threshold consistent و بر اساس ۰–۱۰۰ پیاده‌سازی شده است.
- [x] Training fully wired (UI ↔ API ↔ DB؛ بدون UI-only ناخواسته).
- [x] Analytics fully wired (UI ↔ API ↔ DB؛ بدون mockهای اصلی).
- [x] Trading engine verified (Start/Stop, Queue, DB writes, Artemis integration).
- [x] Single migration path (فقط مسیر node-pg-migrate / `npm run migrate`).
- [x] Greenfield DB works (Bootstrap migration تست‌شده روی DB خالی).
- [x] SSOT has evidence lines (برای همه claimهای مهم).

---

## ۹. نحوه استفاده از این فایل

- این فایل به‌عنوان **Task List زنده** استفاده می‌شود:
  - [ ] با پیشرفت کار، آیتم‌ها تیک زده می‌شوند.
  - [ ] در صورت نیاز، زیرتسک‌های جدید به‌صورت بولت‌های تو در تو اضافه می‌شوند.
- پس از اتمام هر بخش:
  - [ ] باید هم کد و هم مستندات مرتبط (در `docs/ssot_v3/*`) به‌روز شوند.
  - [ ] هیچ بخش نباید در وضعیت «مستند شده ولی پیاده‌سازی ناقص» باقی بماند، مگر با برچسب آگاهانه و برنامه‌ی مشخص برای تکمیل در نسخه بعدی.

