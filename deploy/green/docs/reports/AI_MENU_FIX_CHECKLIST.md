## AI Menu Fix Checklist

تاریخ: 2025-12-24  
دامنه: فقط AI Menu (AICenter, AIManager tabs, AIAgents, Training, Analytics, API Config)

هر مورد شامل: فایل / تابع هدف، و وضعیت انجام کار است.

### Milestone 1 – High Bugs (A1 / A2 / A3)

- [x] **A1 – AICenter prefetch error handling + Retry**
  - File/Function: `components/AICenter.tsx` – `prefetchData` (`useEffect` اولیه) و بلوک رندر اصلی.
  - Notes: اضافه شدن `try/catch/finally`, state `loadError` و دکمه Retry inline؛ در صورت موفقیت، رفتار همانند قبل، در خطا: پیام خطا بدون گیرکردن روی loading.
- [x] **A2 – AIAgents loading & error handling + Retry**
  - File/Function: `components/ai/AIAgents.tsx` – `fetchData` و بلوک رندر (loading/error/content).
  - Notes: اضافه شدن `error` state و Retry inline؛ در خطا، پیام واضح به‌جای loading دائمی؛ در حالت موفق، لیست ایجنت‌ها مثل قبل.
- [x] **A3 – DataHub backward compatibility for cache & cache.data**
  - File/Function: `services/api.ts` – `fetchDataHubState` (بلاک `if (saved && saved.value) { ... }`).
  - Notes: اگر `cache` یا `cache.data` در state ذخیره‌شده نباشد، با مقادیر پیش‌فرض امن مقداردهی می‌شود؛ DataHub روی stateهای قدیمی دیگر crash نمی‌کند.

### Milestone 2 – “No data” vs “Load failed”

- [x] **M2.1 – OverviewTab load failure messaging (logs + scenarios)**
  - File/Function: `components/ai/AIManager/tabs/OverviewTab.tsx` – `loadAdditionalData` و بخش‌های Recent Logs / Trading Scenarios.
  - Notes: اضافه‌شدن `loadError` و پیام‌های قرمز inline برای شکست لود لاگ‌ها/سناریوها؛ در حالت موفق، همچنان فقط "No data" در صورت خالی بودن داده نمایش داده می‌شود.
- [x] **M2.2 – ScenariosTab load failure messaging**
  - File/Function: `components/ai/AIManager/tabs/ScenariosTab.tsx` – `loadScenarios` و رندر زمانی که `scenarios.length === 0`.
  - Notes: در صورت خطای `fetchTradingScenarios` و خالی بودن لیست، پیام "Failed to load scenarios" به‌صورت inline نمایش داده می‌شود؛ در حالت موفق، رفتار قبلی حفظ شده است.
- [x] **M2.3 – DataHubTab load failure messaging (state + agents)**
  - File/Function: `components/ai/AIManager/tabs/DataHubTab.tsx` – افکت لود `dataHub`, افکت لود `agents` و پیام‌های خطای inline.
  - Notes: stateهای `dataHubError` و `agentsError` اضافه شده‌اند؛ در صورت شکست لود state، پیام خطای کوچک در بالای تب نشان داده می‌شود، بدون تغییر رفتار در مسیر موفق.
- [x] **M2.4 – APIConfig load failure messaging**
  - File/Function: `components/ai/APIConfig.tsx` – `useEffect` اولیه (`fetchData`) و نمایش inline خطا در صورت عدم لود `apiConfig`.
  - Notes: در صورت خطای لود config، یک باکس خطای قرمز در بالای تب نشان داده می‌شود؛ وقتی `apiConfig` لود شود، UI دقیقاً مانند قبل عمل می‌کند.

### Milestone 3 – AIAgent Runtime Validation

- [x] **M3.1 – sanitizeAIAgents guard at API boundary**
  - File/Function: `services/api.ts` – تابع جدید `sanitizeAIAgents(raw)` و استفاده از آن در `fetchAIAgents` (برای داده‌ی backend, IndexedDB و defaults).
  - Notes: تابع `sanitizeAIAgents` اضافه شد که فیلدهای عددی را به عدد امن تبدیل می‌کند، مقادیر پیش‌فرض امن برای فیلدهای اصلی اعمال می‌کند، و فقط در صورت نبودن `id` یا `name` agent را حذف می‌کند. در صورت اصلاح/حذف، یک `console.warn` ساختاریافته ثبت می‌شود. استفاده در `fetchAIAgents` برای backend و IndexedDB fallback. آرایه‌های خالی بدون sanitize برگردانده می‌شوند (no-op).

### Milestone 4 – Tests & Final Validation (Step 6)

- [ ] **T1 – E2E smoke: open AI menu and visit all tabs (no console errors)**
  - Scope: `AICenter` tabs → Manager / Agents / Training / Analytics / Config.
  - **Runtime Test Status**: ⏳ PENDING - نیاز به اجرای دستی
  - **Notes**: [نتایج تست را اینجا ثبت کنید]
- [ ] **T2 – A1 failure simulation**
  - Action: شبیه‌سازی خطا در `fetchAIManagerData` و تأیید عدم گیرکردن روی loading + نمایش error + Retry inline.
  - **Runtime Test Status**: ⏳ PENDING - نیاز به اجرای دستی
  - **Notes**: [نتایج تست را اینجا ثبت کنید - مراجعه به RUNTIME_TEST_HELPERS.md برای کدهای تزریق خطا]
- [ ] **T3 – A2 failure simulation**
  - Action: شبیه‌سازی خطا در `fetchAIAgents` و تأیید عدم گیرکردن روی loading + نمایش error + Retry inline در تب Agents.
  - **Runtime Test Status**: ⏳ PENDING - نیاز به اجرای دستی
  - **Notes**: [نتایج تست را اینجا ثبت کنید - مراجعه به RUNTIME_TEST_HELPERS.md برای کدهای تزریق خطا]
- [ ] **T4 – A3 failure simulation (missing cache & cache.data)**
  - Action: ساخت یا شبیه‌سازی state DataHub بدون `cache`/`cache.data` و تأیید عدم crash و مقداردهی امن پیش‌فرض.
  - **Runtime Test Status**: ⏳ PENDING - نیاز به اجرای دستی
  - **Notes**: [نتایج تست را اینجا ثبت کنید - مراجعه به RUNTIME_TEST_HELPERS.md برای مراحل IndexedDB]
- [ ] **T5 – No-regression check for successful API calls**
  - Action: وقتی همه APIها موفق هستند، رفتار UI (loading → content، متن‌ها و layout) با قبل از فیكس‌ها یکسان باقی بماند.
  - **Runtime Test Status**: ⏳ PENDING - نیاز به اجرای دستی
  - **Notes**: [نتایج تست را اینجا ثبت کنید]


