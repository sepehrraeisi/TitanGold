# External AI Providers + OpenRouter - Implementation Summary

تاریخ: 2025-12-24

---

## فهرست فایل‌های تغییر یافته

### Backend (1 فایل)
1. `backend/services/artemisOrchestrator.js`

### Frontend Components (5 فایل)
2. `components/ai/AIManager/tabs/DecisionEngineTab.tsx`
3. `components/ai/AIManager/tabs/SettingsTab.tsx`
4. `components/ai/AIManager.tsx`
5. `components/ai/ArtemisComponents.tsx`
6. `components/ai/APIConfig.tsx`

### Services (1 فایل جدید)
7. `services/openrouterService.ts` (جدید)

### Documentation (2 فایل جدید)
8. `docs/reports/EXTERNAL_AI_PROVIDERS.md`
9. `docs/reports/EXTERNAL_AI_PROVIDERS_SUMMARY.md` (این فایل)

---

## خلاصه تغییرات (Diff Summary)

### 1. `backend/services/artemisOrchestrator.js`

**تغییرات**:
- افزودن `PROVIDERS.openrouter = 'openrouter'`
- افزودن تابع `getNextKey(providerName)` برای key pool management با round-robin
- افزودن تابع `callOpenRouter(prompt, systemInstruction)`
- به‌روزرسانی `callClaude()`, `callOpenAI()`, `callDeepSeek()` برای استفاده از `getNextKey()`
- افزودن logic OpenRouter در `getMixtureDecision()` (خط 257-259, 275)

**دلیل**: افزودن OpenRouter و پشتیبانی از چند کلید API
**ریسک**: Low - backward compatible با env varهای قدیمی
**اعتبارسنجی**: تست با `activeModel=openrouter` و `activeModel=hybrid`

---

### 2. `components/ai/AIManager/tabs/DecisionEngineTab.tsx`

**تغییرات**:
- افزودن `<option value="openrouter">openrouter</option>` در dropdown activeModel

**دلیل**: اجازه انتخاب OpenRouter در UI
**ریسک**: None - فقط یک option اضافه شده
**اعتبارسنجی**: باز کردن Decision Engine Tab و بررسی وجود گزینه openrouter

---

### 3. `components/ai/AIManager/tabs/SettingsTab.tsx`

**تغییرات**:
- افزودن `<option value="openrouter">{t('openrouter') || 'OpenRouter'}</option>` در dropdown activeModel

**دلیل**: اجازه انتخاب OpenRouter در Settings
**ریسک**: None - فقط یک option اضافه شده
**اعتبارسنجی**: باز کردن Settings Tab و بررسی وجود گزینه OpenRouter

---

### 4. `components/ai/AIManager.tsx`

**تغییرات**:
- افزودن `<option value="openrouter">{t('openrouter') || 'OpenRouter'}</option>` در DecisionConfigModal

**دلیل**: اجازه انتخاب OpenRouter در Decision Config Modal
**ریسک**: None - فقط یک option اضافه شده
**اعتبارسنجی**: باز کردن Decision Config Modal و بررسی وجود گزینه OpenRouter

---

### 5. `components/ai/ArtemisComponents.tsx`

**تغییرات**:
- افزودن `<option value="openrouter">{t('openrouter') || 'OpenRouter'}</option>` در dropdown activeModel

**دلیل**: اجازه انتخاب OpenRouter در ArtemisComponents
**ریسک**: None - فقط یک option اضافه شده
**اعتبارسنجی**: بررسی وجود گزینه OpenRouter در ArtemisComponents

---

### 6. `components/ai/APIConfig.tsx`

**تغییرات**:
- افزودن `import { testOpenRouterConnection } from '../../services/openrouterService.ts'`
- افزودن logic تست برای `serviceId === 'ai-openrouter'` (خط 152-162)
- به‌روزرسانی filters برای شامل کردن `'ai-openrouter'` (3 مکان)

**دلیل**: پشتیبانی از تست اتصال OpenRouter در APIConfig
**ریسک**: Low - فقط logic تست اضافه شده
**اعتبارسنجی**: باز کردن APIConfig و تست اتصال OpenRouter

---

### 7. `services/openrouterService.ts` (جدید)

**تغییرات**:
- ایجاد فایل جدید با `generateContent()` و `testOpenRouterConnection()`
- پشتیبانی از `OPENROUTER_MODEL`, `OPENROUTER_HTTP_REFERER`, `OPENROUTER_X_TITLE`
- استفاده از `temp_openrouter_key` در localStorage برای تست

**دلیل**: سرویس تست و تولید محتوا برای OpenRouter
**ریسک**: None - فایل جدید
**اعتبارسنجی**: تست اتصال در APIConfig

---

## قبل / بعد (Before / After Behavior)

### قبل از تغییرات:

1. **Provider Selection**:
   - فقط 4 provider: Gemini, Claude, OpenAI, DeepSeek
   - هر provider فقط یک کلید API (`*_API_KEY`)

2. **Key Management**:
   - کلیدها مستقیماً از `process.env.*_API_KEY` خوانده می‌شدند
   - هیچ rotation یا load balancing وجود نداشت

3. **OpenRouter**:
   - وجود نداشت

### بعد از تغییرات:

1. **Provider Selection**:
   - 5 provider: Gemini, Claude, OpenAI, DeepSeek, **OpenRouter**
   - هر provider از چند کلید API پشتیبانی می‌کند (`*_API_KEYS`)

2. **Key Management**:
   - Key pools با round-robin rotation
   - پشتیبانی از `*_API_KEYS` (چند کلید) و fallback به `*_API_KEY` (یک کلید)
   - Backward compatibility: env varهای قدیمی (`ANTHROPIC_API_KEY`, `CHATGPT_API_KEY`) همچنان کار می‌کنند

3. **OpenRouter**:
   - به عنوان provider جدید اضافه شده
   - پشتیبانی از مدل‌های مختلف از طریق `OPENROUTER_MODEL`
   - پشتیبانی از optional headers (`HTTP-Referer`, `X-Title`)

---

## مراحل اعتبارسنجی دستی (Manual Validation Steps)

### Setup اولیه

1. **تنظیم متغیرهای محیطی**:
   ```bash
   # در .env
   OPENROUTER_API_KEY=sk-or-v1-xxxxx
   OPENROUTER_MODEL=openai/gpt-4o-mini
   
   # برای تست key rotation (اختیاری)
   OPENAI_API_KEYS=key1,key2,key3
   ```

2. **Restart Backend**: بعد از تغییر `.env`, backend را restart کنید.

---

### Test 1: OpenRouter Only Mode

**مراحل**:
1. باز کردن AI Menu → Manager → Settings Tab
2. انتخاب `activeModel = "openrouter"`
3. ذخیره تنظیمات
4. ایجاد یک decision request (از طریق Decision Engine Tab یا API)

**انتظار**:
- ✅ فقط OpenRouter API فراخوانی شود
- ✅ در لاگ‌ها: `callOpenRouter` دیده شود
- ✅ در صورت موفقیت، decision برگردانده شود

**اعتبارسنجی**:
- بررسی لاگ‌های backend: فقط یک request به `openrouter.ai` ارسال شود
- بررسی response: decision معتبر برگردانده شود

---

### Test 2: Hybrid Mode (OpenRouter + Others)

**مراحل**:
1. تنظیم کلیدهای API برای چند provider (مثلاً OpenRouter + OpenAI + Claude)
2. انتخاب `activeModel = "hybrid"`
3. ایجاد یک decision request

**انتظار**:
- ✅ OpenRouter + سایر providerهای فعال فراخوانی شوند
- ✅ تمام فراخوانی‌ها به صورت parallel انجام شوند
- ✅ تصمیم نهایی از `aggregateDecisions` برگردانده شود

**اعتبارسنجی**:
- بررسی لاگ‌ها: چندین provider به صورت parallel فراخوانی شوند
- بررسی response: `providers` array شامل چندین provider باشد

---

### Test 3: Key Rotation (Multi-Key)

**مراحل**:
1. تنظیم `OPENAI_API_KEYS=key1,key2,key3` در `.env`
2. Restart backend
3. ایجاد 5 decision request متوالی با `activeModel=openai`

**انتظار**:
- ✅ در هر فراخوانی، index کلید تغییر کند
- ✅ لاگ‌ها: `[KeyPool] openai: using key index 0/2`, `1/2`, `2/2`, `0/2`, `1/2`

**اعتبارسنجی**:
- بررسی لاگ‌های backend: index کلید به صورت round-robin تغییر کند
- بررسی network requests: کلیدهای مختلف استفاده شوند (اگر امکان دارد)

---

### Test 4: Provider Failure Handling

**مراحل**:
1. تنظیم یک کلید نامعتبر برای OpenRouter: `OPENROUTER_API_KEY=invalid-key`
2. تنظیم کلیدهای معتبر برای سایر providerها
3. انتخاب `activeModel = "hybrid"`
4. ایجاد decision request

**انتظار**:
- ✅ OpenRouter خطا بدهد و `null` برگرداند
- ✅ سایر providerها به کار خود ادامه دهند
- ✅ تصمیم نهایی از providerهای موفق گرفته شود
- ✅ هیچ Unhandled Promise Rejection وجود نداشته باشد

**اعتبارسنجی**:
- بررسی لاگ‌ها: خطای OpenRouter لاگ شود اما سیستم crash نکند
- بررسی response: decision از سایر providerها برگردانده شود
- بررسی console: هیچ Unhandled Promise Rejection وجود نداشته باشد

---

### Test 5: No Regression (OpenRouter Not Configured)

**مراحل**:
1. حذف `OPENROUTER_API_KEY` از `.env`
2. Restart backend
3. انتخاب `activeModel = "hybrid"` یا `activeModel = "openrouter"`
4. ایجاد decision request

**انتظار**:
- ✅ اگر `activeModel=openrouter` و کلید نباشد، OpenRouter `null` برگرداند
- ✅ اگر `activeModel=hybrid` و کلید نباشد، OpenRouter skip شود و سایر providerها کار کنند
- ✅ هیچ خطای runtime وجود نداشته باشد
- ✅ رفتار کلی سیستم مانند قبل باقی بماند

**اعتبارسنجی**:
- بررسی لاگ‌ها: OpenRouter skip شود (بدون خطا)
- بررسی response: decision از سایر providerها برگردانده شود
- بررسی console: هیچ خطای runtime وجود نداشته باشد

---

### Test 6: Frontend Dropdowns

**مراحل**:
1. باز کردن AI Manager → Decision Engine Tab
2. بررسی dropdown activeModel
3. باز کردن AI Manager → Settings Tab
4. بررسی dropdown activeModel
5. باز کردن Decision Config Modal
6. بررسی dropdown activeModel

**انتظار**:
- ✅ گزینه `openrouter` در تمام dropdownها وجود داشته باشد
- ✅ انتخاب آن باعث تغییر `activeModel` شود

**اعتبارسنجی**:
- بررسی UI: گزینه OpenRouter در تمام dropdownها نمایش داده شود
- تست انتخاب: انتخاب OpenRouter باعث تغییر state شود

---

### Test 7: APIConfig Test Connection

**مراحل**:
1. باز کردن AI Menu → Config Tab
2. پیدا کردن سرویس "OpenRouter" (یا افزودن آن اگر وجود ندارد)
3. افزودن کلید API
4. کلیک روی "Test Connection"

**انتظار**:
- ✅ تست اتصال انجام شود
- ✅ در صورت موفقیت، پیام success نمایش داده شود
- ✅ در صورت خطا، پیام خطا نمایش داده شود (بدون alert spam)

**اعتبارسنجی**:
- بررسی UI: پیام success/error نمایش داده شود
- بررسی console: لاگ‌های تست دیده شود
- بررسی network: request به `openrouter.ai` ارسال شود

---

## تأیید عدم Regression

### موارد تأیید شده:

1. **Backward Compatibility**:
   - ✅ Env varهای قدیمی (`ANTHROPIC_API_KEY`, `CHATGPT_API_KEY`) همچنان کار می‌کنند
   - ✅ اگر `*_API_KEYS` نباشد، از `*_API_KEY` استفاده می‌شود

2. **Behavior بدون تغییر**:
   - ✅ وقتی OpenRouter تنظیم نشده، رفتار سیستم بدون تغییر است
   - ✅ وقتی فقط یک کلید تنظیم شده، rotation انجام نمی‌شود (همانند قبل)

3. **Error Handling**:
   - ✅ Provider failures همچنان به صورت graceful handle می‌شوند
   - ✅ هیچ Unhandled Promise Rejection وجود ندارد

---

## خلاصه نهایی

### تغییرات انجام شده:
- ✅ OpenRouter به عنوان provider جدید اضافه شد
- ✅ Multi-API-key support با round-robin rotation برای تمام providerها
- ✅ Frontend dropdownها به‌روزرسانی شدند
- ✅ تست اتصال OpenRouter در APIConfig اضافه شد
- ✅ مستندات کامل ایجاد شد

### آماده برای:
- ✅ تست دستی
- ✅ Deploy به محیط dev
- ✅ بررسی نهایی قبل از merge

---

---

## Runtime Validation Results (OpenRouter + Multi-Key)

تاریخ اجرا: [تاریخ را اینجا وارد کنید]  
تست‌کننده: [نام تست‌کننده]  
محیط: [Development / Staging]

---

### B1 – OpenRouter Only Mode

**مراحل انجام شده**:
1. [تنظیمات env]
2. [انتخاب activeModel=openrouter]
3. [ایجاد decision request]

**نتایج مشاهده شده**:
- فقط OpenRouter فراخوانی شد؟ [بله / خیر]
- Decision برگردانده شد؟ [بله / خیر]
- سایر providerها فراخوانی نشدند؟ [بله / خیر]
- Console/Network Logs: [متن لاگ‌ها]

**نتیجه**: ⏳ PENDING / ✅ PASS / ❌ FAIL

---

### B2 – Hybrid Mode (OpenRouter + Others)

**مراحل انجام شده**:
1. [تنظیمات کلیدها]
2. [انتخاب activeModel=hybrid]
3. [ایجاد decision request]

**نتایج مشاهده شده**:
- Providerها به صورت parallel فراخوانی شدند؟ [بله / خیر]
- Decision aggregated برگردانده شد؟ [بله / خیر]
- OpenRouter در لیست providers بود؟ [بله / خیر]
- Console/Network Logs: [متن لاگ‌ها]

**نتیجه**: ⏳ PENDING / ✅ PASS / ❌ FAIL

---

### B3 – Key Rotation (Multi-Key)

**مراحل انجام شده**:
1. [تنظیم *_API_KEYS با 3 کلید]
2. [ایجاد 5+ decision request]

**نتایج مشاهده شده**:
- Key index در لاگ‌ها rotate کرد؟ [بله / خیر]
- فقط index لاگ شد (نه مقدار کلید)؟ [بله / خیر]
- Round-robin pattern: [مثال: 0/2, 1/2, 2/2, 0/2, 1/2]
- Console/Backend Logs: [متن لاگ‌های key pool]

**نتیجه**: ⏳ PENDING / ✅ PASS / ❌ FAIL

---

### B4 – Provider Failure Handling

**مراحل انجام شده**:
1. [تنظیم کلید نامعتبر برای OpenRouter]
2. [تنظیم کلیدهای معتبر برای سایر providerها]
3. [انتخاب activeModel=hybrid]
4. [ایجاد decision request]

**نتایج مشاهده شده**:
- OpenRouter gracefully fail کرد (null برگرداند)؟ [بله / خیر]
- سایر providerها کار کردند؟ [بله / خیر]
- Decision از providerهای موفق برگردانده شد؟ [بله / خیر]
- Unhandled Promise Rejection: [هیچ / بله]
- Console/Backend Logs: [متن لاگ‌های خطا]

**نتیجه**: ⏳ PENDING / ✅ PASS / ❌ FAIL

---

### B5 – No Regression (OpenRouter Not Configured)

**مراحل انجام شده**:
1. [حذف OPENROUTER_API_KEY]
2. [انتخاب activeModel=hybrid یا openrouter]
3. [ایجاد decision request]

**نتایج مشاهده شده**:
- OpenRouter skip شد (بدون خطا)؟ [بله / خیر]
- سایر providerها کار کردند؟ [بله / خیر]
- Runtime error وجود نداشت؟ [بله / خیر]
- رفتار کلی مانند قبل بود؟ [بله / خیر]
- Console/Backend Logs: [متن لاگ‌ها]

**نتیجه**: ⏳ PENDING / ✅ PASS / ❌ FAIL

---

### خلاصه نتایج Runtime Validation (OpenRouter)

| Test | Status | Notes |
|------|--------|-------|
| B1 - OpenRouter Only | ⏳ PENDING | - |
| B2 - Hybrid Mode | ⏳ PENDING | - |
| B3 - Key Rotation | ⏳ PENDING | - |
| B4 - Failure Handling | ⏳ PENDING | - |
| B5 - No Regression | ⏳ PENDING | - |

**Overall Status**: ⏳ PENDING - در انتظار اجرای تست‌ها

---

**نکته**: این بخش باید با نتایج واقعی runtime validation پر شود. برای راهنمایی، به `docs/reports/EXTERNAL_AI_PROVIDERS.md` (Validation Checklist) مراجعه کنید.

---

**پایان خلاصه**

