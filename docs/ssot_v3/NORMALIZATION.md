## Confidence Normalization – SSOT v3.0

این فایل وضعیت قبل/بعد نرمال‌سازی confidence و نقاط اصلی استفاده را ثبت می‌کند.

### ۰. جدول شواهد (File + Line) — Before / After

| Layer | File | Lines | Field | Before (pre-SSOT v3) | After (current) | Notes |
|---|---|---:|---|---|---|---|
| Backend utility | `backend/utils/normalizeConfidence.js` | 15–31 | `normalizeConfidence(raw)` | پراکنده/بدون SSOT | **مرجع واحد** برای تبدیل confidence به ۰–۱۰۰ (۰–۱ ⇒ ×100 + clamp) | invalid ⇒ `null` |
| Backend (Agents adapter) | `backend/routes/ai-agents.js` | 265–332 | `transformAgentResultForUI().confidence` | confidence اغلب ۰–۱ و UI ضرب می‌کرد | confidence همیشه ۰–۱۰۰ با `normalizeConfidence(... ) ?? 50` | UI باید بدون `*100` نمایش دهد |
| Backend (Decision logging) | `backend/routes/ai-agents.js` | 223–255 | `logAndReturn(): ai_decisions.confidence` | احتمال ذخیره ۰–۱ | قبل از ذخیره با `normalizeConfidence(outputData?.confidence)` | برای data hygiene تاریخی backfill داریم |
| Backend (Artemis) | `backend/routes/artemis.js` | 281–405 | `opportunity.confidence`, `signals[*].confidence`, `mixture.confidence` | ورودی‌ها ممکن بود ۰–۱ باشند درحالی‌که threshold درصدی بود | ورودی‌ها در ابتدای handler به ۰–۱۰۰ normalize می‌شوند و مقایسه‌ها درصدی‌اند | threshold نمونه: 75 |
| UI (Agent detail) | `components/ai/AIManager/tabs/DataHub/AgentDetailPanel.tsx` | 374–387 | `msg.confidence` | `*100` برای confidence | **بدون `*100`** (confidence already ۰–۱۰۰) | impact_score جداست |
| UI (Agents list) | `components/ai/AIAgents.tsx` | 72–81 | `accuracy` | `result.confidence * 100` | `result.confidence` مستقیم | accuracy == confidence percent |
| Backend (Telegram impact) | `backend/routes/telegram.js` | 52–63 | `minImpact`, `impact_score` | impact_score از DB در بازه ۰–۱ | **همچنان ۰–۱** (این SSOT مربوط به confidence است، نه impact) | UI می‌تواند برای نمایش درصد ضرب کند |
| UI (Telegram impact) | `components/ai/AIManager/tabs/DataHub/TelegramDataPanel.tsx` | 160–172 | `formatImpact`, thresholds | impact ۰–۱ ⇒ ×100 | impact ۰–۱ ⇒ ×100 (برای نمایش) | thresholds: 0.7 / 0.5 |
| UI (Breaking News) | `components/ai/AIManager/tabs/DataHub/BreakingNewsMonitor.tsx` | 266–276 | `minImpact` slider | ۰–۱ | ۰–۱ (نمایش درصد با ×100) | پارامتر API هم ۰–۱ است |
| UI (DataHub source detect) | `components/ai/AIManager/tabs/DataHub/modals/CreateSourceModal.tsx` | 743–752 | `autoDetection.confidence` | ۰–۱ | ۰–۱ (نمایش درصد با ×100) | این confidence مربوط به type-detection است، نه Agent/Artemis confidence |

### ۱. وضعیت قبل از تغییر (High-level)

- **Agents (نمونه‌ها):**
  - `backend/services/agents/technical.js`  
    - `result.confidence` در بازه‌ی تقریبی ۰–۱ تولید می‌شد (مقادیر ۰.55، 0.7 و ...).
  - `backend/services/agents/fundamental.js`  
    - `confidence` به‌صورت float بین ۰–۱ محاسبه و با `toFixed(2)` محدود می‌شد.
  - `backend/services/risk-agent.js`, `backend/services/agents/market_intelligence.js`  
    - از مقیاس‌های داخلی ۰–۱ برای برخی امتیازها/اطمینان استفاده می‌کردند.

- **Artemis Decision (`backend/routes/artemis.js`):**
  - `opportunity.confidence` و `signals[*].confidence` به‌صورت غیرنرمال (اغلب ۰–۱) وارد منطق تصمیم‌گیری می‌شدند.
  - آستانه‌ها (`confidenceThreshold`) بر حسب درصد (مثلاً ۷۵) تعریف شده بود، ولی داده‌ی ورودی بعضاً ۰–۱ بود.

- **UI (نمونه‌ها):**
  - `components/ai/AIManager/tabs/DataHub/AgentDetailPanel.tsx`
    - در چند نقطه `* 100` روی `impact_score` و `confidence` اعمال می‌شد تا درصد نمایش داده شود.
  - `components/ai/AIManager/tabs/DataHub/TelegramDataPanel.tsx`
    - متد `formatImpact` مقدار ۰–۱ را در ۱۰۰ ضرب می‌کرد.
  - `components/ai/AIManager/tabs/DataHub/BreakingNewsMonitor.tsx`
    - روی `impact_score` و `source_reliability` ضرب ۱۰۰ انجام می‌شد.
  - `components/ai/AIAgents.tsx`
    - `accuracy` از `result.confidence * 100` پر می‌شد.

### ۲. تابع نرمال‌سازی مرکزی – `backend/utils/normalizeConfidence.js`

- **Signature:**
  - `normalizeConfidence(raw: number | string | null | undefined): number | null`

- **منطق:**
  - اگر ورودی `null/undefined/NaN` ⇒ خروجی `null`.
  - اگر ورودی string بود ⇒ به number تبدیل می‌شود.
  - اگر مقدار در بازه‌ی `0 ≤ c ≤ 1` باشد ⇒ به‌عنوان probability تفسیر شده و در ۱۰۰ ضرب می‌شود.
  - در انتها مقدار در بازه‌ی `[0, 100]` clamp می‌شود.

- **Evidence:**
  - فایل: `backend/utils/normalizeConfidence.js`

### ۳. اعمال در سطح Agent Output / API

#### ۳.۱. UI Adapter برای Agents – `transformAgentResultForUI`

- فایل: `backend/routes/ai-agents.js`
- تابع: `transformAgentResultForUI(agent_key, rawResult)`
- تغییرات:
  - برای همه‌ی agentها (شامل `fundamental` و `arbitrage`):
    - به‌جای استفاده‌ی مستقیم از عدد ۰–۱، `confidence` از طریق `normalizeConfidence` عبور می‌کند.
    - در صورت نامعتبر بودن مقدار، مقدار پیش‌فرض ۵۰ استفاده می‌شود.
- نمونه:
  - `arbitrage`:
    - قبل: `confidence: typeof rawResult.confidence === 'number' ? rawResult.confidence : 0.5`
    - بعد: `confidence: normalizedConfidence !== null ? normalizedConfidence : 50`
  - سایر agentها:
    - قبل: `confidence: typeof confidence === 'number' ? confidence : 0.5`
    - بعد: `confidence: normalizeConfidence(confidence) ?? 50`

#### ۳.۲. Artemis Decision – `/api/v1/artemis/decision`

- فایل: `backend/routes/artemis.js`
- Endpoint: `POST /api/v1/artemis/decision`
- تغییرات:
  - در ابتدای هندلر:
    - `opportunity.confidence` ⇒ `normalizedOpportunity.confidence = normalizeConfidence(...) ?? 0`
    - `signals[*].confidence` ⇒ برای هر سیگنال در آرایه‌ی `normalizedSignals` به ۰–۱۰۰ نرمال می‌شود.
  - منطق تصمیم:
    - `baseApproved` حالا بر روی `normalizedOpportunity.confidence` و آستانه‌ی درصدی `confidenceThreshold` (مثلاً ۷۵) اعمال می‌شود.
    - محاسبه‌ی `totalConfidence`:
      - میانگین confidence سیگنال‌ها و فرصت بر اساس مقدار نرمال‌شده‌ی ۰–۱۰۰ انجام می‌شود.
  - خروجی mixture:
    - مقدار `mixture.confidence` قبل از مقایسه با آستانه دوباره با `normalizeConfidence` نرمال می‌شود تا ۰–۱۰۰ شود.

### ۴. UI Multipliers – حذف ضرب‌های اضافی `* 100`

#### ۴.۱. Agent Detail Panel

- فایل: `components/ai/AIManager/tabs/DataHub/AgentDetailPanel.tsx`
- تغییرات:
  - `Avg Impact`:
    - **impact_score** در تلگرام در بازه‌ی ۰–۱ است ⇒ UI برای نمایش درصد همچنان `* 100` می‌کند.
  - رنگ‌بندی impact:
    - آستانه‌ها بر اساس ۰–۱ (`>= 0.7`, `>= 0.5`) باقی می‌ماند.
  - پیام‌های تکی Agent:
    - `Impact`: درصد نمایش داده می‌شود (۰–۱ ⇒ ×100).
    - `Confidence`: **بدون `* 100`** نمایش داده می‌شود چون backend الان confidence را ۰–۱۰۰ می‌دهد.

#### ۴.۲. Telegram Data Panel

- فایل: `components/ai/AIManager/tabs/DataHub/TelegramDataPanel.tsx`
- تابع `formatImpact`:
  - impact در بازه‌ی ۰–۱ است ⇒ UI برای نمایش درصد `num * 100` انجام می‌دهد.
  - رنگ‌بندی بر اساس ۰–۱ (`>= 0.7`, `>= 0.5`).

#### ۴.۳. Breaking News Monitor

- فایل: `components/ai/AIManager/tabs/DataHub/BreakingNewsMonitor.tsx`
- تغییرات:
  - `impact_score` برای agentهای متأثر:
    - impact در بازه‌ی ۰–۱ است ⇒ UI درصد را با `* 100` نمایش می‌دهد.
  - `source_reliability`:
    - مقدار در بازه‌ی ۰–۱ است ⇒ UI درصد را با `* 100` نمایش می‌دهد.

#### ۴.۴. AIAgents Accuracy

- فایل: `components/ai/AIAgents.tsx`
- تغییر:
  - قبل: `accuracy: agentData.result?.confidence * 100 || a.accuracy`
  - بعد: `accuracy: agentData.result?.confidence` به‌عنوان درصد ۰–۱۰۰.

### ۵. وضعیت بعد از تغییر (خلاصه)

- **Backend:**
  - همه‌ی مسیرهای اصلی تصمیم‌گیری و خروجی agentها به‌صورت استاندارد ۰–۱۰۰ به UI تحویل می‌دهند (با استفاده از `normalizeConfidence`).
  - Artemis Decision threshold (`confidenceThreshold`) به‌طور سازگار بر همین مقیاس اعمال می‌شود.

- **UI:**
  - در تب‌های AI Center، ضرب‌های اضافی `* 100` برای **confidence** حذف شده است، چون backend confidence را ۰–۱۰۰ استاندارد می‌دهد.
  - `impact_score` و `source_reliability` در تلگرام همچنان ۰–۱ هستند (طبق backend) و UI برای نمایش درصد ممکن است `* 100` انجام دهد.
  - محاسبات مستقل درصد (مثل win rate، hit rate، progress bar بر اساس نسبت تعداد) هنوز از فرمول `* 100` استفاده می‌کنند، چون به confidence مرتبط نیستند.

### ۶. کارهای بعدی (Open Items)

- پیاده‌سازی و مستندسازی اسکریپت backfill تاریخی:
  - فایل هدف: `backend/scripts/backfill_confidence_to_percent.js`
  - هدف: تبدیل رکوردهای تاریخی `ai_decisions.confidence` و `autopilot_actions.confidence` که هنوز در بازه‌ی ۰–۱ هستند به بازه‌ی ۰–۱۰۰.
-  - **وضعیت اجرا (dry-run + واقعی)**:
    - Dry-run (`--dry-run`) – تاریخ: `2026-02-23T20:24:03Z`  
      - جدول `ai_decisions`: **۳** ردیف کاندید با `confidence <= 1` (هیچ ردیفی به‌روزرسانی نشد).
      - جدول `autopilot_actions`: **۰** ردیف کاندید.
    - اجرای واقعی (بدون `--dry-run`) – تاریخ: `2026-02-23T20:55:18Z`  
      - جدول `ai_decisions`: **۳** ردیف کاندید ⇒ **۳** ردیف به‌روزرسانی شد (`confidence = confidence * 100`).  
      - جدول `autopilot_actions`: همچنان **۰** ردیف کاندید (هیچ تغییری اعمال نشد).
- تکمیل جدول قبل/بعد به‌صورت ردیف‌به‌ردیف (ماژول | فایل | Line | نوع فعلی | توضیح) در صورت نیاز به audit عمیق‌تر.

