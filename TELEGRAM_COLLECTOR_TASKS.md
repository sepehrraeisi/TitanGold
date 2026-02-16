# تسک‌های تب Telegram Collector

بر اساس آنالیز انجام‌شده، تسک‌های زیر برای کامل‌کردن و رفع باگ‌های تب Telegram Collector تعریف شده‌اند.

---

## تسک ۱: Import از تلگرام (لیست کانال‌های عضو + ثبت در DB)

**شرح:** در حال حاضر هیچ دکمه یا جریانی برای «وارد کردن کانال از تلگرام» وجود ندارد. کانال‌ها فقط از جدول `telegram_channels` خوانده می‌شوند و راهی برای پر کردن این جدول از طریق UI نیست.

**کارهای لازم:**
- [x] در TelegramPanel یک دکمه «Import from Telegram» یا «وارد کردن کانال از تلگرام» اضافه شود.
- [x] با کلیک، فرانت‌اند `GET /api/telegram-collector/channels` را صدا بزند (لیست dialogs/کانال‌های عضو از API تلگرام).
- [x] یک مودال یا لیست انتخاب نمایش داده شود تا کاربر کانال‌ها را انتخاب کند.
- [x] برای هر کانال انتخاب‌شده، `POST /api/telegram-collector/channels/register` با `channel_id`, `username`, `title` و در صورت نیاز `category` فراخوانی شود.
- [x] بعد از ثبت، لیست کانال‌های collector با `loadCollectorChannels()` رفرش شود.

**وابستگی:** سرویس telegram-collector باید `GET /api/telegram-collector/channels` و `POST /api/telegram-collector/channels/register` را داشته باشد (در نسخه root موجود است).

---

## تسک ۲: رفع View Messages (لود پیام‌های کانال)

**شرح:** دکمه «View Messages» در جدول کانال‌ها، `GET /api/telegram-collector/channels/:channelId/messages?limit=50` را صدا می‌زند. این endpoint در telegram-collector تعریف نشده و درخواست 404 می‌شود. پیام‌ها در سرویس از طریق `GET /telegram/:channel/recent` در دسترس هستند.

**کارهای لازم:**
- [x] **گزینه الف:** در telegram-collector (root) یک endpoint اضافه شود: `GET /api/telegram-collector/channels/:channelId/messages?limit=50` که از همان منطق `/telegram/:channel/recent` استفاده کند و پاسخ را با فرمت `{ messages: [...] }` برگرداند.
- [x] **گزینه ب:** در فرانت‌اند به‌جای `/channels/:id/messages` از `/telegram/:channel/recent` استفاده شود و پاسخ (مثلاً `data.messages` یا `data` با ساختار موجود) در مودال نمایش داده شود.
- [x] مطمئن شویم پارامتر `channelId` با username یا channel_id که سرویس می‌پذیرد هماهنگ است (مثلاً username بدون @ یا channel_id عددی).

**نتیجه:** با کلیک روی «View Messages»، پیام‌های کانال در مودال لود و نمایش داده شوند.

---

## تسک ۳: رفع Refresh Channels (آدرس و endpoint)

**شرح:** در useDataHub، `handleRefreshCollectorChannels` به آدرس `${telegramCollectorUrl}/channels/refresh` درخواست POST می‌فرستد. وقتی `telegramCollectorUrl` خالی باشد، درخواست به `/channels/refresh` می‌رود (اشتباه). علاوه بر این، endpoint معتبر باید زیر `/api/telegram-collector/` باشد و در سرویس تعریف شده باشد.

**کارهای لازم:**
- [x] در useDataHub به‌جای `${telegramCollectorUrl}/channels/refresh` از همان الگوی نسبی استفاده شود: مثلاً `fetch(buildCollectorUrl('/api/telegram-collector/channels/refresh'), { method: 'POST' })`. برای این کار باید از جایی که `buildCollectorUrl` در دسترس است استفاده شود؛ در حال حاضر buildCollectorUrl در TelegramPanel است و handleRefreshCollectorChannels در useDataHub. پس یا buildCollectorUrl/مسیر نسبی را در useDataHub هم تعریف کنیم، یا از یک تابع مشترک api (مثلاً در services/api.ts) استفاده کنیم که مسیر صحیح `/api/telegram-collector/channels/refresh` را با base درست بسازد.
- [x] در telegram-collector (root) در صورت نبود، endpoint `POST /api/telegram-collector/channels/refresh` اضافه شود که مثلاً لیست کانال‌های تلگرام را دوباره از API بگیرد و با جدول `telegram_channels` همگام کند، یا حداقل پاسخ `{ success: true }` برگرداند تا فرانت خطا نگیرد.
- [x] بعد از refresh موفق، در فرانت لیست کانال‌های collector با `loadCollectorChannels()` رفرش شود (در صورت نیاز از callback یا trigger استفاده شود).

**نتیجه:** دکمه Refresh Channels درخواست را به آدرس درست بفرستد و خطای connection/404 ندهد.

---

## تسک ۴: رفع Link to Source (استفاده از collectorChannels)

**شرح:** دکمه «Link to Source» در هر ردیف جدول کانال‌ها، `handleLinkChannelToSource(ch.channelId)` را صدا می‌زند. داخل useDataHub، این handler کانال را از `telegramCollectorState?.channels?.find(ch => ch.id === channelId)` پیدا می‌کند. اما جدول از `collectorChannels` (نتیجه GET collector-channels از DB) پر شده و این کانال‌ها `id` یووییدی و `channelId` تلگرامی دارند. بنابراین جستجو با `channelId` در لیستی که با `id` (UUID) مقایسه می‌شود، کانال را پیدا نمی‌کند و «Channel not found» برمی‌گردد.

**کارهای لازم:**
- [x] به handleLinkChannelToSource علاوه بر channelId، در صورت امکان کل شیء کانال (یا حداقل title, username, id برای data source) پاس داده شود؛ یا
- [x] در useDataHub، برای لینک به منبع، به‌جای تکیه روی telegramCollectorState.channels، از لیست کانال‌های ثبت‌شده در collector استفاده شود. این لیست می‌تواند از طریق یک پارامتر جدید (مثلاً collectorChannels) به useDataHub/DataHubTab برسد و به handleLinkChannelToSource داده شود، یا از یک context/state مشترک خوانده شود.
- [x] هنگام ساخت TelegramChannel برای createTelegramDataSource از همان کانالی که از جدول (collectorChannels) می‌آید استفاده شود: id = channelId (یا id تلگرام)، title، username تا لینک به Data Source درست ایجاد شود.

**نتیجه:** با کلیک روی «Link to Source» برای یک کانال از جدول، آن کانال به‌درستی به عنوان Data Source لینک شود و پیام «Channel not found» نمایش داده نشود.

---

## تسک ۵: ترجمه‌های ناقص تب Telegram Collector

**شرح:** برخی کلیدهای استفاده‌شده در TelegramPanel و ویزارد لاگین ممکن است در فایل‌های ترجمه (مثلاً deploy/blue/locales/fa.json و en.json) تعریف نشده باشند و به‌صورت کلید خام نمایش داده شوند.

**کارهای لازم:**
- [x] تمام رشته‌های استفاده‌شده در TelegramPanel و TelegramLoginWizard را با الگوی `t('key') || 'fallback'` شناسایی کنیم.
- [x] لیست کلیدها را با محتوای فعلی fa.json و en.json مقایسه کنیم و کلیدهای missing را لیست کنیم.
- [x] برای هر کلید ناقص، متن مناسب فارسی و انگلیسی در fa.json و en.json اضافه کنیم (در هر دو deploy/blue و deploy/green در صورت استفاده).
- [x] مطمئن شویم کلیدهای مربوط به پیام‌های خطا/موفقیت لاگین، دکمه‌ها، placeholderها و هینت‌ها پوشش داده شده‌اند.

**نتیجه:** در تب Telegram Collector و مودال لاگین، متن‌ها به‌صورت ترجمه‌شده نمایش داده شوند و کلید خام دیده نشود.

---

## خلاصه وضعیت

| # | تسک | وضعیت |
|---|-----|--------|
| 1 | Import از تلگرام | ✅ |
| 2 | View Messages | ✅ |
| 3 | Refresh Channels | ✅ |
| 4 | Link to Source | ✅ |
| 5 | ترجمه‌ها | ✅ |

پس از انجام هر تسک، تیک مربوطه در همین فایل و در todo list به‌روز می‌شود.
