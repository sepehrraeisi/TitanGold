## Training API Map – SSOT v3.0

این فایل وضعیت فعلی APIهای Training را مستند می‌کند.

### ۱. Overview

- UI اصلی: `components/ai/TrainingCenter.tsx`
- لایه API فرانت‌اند: `services/api.ts` (توابع `fetchTrainingData`, `scheduleAITrainingSession`, `completeAITrainingSession`, `fetchTrainingConfig`, `updateTrainingConfig`, `artemisAutoConfigureTraining`)
- بک‌اند فعلی:
  - روت فایل: `backend/routes/training.js`
  - جدول اصلی: `ai_training_sessions` (از روی روت و migrations استنباط شده؛ جزئیات اسکیمای دقیق در migrations مربوطه)

### ۲. Endpoints – Backend

| Path                          | Method | Description                                        | Request model                              | Response model                    | DB tables             | Status      |
|-------------------------------|:------:|----------------------------------------------------|--------------------------------------------|-----------------------------------|-----------------------|-------------|
| `/api/v1/training/sessions`   |  GET   | لیست آخرین ۵۰ session ثبت‌شده در DB               | —                                          | `AITrainingSession[]` (raw DB)   | `ai_training_sessions` | Implemented |
| `/api/v1/training/sessions`   |  POST  | ایجاد training session جدید (تک agent یا چند agent) | `{ agent_id? , agent_ids? , session_name/title, mode, config }` | `AITrainingSession` یا `AITrainingSession[]` | `ai_training_sessions` | Implemented |
| `/api/v1/training/sessions/:id/start` | POST | شروع یک session (status=running)               | —                                          | `AITrainingSession` (raw DB)     | `ai_training_sessions` | Implemented |
| `/api/v1/training/sessions/:id/complete` | POST | تکمیل یک session (status=completed + results) | `{ accuracyGain?, results? }`              | `AITrainingSession` (raw DB)     | `ai_training_sessions` | Implemented |
| `/api/v1/training/overview`   |  GET   | برگرداندن نمای کلی Training در قالب `AITrainingStats` | —                                      | `AITrainingStats`                 | `ai_training_sessions`, `ai_agents` | Implemented |

- **Evidence**:
  - File: `backend/routes/training.js`
  - Query: `SELECT * FROM ai_training_sessions ORDER BY created_at DESC LIMIT 50`
  - Insert: `INSERT INTO ai_training_sessions (agent_id, session_name, mode, config) ...`
  - Overview aggregates:  
    - `SELECT COUNT(*) AS count FROM ai_training_sessions`  
    - `SELECT * FROM ai_training_sessions WHERE status = 'running' ...`  
    - `SELECT * FROM ai_training_sessions WHERE status IN ('pending','scheduled') ...`  
    - `SELECT * FROM ai_training_sessions WHERE status = 'completed' ...`  
    - `SELECT AVG(accuracy) AS avg_accuracy FROM ai_agents WHERE accuracy IS NOT NULL`
  - Start / complete:  
    - `UPDATE ai_training_sessions SET status='running', started_at=COALESCE(started_at,NOW()), updated_at=NOW() WHERE id = $1`  
    - `UPDATE ai_training_sessions SET status='completed', completed_at=NOW(), updated_at=NOW(), results = results || patch WHERE id = $1`

### ۳. Endpoints – Frontend API Layer (`services/api.ts`)

در حال حاضر، Training Center به‌جای اتصال مستقیم به بک‌اند، از IndexedDB برای نگه‌داشت داده‌های training استفاده می‌کند.

| Function                         | Description                                                    | Backend Path / Source        | Status            |
|----------------------------------|----------------------------------------------------------------|------------------------------|-------------------|
| `fetchTrainingData()`           | بارگذاری آمار training (sessions, avgAccuracy, queues, history, config) از IndexedDB | UI/IndexedDB (`database.getAll('aiTrainingSessions')`) | UI-Only (Planned backend) |
| `scheduleAITrainingSession()`   | ایجاد session جدید و ذخیره در IndexedDB                       | UI/IndexedDB (`database.save('aiTrainingSessions', ...)`) | UI-Only (Planned backend) |
| `completeAITrainingSession()`   | تکمیل session، به‌روزرسانی agents و صف در IndexedDB          | UI/IndexedDB                 | UI-Only (Planned backend) |
| `fetchTrainingConfig()`         | دریافت تنظیمات training از IndexedDB (`settings.training_config`) | UI/IndexedDB                 | UI-Only (Planned backend) |
| `updateTrainingConfig()`        | به‌روزرسانی تنظیمات training در IndexedDB                     | UI/IndexedDB                 | UI-Only (Planned backend) |
| `artemisAutoConfigureTraining()`| تنظیم خودکار config با Artemis (سمت UI/IndexedDB)            | UI-layer فقط (بدون REST رسمی) | UI-Only (Planned backend) |

### ۴. وضعیت فعلی (Summary)

- بک‌اند:
  - Endpointهای پایه‌ی CRUD برای `ai_training_sessions` (GET/POST) پیاده‌سازی شده‌اند و واقعی‌اند.
- فرانت‌اند:
  - Training Center (`TrainingCenter.tsx`) فعلاً روی لایه‌ی شبیه‌سازی‌شده (`services/api.ts` + IndexedDB) سوار است و مستقیماً از REST backend استفاده نمی‌کند.
- Status در Coverage Matrix:
  - ماژول `aiCenter.training` فعلاً در وضعیت **Partial** است:
    - API/DB برای `ai_training_sessions` موجود است.
    - ولی UI هنوز به جای REST، از IndexedDB استفاده می‌کند و wiring کامل نشده است.

### ۵. گام‌های بعدی (Planned)

- طراحی و پیاده‌سازی endpointهای تجمیعی Training (مثلاً `/api/v1/training/overview`) برای برگرداندن شیء `AITrainingStats` از روی `ai_training_sessions` و `ai_agents`.
- به‌روزرسانی توابع `fetchTrainingData`, `scheduleAITrainingSession`, `completeAITrainingSession`, `updateTrainingConfig`, `artemisAutoConfigureTraining` در `services/api.ts` تا:
  - در حالت آنلاین، از REST backend استفاده کنند.
  - در حالت آفلاین، از IndexedDB به‌عنوان fallback بهره ببرند.
- به‌روزرسانی `SSOT_v3.0.md` و این فایل پس از تکمیل wiring تا وضعیت به `Implemented` ارتقا پیدا کند.

