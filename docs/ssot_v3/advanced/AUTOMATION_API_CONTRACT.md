# DataHub Advanced — Automation API Contract (pre-wiring)

> Subtab: `dataHub.advanced.automation` · UI: `AutomationTopics.tsx`  
> **وضعیت:** قرارداد برای تأیید — **بدون wiring** در این مرحله.

## چرا «Implemented» یکجا ممنوع است

تب Automation سه لایه متفاوت دارد. تا وقتی **هر سه** backend-first نشوند، SSOT فقط **Partial** است:

| لایه | محتوا | Backend امروز | GAP |
|------|--------|---------------|-----|
| **A** | Topic Routing (global، AI Center + router) | ✅ `/api/v1/topic-routing` | — (خارج از DataHub tab؛ مرجع) |
| **B** | Agent Topic Routes (Automation UI) | ❌ IndexedDB `dataHub.automation.agentTopics` | **GAP-018** |
| **C** | Queue + Schedule + Dispatch | ❌ IndexedDB `publisherQueue`, `automation.schedule` | **GAP-019** |

---

## ۱. UI دقیقاً چه چیزی لازم دارد؟ (`AutomationTopics.tsx`)

| نیاز UI | منبع فعلی | هدف backend-first |
|---------|-----------|-------------------|
| لیست agent topics (CRUD) | `dataHub.automation.agentTopics` via `fetchDataHubState` | API اختصاصی یا mapping به DB |
| آمار topic (enabled, pass rate) | محاسبه client از topics | از API یا aggregate |
| Publisher queue | `dataHub.advanced.publisherQueue` | جدول + API |
| Schedule (enable, interval, max items) | `dataHub.automation.schedule` | جدول + API + worker |
| Refresh queue | `refreshAutomationQueue()` → IndexedDB | `POST .../automation/queue/refresh` |
| Dispatch queue | `dispatchAutomationQueue()` → `publishToTelegram` legacy | `POST .../automation/queue/dispatch` → `telegram-publishers` publish API |
| Process queue item | `processQueueItem` | `PATCH` queue item status |
| Publisher targets dropdown | `publisherMap` از `dataHub.advanced.telegramPublishers` | **`GET /api/v1/data-hub/telegram-publishers`** (GAP-016 ✅) |

**باگ فعلی UI:** `AutomationTopics` صدا می‌زند `api.createAutomationTopic` / `deleteAutomationTopic` که در `services/api.ts` فعلی **export نمی‌شوند** (نام‌های واقعی: `createAgentTopicRoute`, `deleteAgentTopicRoute`).

---

## ۲. Topic Routing — API واقعی (جدا از DataHub Automation tab)

> این API برای **keyword → agent_key** روی `collected_data` است (سرویس `topicRouter`). با **AgentTopicRoute** در Automation UI یک مدل نیست.

### Base: `/api/v1/topic-routing`

| Method | Path | Auth | Response |
|--------|------|------|----------|
| `GET` | `/` | `authenticate` | `{ rules: TopicRoutingRule[] }` |
| `POST` | `/` | `authenticate` + write limiter | `{ rule }` — body: `name`, `keywords[]`, `agent_key`, `priority`, `is_active` |
| `PUT` | `/:id` | `authenticate` | `{ rule }` |
| `DELETE` | `/:id` | `authenticate` | `{ message }` |
| `GET` | `/logs` | `authenticate` | `{ logs, total, limit, offset }` |

### DB: `topic_routing_rules`, `topic_routing_logs`

### UI که از این API استفاده می‌کند

- `components/ai/TopicRouting.tsx` (AI Center)
- **نه** `AutomationTopics.tsx` (DataHub Advanced)

### Mapping conceptual (اگر بخواهیم یکپارچه کنیم — خارج از scope فوری)

| AgentTopicRoute (UI) | TopicRoutingRule (API) |
|----------------------|-------------------------|
| `agentId` / agent | `agent_key` |
| `categoryIds`, `dataTypes`, `tags` | `keywords` (نیاز به extension schema) |
| `publisherTargets` | **ندارد** — GAP-018 |

**نتیجه:** Topic Routing API را **جدا** نگه می‌داریم؛ Automation agent topics نیاز به **GAP-018** (جدول/API جدید یا extension) دارند.

---

## ۳. Agent Topic Routes — پیشنهاد GAP-018 (IndexedDB امروز)

### وضعیت فعلی (`services/api.ts`)

- `createAgentTopicRoute` / `updateAgentTopicRoute` / `deleteAgentTopicRoute`
- همه → `fetchDataHubState` + `database.save('settings', 'data_hub_state')`
- شکل: `AgentTopicRoute` در `types.ts` (`categoryIds`, `dataTypes`, `publisherTargets`, `stats`, …)

### Endpoint پیشنهادی (v3.1)

`GET/POST/PUT/DELETE /api/v1/data-hub/automation/topics`

DB پیشنهادی: `datahub_automation_topics` (یا JSONB در `data_hub_automation_config`)

---

## ۴. Queue / Schedule / Dispatch — GAP-019 (IndexedDB امروز)

### وضعیت فعلی

| Function | کار |
|----------|-----|
| `refreshAutomationQueue` | پر کردن `advanced.publisherQueue` از `normalizedData` + pipeline |
| `dispatchAutomationQueue` | `publishToTelegram` روی IndexedDB publishers |
| `setAutomationScheduleEnabled` / `Interval` / `MaxItems` | schedule در state + `setInterval` client-side |
| `processQueueItem` | به‌روزرسانی آیتم + history |

همه وابسته `fetchDataHubState` / `persistDataHubState`.

### Legacy coupling

- `publishToTelegram` در `services/api.ts` — **فقط automation dispatch** (نه `TelegramPublisher.tsx`)
- پس از GAP-016 باید dispatch به `POST /api/v1/data-hub/telegram-publishers/:id/publish` با `confirm_publish` مهاجرت کند

### Endpoint پیشنهادی (v3.1)

| Method | Path | نقش |
|--------|------|-----|
| `GET` | `/api/v1/data-hub/automation/queue` | لیست queue |
| `POST` | `/api/v1/data-hub/automation/queue/refresh` | بازسازی queue از pipeline/collected_data |
| `POST` | `/api/v1/data-hub/automation/queue/dispatch` | ارسال pending → telegram-publishers API |
| `PATCH` | `/api/v1/data-hub/automation/queue/:id` | process sent/failed |
| `GET` | `/api/v1/data-hub/automation/schedule` | |
| `PUT` | `/api/v1/data-hub/automation/schedule` | |

DB پیشنهادی: `automation_queue_items`, `automation_schedule_config`

Worker: schedule باید از client `setInterval` به backend cron/worker منتقل شود (بخشی از GAP-019).

---

## ۵. Security (پیشنهاد wiring)

| Endpoint class | Auth |
|----------------|------|
| Read (topics, queue, schedule) | `authenticate` |
| Write / dispatch / refresh | `authenticate` + `authorize('admin','trader')` |
| Dispatch publish | همان قوانین GAP-016 (`confirm_publish`, dry-run) |

RBAC read-only برای viewer → **GAP-020** (اختیاری، جدا از wiring).

---

## ۶. SSOT / Done criteria (بعد از تأیید شما)

**Implemented** فقط وقتی:

- [ ] **B** — agent topics از API (نه IndexedDB)
- [ ] **C** — queue + schedule + dispatch از API (نه IndexedDB)
- [ ] Dispatch از `publishToTelegram` legacy جدا شده
- [ ] `AutomationTopics.tsx` بدون `fetchDataHubState` برای دادهٔ اصلی
- [ ] Demos در `DataHub_DEMOS.md`
- [ ] GAP-018 و GAP-019 بسته

**تا آن زمان:** `dataHub.advanced.automation` = **Partial**؛ Topic Routing global = مرجع جدا در AI Center.

---

## ۷. سوالات برای تأیید شما

1. **Agent topics:** جدول جدید `datahub_automation_topics` یا ادغام با `topic_routing_rules` (breaking shape)?
2. **Queue refresh:** منبع داده `collected_data` / pipeline API (GAP-012) کافی است؟
3. **Schedule:** آیا worker backend در v3.0 الزامی است یا فاز ۱ فقط API + manual trigger؟

**پس از تأیید این contract → wiring شروع می‌شود (ابتدا B یا C — ترتیب را شما تعیین کنید).**
