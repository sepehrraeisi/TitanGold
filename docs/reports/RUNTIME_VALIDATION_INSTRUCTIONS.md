# Runtime Validation Instructions

این فایل راهنمای کامل برای اجرای تست‌های runtime validation است.

---

## پیش‌نیازها

### 1. راه‌اندازی محیط

```bash
# Terminal 1: Backend
cd /path/to/TitanGold/backend
node server.js
# یا
npm start

# Terminal 2: Frontend
cd /path/to/TitanGold
npm run dev
```

### 2. باز کردن Browser

- URL: http://localhost:3000 (یا پورت frontend)
- باز کردن DevTools (F12)
- فعال کردن Console و Network tabs
- پاک کردن لاگ‌های قبلی

### 3. تنظیمات Environment

**برای تست OpenRouter**:
```bash
# در backend/.env
OPENROUTER_API_KEY=sk-or-v1-xxxxx
OPENROUTER_MODEL=openai/gpt-4o-mini  # اختیاری
```

**برای تست Key Rotation**:
```bash
# در backend/.env
OPENAI_API_KEYS=key1,key2,key3
# یا
ANTHROPIC_API_KEYS=key1,key2
```

---

## PART A - AI Menu Runtime Tests (T1-T5)

### T1: E2E Smoke Test

**مراحل**:
1. باز کردن http://localhost:3000
2. Login (اگر نیاز باشد)
3. باز کردن AI Menu (AICenter)
4. باز کردن تمام تب‌ها به ترتیب:
   - Manager → تمام زیر‌تب‌ها
   - Agents
   - Training
   - Analytics
   - Config

**بررسی**:
- [ ] Console: هیچ خطای قرمز وجود ندارد
- [ ] Console: هیچ "Unhandled Promise Rejection" وجود ندارد
- [ ] UI: هیچ تب در حالت "Loading..." گیر نمی‌کند
- [ ] UI: تمام تب‌ها محتوا را نمایش می‌دهند

**ثبت نتایج در**: `docs/reports/AI_MENU_AUDIT_REPORT.md` → Step 6 Runtime Results

---

### T2: A1 Failure Simulation

**قبل از تست**: Backup از `components/AICenter.tsx`

**مراحل**:
1. در `components/AICenter.tsx`، خط 24 را موقتاً تغییر دهید:
   ```typescript
   // throw new Error('TEST: Simulated fetchAIManagerData failure');
   // await api.fetchAIManagerData();
   ```
2. Save و refresh صفحه
3. باز کردن AI Menu
4. مشاهده:
   - [ ] UI در loading گیر نمی‌کند
   - [ ] پیام خطا نمایش داده می‌شود
   - [ ] دکمه "Retry" وجود دارد
5. کلیک روی "Retry"
   - [ ] `prefetchData` دوباره اجرا می‌شود
6. **REVERT**: کد را به حالت قبل برگردانید
7. Refresh و بررسی:
   - [ ] رفتار عادی بازگشته است

**ثبت نتایج در**: `docs/reports/AI_MENU_AUDIT_REPORT.md` → T2

---

### T3: A2 Failure Simulation

**قبل از تست**: Backup از `components/ai/AIAgents.tsx`

**مراحل**:
1. در `components/ai/AIAgents.tsx`، خط 32 را موقتاً تغییر دهید:
   ```typescript
   // throw new Error('TEST: Simulated fetchAIAgents failure');
   // const agentData = await api.fetchAIAgents();
   // setAgents(agentData);
   ```
2. Save و refresh صفحه
3. باز کردن AI Menu → Agents Tab
4. مشاهده:
   - [ ] UI در loading گیر نمی‌کند
   - [ ] پیام خطا نمایش داده می‌شود
   - [ ] دکمه "Retry" وجود دارد
5. کلیک روی "Retry"
   - [ ] `fetchData` دوباره اجرا می‌شود
6. **REVERT**: کد را به حالت قبل برگردانید
7. Refresh و بررسی:
   - [ ] Agents به صورت عادی نمایش داده می‌شوند

**ثبت نتایج در**: `docs/reports/AI_MENU_AUDIT_REPORT.md` → T3

---

### T4: A3 DataHub Backward Compatibility

**مراحل**:
1. باز کردن DevTools → Application → IndexedDB → `titan_db` → `settings`
2. پیدا کردن key: `data_hub_state`
3. کلیک راست → Edit
4. **Test 4a**: حذف `cache` از JSON:
   ```json
   {
     "key": "data_hub_state",
     "value": {
       "sources": [],
       "categories": []
       // cache حذف شده
     }
   }
   ```
5. Save
6. Refresh صفحه
7. باز کردن AI Menu → Manager → Data Hub Tab
8. مشاهده:
   - [ ] DataHub crash نمی‌کند
   - [ ] UI رندر می‌شود
   - [ ] Console: هیچ خطای `Cannot read property 'data' of undefined` وجود ندارد

**برای Test 4b**: همین مراحل را با حذف فقط `cache.data` (نه کل `cache`) تکرار کنید.

**ثبت نتایج در**: `docs/reports/AI_MENU_AUDIT_REPORT.md` → T4

---

### T5: No-Regression Check

**مراحل**:
1. مطمئن شوید تمام APIها موفق هستند (backend در دسترس)
2. باز کردن تمام تب‌های AI Menu (همانند T1)
3. برای هر تب بررسی کنید:
   - [ ] UI مانند قبل است
   - [ ] Loading states کار می‌کنند
   - [ ] محتوا یکسان است
   - [ ] هیچ پیام خطای اضافی وجود ندارد
4. Console بررسی کنید:
   - [ ] هیچ خطای جدیدی وجود ندارد

**ثبت نتایج در**: `docs/reports/AI_MENU_AUDIT_REPORT.md` → T5

---

## PART B - OpenRouter + Multi-Key Runtime Validation (B1-B5)

### B1: OpenRouter Only Mode

**مراحل**:
1. تنظیم `.env`:
   ```bash
   OPENROUTER_API_KEY=sk-or-v1-xxxxx
   OPENROUTER_MODEL=openai/gpt-4o-mini
   ```
2. Restart backend
3. در UI: AI Menu → Manager → Settings Tab
4. انتخاب `activeModel = "openrouter"`
5. Save
6. ایجاد decision request (از Decision Engine Tab یا API)
7. بررسی:
   - [ ] فقط OpenRouter API فراخوانی شد (Network tab)
   - [ ] Decision برگردانده شد
   - [ ] سایر providerها فراخوانی نشدند

**ثبت نتایج در**: `docs/reports/EXTERNAL_AI_PROVIDERS_SUMMARY.md` → B1

---

### B2: Hybrid Mode

**مراحل**:
1. تنظیم کلیدهای چند provider:
   ```bash
   OPENROUTER_API_KEY=sk-or-v1-xxxxx
   OPENAI_API_KEY=sk-xxxxx
   ANTHROPIC_API_KEY=sk-ant-xxxxx
   ```
2. Restart backend
3. در UI: انتخاب `activeModel = "hybrid"`
4. ایجاد decision request
5. بررسی:
   - [ ] چندین provider به صورت parallel فراخوانی شدند (Network tab)
   - [ ] Decision aggregated برگردانده شد
   - [ ] OpenRouter در لیست providers بود

**ثبت نتایج در**: `docs/reports/EXTERNAL_AI_PROVIDERS_SUMMARY.md` → B2

---

### B3: Key Rotation

**مراحل**:
1. تنظیم `.env`:
   ```bash
   OPENAI_API_KEYS=key1,key2,key3
   ```
2. Restart backend
3. در UI: انتخاب `activeModel = "openai"`
4. ایجاد 5+ decision request متوالی
5. بررسی Backend Logs:
   - [ ] لاگ‌های `[KeyPool] openai: using key index X/Y` دیده می‌شوند
   - [ ] Index به صورت round-robin تغییر می‌کند (0/2, 1/2, 2/2, 0/2, 1/2)
   - [ ] فقط index لاگ می‌شود (نه مقدار کلید)

**ثبت نتایج در**: `docs/reports/EXTERNAL_AI_PROVIDERS_SUMMARY.md` → B3

---

### B4: Provider Failure Handling

**مراحل**:
1. تنظیم `.env`:
   ```bash
   OPENROUTER_API_KEY=invalid-key
   OPENAI_API_KEY=sk-valid-key
   ANTHROPIC_API_KEY=sk-ant-valid-key
   ```
2. Restart backend
3. در UI: انتخاب `activeModel = "hybrid"`
4. ایجاد decision request
5. بررسی:
   - [ ] OpenRouter خطا می‌دهد اما سیستم crash نمی‌کند
   - [ ] سایر providerها کار می‌کنند
   - [ ] Decision از providerهای موفق برگردانده می‌شود
   - [ ] Console: هیچ Unhandled Promise Rejection وجود ندارد

**ثبت نتایج در**: `docs/reports/EXTERNAL_AI_PROVIDERS_SUMMARY.md` → B4

---

### B5: No Regression (OpenRouter Not Configured)

**مراحل**:
1. حذف `OPENROUTER_API_KEY` از `.env`
2. Restart backend
3. در UI: انتخاب `activeModel = "hybrid"`
4. ایجاد decision request
5. بررسی:
   - [ ] OpenRouter skip می‌شود (بدون خطا)
   - [ ] سایر providerها کار می‌کنند
   - [ ] Decision برگردانده می‌شود
   - [ ] Console: هیچ خطای runtime وجود ندارد

**ثبت نتایج در**: `docs/reports/EXTERNAL_AI_PROVIDERS_SUMMARY.md` → B5

---

## به‌روزرسانی مستندات

بعد از اجرای هر تست:

1. **AI_MENU_FIX_CHECKLIST.md**: تیک بزنید و notes اضافه کنید
2. **AI_MENU_AUDIT_REPORT.md**: نتایج T1-T5 را در بخش "Step 6 Runtime Results" ثبت کنید
3. **EXTERNAL_AI_PROVIDERS_SUMMARY.md**: نتایج B1-B5 را در بخش "Runtime Validation Results" ثبت کنید

---

## نکات مهم

1. **هرگز کلیدهای API را لاگ نکنید**: فقط index در key pool لاگ می‌شود
2. **بعد از تست revert کنید**: تمام تغییرات موقت را به حالت قبل برگردانید
3. **Screenshots بگیرید**: از console errors و UI states
4. **Network tab را بررسی کنید**: درخواست‌های API را بررسی کنید

---

**پایان راهنما**

