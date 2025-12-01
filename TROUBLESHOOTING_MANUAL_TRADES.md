# Troubleshooting Manual Trades - راهنمای رفع مشکل

## مشکل: تغییرات اعمال نشده و هنوز mock data نمایش داده می‌شود

### ✅ بررسی‌های اولیه:

1. **Backend در حال اجرا است؟**
   ```bash
   cd backend
   npm start
   # یا
   node server.js
   ```
   باید پیام `🚀 Server running on port 5001` را ببینید.

2. **Frontend در حال اجرا است؟**
   ```bash
   npm run dev
   ```
   باید در `http://localhost:3000` اجرا شود.

3. **Database Schema اجرا شده است؟**
   ```bash
   psql -U postgres -d titangold_db -f backend/scripts/init_manual_trades.sql
   ```

4. **MEXC API Keys تنظیم شده است؟**
   - به Settings > Connections > Exchange API Keys بروید
   - MEXC API Key و Secret را وارد کنید
   - "Test Connection" را بزنید
   - "Save Changes" را بزنید

### 🔍 بررسی Console:

1. **Browser Console (F12):**
   - باید پیام `🔄 Loading manual trading data from backend...` را ببینید
   - باید پیام `✅ Manual trading data received:` را ببینید
   - اگر خطا می‌بینید، آن را کپی کنید

2. **Backend Console:**
   - باید پیام `📊 Fetching manual trading page data for user X` را ببینید
   - باید پیام `✅ Manual trading page data fetched successfully` را ببینید
   - اگر خطا می‌بینید، آن را کپی کنید

### 🧹 پاک کردن Cache:

1. **Browser Cache:**
   - `Ctrl + Shift + Delete` (Windows) یا `Cmd + Shift + Delete` (Mac)
   - "Cached images and files" را انتخاب کنید
   - "Clear data" را بزنید

2. **Hard Refresh:**
   - `Ctrl + Shift + R` (Windows) یا `Cmd + Shift + R` (Mac)

3. **Service Worker Cache:**
   - DevTools > Application > Service Workers
   - "Unregister" را بزنید

### 🔧 بررسی Network:

1. **DevTools > Network Tab:**
   - فیلتر `XHR` یا `Fetch` را بزنید
   - صفحه را refresh کنید
   - به دنبال درخواست `GET /api/manual-trades/page-data` بگردید
   - Status باید `200` باشد
   - Response باید داده‌های واقعی باشد (نه mock)

### 🐛 مشکلات رایج:

#### مشکل 1: "Failed to fetch manual trading page data"
**علت:** Backend در حال اجرا نیست یا route درست نیست
**راه حل:**
- مطمئن شوید backend در حال اجرا است
- بررسی کنید که route `/api/manual-trades/page-data` در `backend/server.js` اضافه شده است

#### مشکل 2: "MEXC API keys not configured"
**علت:** API keys در database ذخیره نشده است
**راه حل:**
- به Settings > Connections > Exchange API Keys بروید
- MEXC API Key و Secret را وارد کنید
- "Test Connection" را بزنید
- "Save Changes" را بزنید

#### مشکل 3: "No chart data from MEXC"
**علت:** MEXC API keys معتبر نیست یا connection مشکل دارد
**راه حل:**
- API keys را دوباره بررسی کنید
- "Test Connection" را بزنید
- مطمئن شوید که API keys دسترسی به spot trading دارند

#### مشکل 4: هنوز mock data نمایش داده می‌شود
**علت:** Fallback به mock data فعال است
**راه حل:**
- بررسی کنید که `services/api.ts` خط `return withLatency(...)` را ندارد
- اگر دارد، آن را حذف کنید یا comment کنید
- Browser cache را پاک کنید

### 📝 Logs برای Debug:

در `backend/services/manualTrading.js` و `backend/routes/manual-trades.js` log های مفصل اضافه شده است:
- `📊` = شروع عملیات
- `✅` = موفقیت
- `❌` = خطا
- `⚠️` = هشدار

### 🔄 Restart کامل:

اگر هیچ کدام از راه‌حل‌ها کار نکرد:

1. **Backend را restart کنید:**
   ```bash
   # Stop backend
   Ctrl + C
   
   # Start again
   cd backend
   npm start
   ```

2. **Frontend را restart کنید:**
   ```bash
   # Stop frontend
   Ctrl + C
   
   # Start again
   npm run dev
   ```

3. **Browser را restart کنید:**
   - تمام تب‌ها را ببندید
   - Browser را restart کنید

### 📞 اگر مشکل حل نشد:

1. Console logs (frontend و backend) را کپی کنید
2. Network tab screenshot بگیرید
3. Error message کامل را کپی کنید
4. این اطلاعات را برای بررسی ارسال کنید

