## AI Menu Bug Report (Contracts & Integration)

تاریخ: 2025-12-24  
دامنه: فقط AI Menu (AICenter, AIManager tabs, AIAgents, Training, Analytics, API Config)

این فایل فقط **گزارش باگ‌ها و ابهامات قرارداد/یکپارچگی** است و هیچ فیكس یا تغییر کدی در آن اعمال نشده است.

---

### بخش A – Runtime Bugs (قابل بازتولید بر اساس کد)

#### A1) AICenter – عدم هندلینگ خطا برای `fetchAIManagerData`

- **Severity**: High  
- **Category**: Runtime Bug – Loading state / Integration
- **File / Function / Lines (تقریبی)**:
  - `components/AICenter.tsx`
  - تابع `prefetchData` داخل `useEffect` اولیه (حدود خطوط 17–25)
- **شرح مشکل**:
  - `api.fetchAIManagerData()` بدون `try/catch/finally` فراخوانی می‌شود.
  - اگر Promise مربوطه reject شود (مشکل شبکه، IndexedDB یا خطای داخلی دیگر):
    - `setIsLoading(false)` هرگز فراخوانی نمی‌شود.
    - AI Menu (کل تب‌ها) در وضعیت `loading` باقی می‌ماند.
    - Unhandled Promise Rejection در کنسول ایجاد می‌شود.
- **تأثیر Runtime**:
  - کاربر عملاً به هیچ‌یک از تب‌های AI دسترسی پیدا نمی‌کند و فقط پیام "loading" می‌بیند.
  - هیچ پیام خطای کاربرپسند وجود ندارد؛ مشکل برای کاربر **سکوتی/مبهم** است.

---

#### A2) AIAgents – عدم `try/catch` برای `fetchAIAgents`

- **Severity**: High  
- **Category**: Runtime Bug – Unhandled Rejection + Stuck Loading
- **File / Function / Lines (تقریبی)**:
  - `components/ai/AIAgents.tsx`
  - `useEffect` ابتدایی → تابع `fetchData` (حدود خطوط 27–35)
- **شرح مشکل**:
  - `const agentData = await api.fetchAIAgents();` بدون `try/catch` استفاده می‌شود.
  - در صورت خطای شبکه/احراز هویت/سرور و reject شدن Promise:
    - `setIsLoading(false)` هرگز صدا زده نمی‌شود.
    - State تب روی `isLoading = true` گیر می‌کند.
    - Unhandled Promise Rejection در کنسول.
- **تأثیر Runtime**:
  - تب Agents برای کاربر فقط پیام `{t('loading')}` را نشان می‌دهد و هرگز لیست ایجنت‌ها را render نمی‌کند.
  - کاربر هیچ indication واضحی مبنی بر خطای شبکه/توکن/سرور نمی‌بیند.

---

#### A3) DataHubState – فرض وجود `cache` در داده‌های ذخیره‌شده

- **Severity**: High  
- **Category**: Runtime Bug – Schema Backward-Compatibility
- **File / Function / Lines (تقریبی)**:
  - `services/api.ts`
  - `fetchDataHubState`، درون بلاک `if (saved && saved.value) { ... }` (حدود خطوط 22015–22041)
- **شرح مشکل**:
  - پس از لود `saved.value: DataHubState` از IndexedDB:
    - کد مستقیماً به `saved.value.cache.data` دسترسی دارد:
      - `if (!saved.value.cache.data) { saved.value.cache.data = {}; }`
  - در صورت وجود رکورد قدیمی که field `cache` را نداشته باشد (schema نسخه قبلی):
    - `saved.value.cache` برابر `undefined` می‌شود.
    - دسترسی به `.data` روی `undefined` → خطای Runtime (`Cannot read properties of undefined`).
- **تأثیر Runtime**:
  - هر فراخوانی `fetchDataHubState` (در DataHubTab و سایر سرویس‌ها) می‌تواند منجر به crash شود.
  - به‌ویژه در محیط‌هایی که Data Hub از نسخه قدیمی‌تر ارتقا یافته و state قبلی در IndexedDB ذخیره شده است.

---

### بخش B – Contract Ambiguities / Potential Bugs

#### B1) AIAgent Contract بدون ولیدیشن Runtime

- **Severity**: Medium  
- **Category**: Contract Ambiguity / Potential Runtime Bug
- **Files / Functions**:
  - `types.ts` – `interface AIAgent` (حدود خطوط 855–927)
  - `services/api.ts` – `fetchAIAgents` (خطوط 4018+)
  - `components/ai/AIAgents.tsx` و *AgentControl components
- **قرارداد TypeScript**:
  - فیلدهای `accuracy`, `trainingProgress`, `decisions`, `learningTime`, `knowledgeSize`, `status`, `level`, `capabilities`, `lastUpdate` همگی **الزامی** و از نوع مشخص هستند.
- **وضعیت پیاده‌سازی**:
  - `fetchAIAgents` پاسخ `/api/ai-agents` را به‌صورت `data as AIAgent[]` برمی‌گرداند، بدون هیچ نوع چک runtime (zod/guards).
  - UI در `AIAgents` فرض می‌کند این فیلدها همیشه وجود دارند و نوعشان عددی است (`agent.accuracy.toFixed(1)`, `agent.decisions.toLocaleString()`, ...).
- **ریسک Runtime**:
  - اگر backend یک فیلد را حذف کند، نام آن را عوض کند یا نوع آن را تغییر دهد (مثلاً `accuracy: "90.5"`):
    - ممکن است در UI خطاهایی مثل `toFixed is not a function` رخ دهد و تب Agents crash کند.
  - چون fallback IndexedDB و defaults مقادیر سازگار تولید می‌کنند، این مشکل **بیشتر به سلامت قرارداد backend** وابسته است.

---

#### B2) ArtemisState – اختلاف ظاهری بین Type و استفاده در AIManager

- **Severity**: Low  
- **Category**: Contract Ambiguity (نه لزوماً باگ)
- **Files / Functions**:
  - `types.ts` – `ArtemisState` (خطوط 3764–3779) – `dataHub?`, `config?`, `logs?` به‌عنوان فیلدهای اختیاری.
  - `components/ai/defaults.ts` – `DEFAULT_ARTEMIS_STATE` و `mergeWithArtemisDefaults`.
  - `components/ai/hooks/useArtemisState.ts` – استفاده از `mergeWithArtemisDefaults` در `setState` و `setSafeState`.
  - `components/ai/AIManager/index.tsx` و تب‌های داخلی.
- **وضعیت**:
  - TypeScript می‌گوید برخی فیلدها اختیاری هستند.
  - اما در AIManager، همیشه از خروجی `useArtemisState` استفاده می‌شود که `DEFAULT_ARTEMIS_STATE` را merge می‌کند؛ در عمل فیلدهایی مثل `decisionEngine`, `learningSystem`, `orchestration`, `systemHealth`, `dataHub` **همیشه پر** هستند.
- **ریسک**:
  - در آینده، توسعه‌دهنده ممکن است به‌اشتباه از `ArtemisState` خام (بدون merge) در جای دیگری استفاده کند و همان فرض‌های تب‌های AIManager را داشته باشد؛ این می‌تواند منجر به crash شود.
  - در حال حاضر، در فایل‌های Training/Analytics/APIConfig که `fetchArtemisState` را مستقیم استفاده می‌کنند، به‌سبب استفاده از optional chaining، ریسک crash پایین است.

---

#### B3) رفتار «No data» به‌عنوان نتیجه‌ی خطا در تب‌های مختلف

- **Severity**: Low–Medium (بسته به تب)  
- **Category**: UX / Contract Ambiguity (Data vs Error)
- **Files / Examples**:
  - `components/ai/AIManager/tabs/OverviewTab.tsx`:
    - خطا در `fetchArtemisLogs` یا `fetchTradingScenarios` → فقط `console.error` و `recentLogs = []`, `scenarios = []` → UI پیام "No data available".
  - `components/ai/AIManager/tabs/ScenariosTab.tsx`:
    - خطا در `fetchTradingScenarios` → لیست خالی + پیام "No data"، بدون اینکه کاربر بداند API fail شده است.
  - `components/ai/AIManager/tabs/DataHubTab.tsx`:
    - برخی درخواست‌های فرعی (مثل `fetchAIAgents` برای automation) در صورت خطا فقط console.error و state خالی؛ UI همان "هیچ داده‌ای نیست" را نشان می‌دهد.
  - `components/ai/APIConfig.tsx`:
    - خطا در `fetchAPIConfigData` → فقط console.error؛ UI ممکن است به‌طور ناقص/خالی ظاهر شود بدون پیام "Failed to load configuration".
- **ریسک Runtime / UX**:
  - سیستم crash نمی‌کند، اما:
    - کاربر نمی‌تواند تفاوت بین «واقعاً هیچ داده‌ای ثبت نشده» و «لود داده با خطا مواجه شده» را تشخیص دهد.
    - این به‌خصوص در تب‌هایی مثل Data Hub و APIConfig می‌تواند منجر به تصمیم‌گیری اشتباه در تنظیمات شود.

---

### بخش C – Non-bug Ambiguities (آگاهانه طراحی‌شده)

#### C1) چند قرارداد برای Telegram Collector Health

- **Severity**: Low  
- **Category**: Designed Contract Flexibility
- **Files**:
  - `components/ai/AIManager/tabs/DataHubTab.tsx` – متغیرهای `combinedCollectorHealth`, `collectorTrackedChannels`, `collectorChannelsWithErrors`, ...
- **شرح**:
  - کد به‌صورت آگاهانه چندین نام فیلد را پشتیبانی می‌کند:
    - `channelsTracked` **یا** `trackedChannels`
    - `channelsWithErrors` **یا** `channelsInError`
    - `uptime` **یا** `uptimeMs`
  - هدف، سازگاری با نسخه‌های مختلف backend است.
- **اثر**:
  - اگر backend فیلدهای نامعمول‌تری برگرداند، UI به‌سادگی `'-'` یا `0` نمایش می‌دهد؛ crash رخ نمی‌دهد.
  - این بیشتر یک trade-off آگاهانه بین سادگی قرارداد و تحمل نسخه‌های مختلف backend است.

---

### خلاصه نهایی (Step 3)

- **بالاترین اولویت برای فیكس در مراحل بعدی (Critical/High)**:
  - A1) افزودن هندلینگ خطا و خروج از حالت loading در `AICenter` زمانی که `fetchAIManagerData` fail می‌شود.
  - A2) افزودن `try/catch` و مدیریت خطا برای `fetchAIAgents` در `AIAgents` تا تب Agents در صورت خطا از حالت loading دائمی خارج شود.
  - A3) ایمن‌کردن دسترسی به `saved.value.cache` در `fetchDataHubState` برای سازگاری با stateهای ذخیره‌شده‌ی قدیمی.

- **متوسط/پایین (بهبود قرارداد و UX)**:
  - B1) اضافه‌کردن ولیدیشن سبک برای `AIAgent[]` در مرز `fetchAIAgents` برای جلوگیری از crash در صورت داده‌ی ناسازگار از backend.
  - B2) شفاف‌سازی قرارداد `ArtemisState` (یا هماهنگ‌کردن type و رفتار merge) برای جلوگیری از سوء‌تفاهم توسعه‌دهنده در آینده.
  - B3) تمایز بصری بین «no data» و «load failed» در تب‌های Overview, Scenarios, DataHub, APIConfig.

این لیست، مبنای کار برای مرحله بعدی (طراحی فیكس‌ها و بهبودها) خواهد بود؛ فعلاً هیچ تغییری در کد اعمال نشده است.*** End Patch

