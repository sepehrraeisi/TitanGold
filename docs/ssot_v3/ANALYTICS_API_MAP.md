## Analytics API Map – SSOT v3.0

این فایل وضعیت فعلی APIهای Analytics را مستند می‌کند.

### ۱. Overview

- UI اصلی: `components/ai/AnalyticsDashboard.tsx`
- لایه API فرانت‌اند: `services/api.ts` (تابع `fetchAnalyticsData`)
- بک‌اند فعلی:
  - یک endpoint رسمی Analytics به نام `/api/v1/analytics/overview` در `backend/routes/analytics.js` پیاده‌سازی شده است؛
  - این endpoint متریک‌های اصلی را از روی جداول `ai_agents`, `ai_decisions`, `ai_learning_events` محاسبه می‌کند.

### ۲. Endpoints – Backend (وضعیت فعلی)

| Path                             | Method | Description                                                  | Request model | Response model         | DB tables                                | Status      |
|----------------------------------|:------:|--------------------------------------------------------------|---------------|------------------------|------------------------------------------|-------------|
| `/api/v1/analytics/overview`    |  GET   | برگرداندن نمای کلی Analytics در قالب `AIAnalyticsMetrics`   | —             | `AIAnalyticsMetrics`   | `ai_agents`, `ai_decisions`, `ai_learning_events` | Implemented |

- **Evidence**:
  - فایل: `backend/routes/analytics.js`
  - استفاده از جداول:  
    - `ai_agents` برای accuracy، total/successful_decisions و status.  
    - `ai_learning_events` برای نرخ یادگیری (mistakes/improvements).  
    - `ai_decisions` برای decision rate در ۲۴ ساعت اخیر.

### ۳. Endpoints – Frontend API Layer (`services/api.ts`)

Analytics Dashboard قبلاً به‌طور کامل روی IndexedDB/شبیه‌ساز اجرا می‌شد؛ الان backend-first شده است با fallback آفلاین.

| Function              | Description                                                                 | Backend Path / Source                         | Status            |
|-----------------------|-----------------------------------------------------------------------------|-----------------------------------------------|-------------------|
| `fetchAnalyticsData()`| بارگذاری متریک‌های Analytics؛ ابتدا تلاش برای خواندن از `/api/v1/analytics/overview` و در صورت خطا/نبود توکن، استفاده از IndexedDB (`aiAgents` + `aiTrainingSessions`) | Backend (`/api/v1/analytics/overview`) + IndexedDB fallback | Partial (Backend-first با fallback آفلاین؛ برخی فیلدها placeholder هستند) |

جزئیات محاسبات:

- `realtime.decisionRate` و `realtime.successRate` از روی مقادیر `decisions`, `learningTime`, `accuracy` هر agent محاسبه می‌شود.
- `performance.totalDecisions`, `performance.totalLearningHours`, `performance.avgAccuracy`, `performance.monthlyImprovement` از روی `aiAgents` و `aiTrainingSessions` محاسبه می‌شود.
- `agentMatrix` شامل slice حداکثر ۱۲ agent با فیلدهای `accuracy`, `successRate`, `progress`, `status` است.

### ۳.۱. متریک‌ها (Implemented vs Planned)

- **Implemented در `/api/v1/analytics/overview`:**
  - `realtime.decisionRate`: تعداد تقریبی تصمیم‌ها در ۲۴ ساعت اخیر (تبدیل‌شده به نرخ در دقیقه از روی `ai_decisions`).
  - `realtime.successRate`: درصد موفقیت تصمیم‌ها (نسبت `successful_decisions` به `total_decisions` روی `ai_agents`، در صورت نبود داده از `avgAccuracy` استفاده می‌شود).
  - `performance.totalDecisions`: مجموع `total_decisions` همه‌ی agents.
  - `performance.avgAccuracy`: میانگین `accuracy` agents (در مقیاس ۰–۱۰۰).
  - `performance.monthlyImprovement`: نرخ یادگیری از روی `ai_learning_events` (mistake/improvement و `learned`).
  - `agentMatrix[*].accuracy` و `agentMatrix[*].successRate`: متریک‌های per-agent بر اساس `ai_agents` (با برش حداکثر ۱۲ agent).
- **Placeholders / Planned (در مدل وجود دارند ولی هنوز به داده‌ی واقعی متصل نشده‌اند):**
  - `performance.totalLearningHours`, `agentMatrix[*].progress`.
  - `resourceUsage.*` (cpu/gpu/memory, precision, recall).
  - متریک‌های مالی مانند PnL و drawdown (در نسخه‌های بعدی می‌توانند به مدل اضافه شده و از جداول مالی خوانده شوند).

**Evidence:**

- فایل: `services/api.ts`
  - تابع: `fetchAnalyticsData` (بلاک ۵۹۹۰–۶۰۸۰ در snapshot فعلی).

### ۴. وضعیت فعلی (Summary)

- بک‌اند:
  - یک endpoint رسمی `GET /api/v1/analytics/overview` پیاده‌سازی شده که `AIAnalyticsMetrics` را از روی `ai_agents`, `ai_decisions`, `ai_learning_events` محاسبه می‌کند.
- فرانت‌اند:
  - Analytics Dashboard حالا backend-first است (از `fetchAnalyticsData` که REST را صدا می‌زند) و فقط در حالت آفلاین/خطا روی IndexedDB/شبیه‌ساز برمی‌گردد.
- Status در Coverage Matrix:
  - ماژول `aiCenter.analytics` در وضعیت **Partial** است: API/DB واقعی دارد و متریک‌های اصلی از DB محاسبه می‌شوند، اما برخی فیلدها (مثل `resourceUsage.*`، `performance.totalLearningHours` و `agentMatrix.progress`) هنوز placeholder هستند و می‌توانند در فازهای بعدی غنی‌تر شوند.

### ۵. گام‌های بعدی (Planned)

- غنی‌تر کردن متریک‌های Analytics بدون تغییر در قرارداد اصلی:
  - پرکردن `performance.totalLearningHours` و `agentMatrix.progress` از روی داده‌های واقعی (مانند `ai_training_sessions` یا متریک‌های training دیگر).
  - اضافه‌کردن متریک‌های تکمیلی در صورت نیاز (مانند PnL/drawdown) بر اساس جداول مالی موجود.
- در صورت نیاز، اضافه‌کردن endpointهای تفکیک‌شده (per-agent, per-period) روی همان مدل `AIAnalyticsMetrics` بدون وابستگی به mock.
- حفظ وضعیت backend-first در `fetchAnalyticsData` و محدود کردن IndexedDB به نقش fallback آفلاین.

