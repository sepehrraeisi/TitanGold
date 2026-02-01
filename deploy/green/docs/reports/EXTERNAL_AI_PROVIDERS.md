# External AI Providers + Artemis Mixture

تاریخ: 2025-12-24  
دامنه: OpenRouter Integration + Multi-API-Key Support

---

## خلاصه تغییرات

این مستندات تغییرات انجام شده برای افزودن OpenRouter به عنوان provider جدید و پیاده‌سازی پشتیبانی از چند کلید API (key pools) برای تمام providerهای خارجی را شرح می‌دهد.

### تغییرات اصلی:

1. **OpenRouter Provider**: افزودن OpenRouter به backend Artemis orchestrator
2. **Multi-API-Key Support**: پشتیبانی از چند کلید API با round-robin rotation برای تمام providerها
3. **Frontend Integration**: افزودن OpenRouter به dropdownهای انتخاب provider
4. **Testing Support**: افزودن تست اتصال OpenRouter در APIConfig

---

## متغیرهای محیطی (Environment Variables)

### فرمت Single Key (کلید واحد)

```bash
# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-xxxxx

# OpenAI
OPENAI_API_KEY=sk-xxxxx
# یا
CHATGPT_API_KEY=sk-xxxxx

# Anthropic/Claude
ANTHROPIC_API_KEY=sk-ant-xxxxx
# یا
CLAUDE_API_KEY=sk-ant-xxxxx

# DeepSeek
DEEPSEEK_API_KEY=sk-xxxxx
# یا
API_KEY=sk-xxxxx
```

### فرمت Multi-Key (چند کلید - Key Pools)

```bash
# OpenRouter - چند کلید (comma-separated)
OPENROUTER_API_KEYS=sk-or-v1-key1,sk-or-v1-key2,sk-or-v1-key3

# OpenAI - چند کلید
OPENAI_API_KEYS=sk-key1,sk-key2,sk-key3

# Anthropic/Claude - چند کلید
ANTHROPIC_API_KEYS=sk-ant-key1,sk-ant-key2
# یا
CLAUDE_API_KEYS=sk-ant-key1,sk-ant-key2

# DeepSeek - چند کلید
DEEPSEEK_API_KEYS=sk-key1,sk-key2
```

**نکته مهم**: اگر `*_API_KEYS` (جمع) تنظیم شده باشد، از آن استفاده می‌شود. در غیر این صورت، از `*_API_KEY` (مفرد) استفاده می‌شود. این تضمین می‌کند که backward compatibility حفظ شود.

---

## OpenRouter Configuration

### متغیرهای محیطی OpenRouter

```bash
# کلید API (الزامی)
OPENROUTER_API_KEY=sk-or-v1-xxxxx
# یا چند کلید:
OPENROUTER_API_KEYS=sk-or-v1-key1,sk-or-v1-key2

# مدل پیش‌فرض (اختیاری - پیش‌فرض: openai/gpt-4o-mini)
OPENROUTER_MODEL=openai/gpt-4o-mini
# یا
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
# یا
OPENROUTER_MODEL=google/gemini-pro-1.5

# HTTP-Referer (اختیاری - برای tracking)
OPENROUTER_HTTP_REFERER=https://your-domain.com

# X-Title (اختیاری - برای tracking)
OPENROUTER_X_TITLE=TitanGold Trading System
```

### مدل‌های پیشنهادی OpenRouter

- `openai/gpt-4o-mini` (پیش‌فرض) - سریع و ارزان
- `openai/gpt-4o` - قوی‌تر
- `anthropic/claude-3.5-sonnet` - تعادل خوب
- `google/gemini-pro-1.5` - گزینه جایگزین
- `meta-llama/llama-3.1-405b-instruct` - open-source

---

## Key Pool Rotation (چرخش کلیدها)

### نحوه کار

1. **Initialization**: در اولین فراخوانی `getNextKey(providerName)`, کلیدها از env خوانده می‌شوند.
2. **Round-Robin**: هر فراخوانی بعدی، کلید بعدی از pool انتخاب می‌شود (به صورت چرخشی).
3. **Logging**: فقط index کلید لاگ می‌شود (هرگز مقدار کلید لاگ نمی‌شود).

### مثال

```javascript
// با OPENAI_API_KEYS=key1,key2,key3
// فراخوانی 1: key1 (index 0)
// فراخوانی 2: key2 (index 1)
// فراخوانی 3: key3 (index 2)
// فراخوانی 4: key1 (index 0) - دوباره از اول
```

### لاگ‌ها

```
[KeyPool] openai: using key index 0/2
[KeyPool] openai: using key index 1/2
[KeyPool] openai: using key index 2/2
```

---

## فایل‌های تغییر یافته

### Backend

1. **`backend/services/artemisOrchestrator.js`**
   - افزودن `PROVIDERS.openrouter`
   - افزودن تابع `getNextKey()` برای key pool management
   - افزودن تابع `callOpenRouter()`
   - به‌روزرسانی `getMixtureDecision()` برای شامل کردن OpenRouter
   - به‌روزرسانی تمام provider functions برای استفاده از `getNextKey()`

### Frontend

2. **`components/ai/AIManager/tabs/DecisionEngineTab.tsx`**

   - افزودن `<option value="openrouter">openrouter</option>`

3. **`components/ai/AIManager/tabs/SettingsTab.tsx`**

   - افزودن `<option value="openrouter">{t('openrouter') || 'OpenRouter'}</option>`

4. **`components/ai/AIManager.tsx`**

   - افزودن `<option value="openrouter">{t('openrouter') || 'OpenRouter'}</option>`

5. **`components/ai/ArtemisComponents.tsx`**

   - افزودن `<option value="openrouter">{t('openrouter') || 'OpenRouter'}</option>`

6. **`components/ai/APIConfig.tsx`**
   - افزودن import `testOpenRouterConnection`
   - افزودن logic برای تست `ai-openrouter`
   - به‌روزرسانی filters برای شامل کردن `ai-openrouter`

### Services

7. **`services/openrouterService.ts`** (جدید)
   - تابع `generateContent()` برای تولید محتوا
   - تابع `testOpenRouterConnection()` برای تست اتصال

---

## Validation Checklist

### 1. OpenRouter Only Mode

**تست**: `activeModel=openrouter` → فقط OpenRouter فراخوانی شود

**مراحل**:

1. تنظیم `OPENROUTER_API_KEY` در `.env`
2. در UI، انتخاب `activeModel=openrouter`
3. ایجاد یک decision request
4. بررسی لاگ‌ها: فقط `callOpenRouter` فراخوانی شود

**انتظار**:

- ✅ فقط OpenRouter API فراخوانی شود
- ✅ هیچ provider دیگری فراخوانی نشود
- ✅ در صورت موفقیت، decision برگردانده شود

---

### 2. Hybrid Mode (OpenRouter + Others)

**تست**: `activeModel=hybrid` → OpenRouter + سایر providerها به صورت parallel فراخوانی شوند

**مراحل**:

1. تنظیم کلیدهای API برای چند provider (مثلاً OpenRouter + OpenAI + Claude)
2. در UI، انتخاب `activeModel=hybrid`
3. ایجاد یک decision request
4. بررسی لاگ‌ها: تمام providerهای فعال فراخوانی شوند

**انتظار**:

- ✅ OpenRouter + سایر providerهای فعال فراخوانی شوند
- ✅ تمام فراخوانی‌ها به صورت parallel انجام شوند (Promise.all)
- ✅ تصمیم نهایی از aggregateDecisions برگردانده شود

---

### 3. Key Rotation (Multi-Key)

**تست**: با چند کلید تنظیم شده، کلیدها به صورت round-robin چرخش کنند

**مراحل**:

1. تنظیم `OPENAI_API_KEYS=key1,key2,key3` در `.env`
2. ایجاد چندین decision request متوالی
3. بررسی لاگ‌ها: `[KeyPool] openai: using key index X/Y`

**انتظار**:

- ✅ در هر فراخوانی، index کلید تغییر کند (0 → 1 → 2 → 0 → ...)
- ✅ فقط index لاگ شود (نه مقدار کلید)
- ✅ با یک کلید (`OPENAI_API_KEY`), رفتار بدون تغییر باقی بماند

---

### 4. Provider Failure Handling

**تست**: در صورت خطای provider، سیستم crash نکند و تصمیم از سایر providerها گرفته شود

**مراحل**:

1. تنظیم یک کلید نامعتبر برای OpenRouter
2. تنظیم کلیدهای معتبر برای سایر providerها
3. انتخاب `activeModel=hybrid`
4. ایجاد decision request

**انتظار**:

- ✅ OpenRouter خطا بدهد و `null` برگرداند
- ✅ سایر providerها به کار خود ادامه دهند
- ✅ تصمیم نهایی از providerهای موفق گرفته شود
- ✅ هیچ Unhandled Promise Rejection وجود نداشته باشد
- ✅ سیستم crash نکند

---

### 5. No Regression (OpenRouter Not Configured)

**تست**: وقتی OpenRouter تنظیم نشده، رفتار سیستم بدون تغییر باقی بماند

**مراحل**:

1. حذف `OPENROUTER_API_KEY` از `.env`
2. انتخاب `activeModel=hybrid` یا `activeModel=openrouter`
3. ایجاد decision request

**انتظار**:

- ✅ اگر `activeModel=openrouter` و کلید نباشد، OpenRouter `null` برگرداند
- ✅ اگر `activeModel=hybrid` و کلید نباشد، OpenRouter skip شود و سایر providerها کار کنند
- ✅ هیچ خطای runtime وجود نداشته باشد
- ✅ رفتار کلی سیستم مانند قبل باقی بماند

---

### 6. Frontend Dropdowns

**تست**: OpenRouter در تمام dropdownهای انتخاب provider نمایش داده شود

**مراحل**:

1. باز کردن AI Manager → Decision Engine Tab
2. باز کردن AI Manager → Settings Tab
3. باز کردن AI Manager → Decision Config Modal

**انتظار**:

- ✅ گزینه `openrouter` در تمام dropdownها وجود داشته باشد
- ✅ انتخاب آن باعث تغییر `activeModel` شود

---

### 7. APIConfig Test Connection

**تست**: تست اتصال OpenRouter در APIConfig کار کند

**مراحل**:

1. باز کردن AI Menu → Config Tab
2. پیدا کردن سرویس "OpenRouter" (یا افزودن آن اگر وجود ندارد)
3. افزودن کلید API
4. کلیک روی "Test Connection"

**انتظار**:

- ✅ تست اتصال انجام شود
- ✅ در صورت موفقیت، پیام success نمایش داده شود
- ✅ در صورت خطا، پیام خطا نمایش داده شود (بدون alert spam)

---

## Manual Validation Steps

### Setup

1. **تنظیم متغیرهای محیطی**:

   ```bash
   # در .env
   OPENROUTER_API_KEY=sk-or-v1-xxxxx
   OPENROUTER_MODEL=openai/gpt-4o-mini
   OPENAI_API_KEYS=key1,key2,key3  # برای تست key rotation
   ```

2. **Restart Backend**: بعد از تغییر `.env`, backend را restart کنید.

### Test Scenarios

#### Scenario 1: OpenRouter Only

```bash
# در UI: activeModel = "openrouter"
# انتظار: فقط OpenRouter فراخوانی شود
```

#### Scenario 2: Hybrid with OpenRouter

```bash
# در UI: activeModel = "hybrid"
# انتظار: OpenRouter + سایر providerهای فعال فراخوانی شوند
```

#### Scenario 3: Key Rotation

```bash
# در .env: OPENAI_API_KEYS=key1,key2,key3
# ایجاد 5 decision request متوالی
# انتظار: لاگ‌های [KeyPool] openai: using key index 0/2, 1/2, 2/2, 0/2, 1/2
```

#### Scenario 4: Failure Handling

```bash
# در .env: OPENROUTER_API_KEY=invalid-key
# در UI: activeModel = "hybrid"
# انتظار: OpenRouter خطا بدهد، سایر providerها کار کنند
```

---

## قبل / بعد (Before / After)

### قبل از تغییرات:

- فقط 4 provider: Gemini, Claude, OpenAI, DeepSeek
- هر provider فقط یک کلید API پشتیبانی می‌کرد
- OpenRouter وجود نداشت

### بعد از تغییرات:

- 5 provider: Gemini, Claude, OpenAI, DeepSeek, **OpenRouter**
- هر provider از چند کلید API پشتیبانی می‌کند (key pools)
- Round-robin rotation برای توزیع load
- Backward compatibility: اگر `*_API_KEYS` نباشد، از `*_API_KEY` استفاده می‌شود

---

## ریسک‌ها و ملاحظات

### ریسک‌ها:

1. **Backward Compatibility**: اگر env varهای قدیمی (`ANTHROPIC_API_KEY`, `CHATGPT_API_KEY`) استفاده شوند، همچنان کار می‌کنند.
2. **Key Pool Initialization**: Key pools فقط یک بار initialize می‌شوند (در اولین فراخوانی). برای تغییر کلیدها، backend باید restart شود.
3. **Error Handling**: اگر تمام providerها خطا بدهند، `getMixtureDecision` `null` برمی‌گرداند (همانند قبل).

### ملاحظات:

- Key rotation فقط در runtime انجام می‌شود (نه در restart).
- لاگ‌های key pool فقط زمانی نمایش داده می‌شوند که چند کلید تنظیم شده باشد.
- OpenRouter model می‌تواند از env (`OPENROUTER_MODEL`) یا به صورت parameter تنظیم شود.

---

## Rollback Notes

در صورت نیاز به rollback:

1. **Backend**: حذف تغییرات در `backend/services/artemisOrchestrator.js`:

   - حذف `PROVIDERS.openrouter`
   - حذف `getNextKey()` و استفاده مستقیم از `process.env.*_API_KEY`
   - حذف `callOpenRouter()`
   - حذف logic OpenRouter از `getMixtureDecision()`

2. **Frontend**: حذف گزینه `openrouter` از dropdownها:

   - `components/ai/AIManager/tabs/DecisionEngineTab.tsx`
   - `components/ai/AIManager/tabs/SettingsTab.tsx`
   - `components/ai/AIManager.tsx`
   - `components/ai/ArtemisComponents.tsx`

3. **Services**: حذف `services/openrouterService.ts` و import آن از `APIConfig.tsx`

---

**پایان مستندات**
