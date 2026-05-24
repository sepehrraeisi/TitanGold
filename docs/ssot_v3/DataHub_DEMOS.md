## DataHub Runtime Demos

### dataHub.telegram – Telegram Panel / Agents / Breaking News

- **Success Scenario (healthy pipeline)**  
  1. Backend و سرویس `telegram-collector` را طبق ENVIRONMENT بالا بیاورید (Postgres متصل، migrations اعمال شده).  
  2. با کاربر دارای توکن معتبر وارد UI شوید و به تب `AI Center → DataHub → Telegram` بروید.  
  3. در پنل Telegram، health و System Overview را بررسی کنید؛ مقادیر `total_messages`, `processed`, `actionable`, `active_channels` باید از `/api/v1/telegram/health` و `/agents/summary` پر شوند.  
  4. روی تب `AI Inbox` کلیک کنید؛ لیست ایجنت‌ها از `/api/v1/telegram/agents/summary` لود می‌شود، روی یک Agent کلیک کنید تا `AgentDetailPanel` باز شود و پیام‌ها از `/api/v1/telegram/agents/:agentKey/feed` لود شوند؛ دکمه `✓ Mark Processed` یک پیام را حذف کرده و روی `/agents/:agentKey/mark-processed` اثر می‌گذارد.  
  5. به تب `Breaking News` بروید؛ اسلایدر Min Impact را روی ۰.۷ بگذارید و چند بار Refresh بزنید؛ کارت‌های خبر از `/api/v1/telegram/breaking-news` می‌آیند و دسته‌بندی/regions در Geographic Map از `/api/v1/telegram/events/recent` پر می‌شود.

- **Failure Scenario (backend / DB issue)**  
  1. با همان کاربر وارد UI شوید اما عمداً backend Telegram یا DB مربوط به جداول تلگرام را متوقف کنید (یا migrations را اعمال نکنید).  
  2. صفحه `AI Center → DataHub → Telegram` را رفرش کنید.  
  3. درخواست‌های `/api/v1/telegram/health` یا `/agents/summary` باید با خطای ۵xx برگردند و در UI بنر خطا/پیام مناسب نمایش داده شود (بدون crash کامپوننت).  
  4. تلاش برای باز کردن `AgentDetailPanel` یا تب `Breaking News` باید پیام خطای متنی (متن i18n شده یا fallback خوانا) را نشان دهد و state UI در وضعیت امن باقی بماند.  
  5. لاگ‌های backend باید پیام‌های خطای `Telegram health check failed` یا `Error fetching agents summary / breaking news` را ثبت کرده باشند تا برای دیباگ قابل ردیابی باشد.

- **Auth Scenario (prod – `TELEGRAM_READ_MODE=auth-role`)**  
  1. در محیطی که `NODE_ENV=production` و `TELEGRAM_READ_MODE=auth-role` تنظیم شده، یک درخواست به `/api/v1/telegram/agents/summary` بدون هدر `Authorization` بفرستید → باید `401 Unauthorized` برگردد (و در UI خطای مناسب health/summary نمایش داده شود).  
  2. با توکن کاربری که نقش او در بین `['admin','trader','analyst','viewer']` نیست، همان درخواست را ارسال کنید → باید `403 Insufficient permissions` برگردد و UI بنر خطا را بدون crash نشان دهد.  
  3. با کاربر لاگین‌شده دارای نقش مجاز (مثلاً `admin` یا `trader`) وارد UI شوید و به `AI Center → DataHub → Telegram` بروید؛ تمام روت‌های read-only تلگرام (health, summary, feed, breaking-news, events, categories, stats) باید `200` بدهند و تب تلگرام طبق سناریوی موفق بالا کار کند.
  
### dataHub.sources – Data Sources (GAP-008 closed – UI backend-first)

- **Success Scenario (UI: create → update → soft delete → restore → hard delete)**  
  1. با کاربر دارای `titan_token` وارد شوید → `AI Center → DataHub → Sources`. در DevTools → Network باید `GET /api/v1/data-sources?page=1&limit=20` با پاسخ `{ data, pagination }` دیده شود (نه `fetchDataHubState`/IndexedDB).  
  2. **Create**: «Add Source» → فرم را پر کنید → Save. Network: `POST /api/v1/data-sources` → `201`؛ لیست با invalidate/refetch به‌روز می‌شود.  
  3. **Update**: Edit همان منبع → تغییر `category` یا interval → Save. Network: `PUT /api/v1/data-sources/:id` → `200`؛ `data_hub_logs` رکورد «Source updated».  
  4. **Soft delete**: از mutation/API `DELETE /api/v1/data-sources/:id` (بدون `hard=true`) → `204`؛ `is_active=false` در DB.  
  5. **Restore**: `PATCH /api/v1/data-sources/:id/restore` → `200`؛ منبع دوباره active در لیست UI.  
  6. **Hard delete** (فقط روی منبع بدون FK وابسته): `DELETE /api/v1/data-sources/:id?hard=true` → `204`؛ ردیف از DB حذف می‌شود.

- **Failure Scenario (UI: duplicate 409 + hard delete with FK 409)**  
  1. **Duplicate (409)**: منبعی با همان `name`+`type` بسازید → `POST` برمی‌گردد `409` با پیام duplicate؛ در UI بنر زرد/کهربایی conflict (یا هشدار duplicate در مودال) نمایش داده می‌شود.  
  2. **Validation (400)**: URL نامعتبر یا فیلد خالی ارسال کنید → `400` از zod؛ خطا inline در فرم Create/Edit (`errors.form` / فیلدها).  
  3. **FK conflict (409)**: `DELETE ...?hard=true` روی منبعی با `collected_data`/`data_queue` → `409` «Cannot delete data source: related data exists»؛ بنر conflict در تب Sources.  
  4. **Server (500)**: Postgres/backend down → `GET/POST` با `500`؛ UI بنر خطای سرور + دکمه **Retry** (refetch `useDataSourcesQuery`).