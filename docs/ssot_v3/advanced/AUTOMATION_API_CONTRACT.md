# DataHub Advanced — Automation API Contract (implemented)

> Subtab: `dataHub.advanced.automation` · UI: `AutomationTopics.tsx`  
> Base: `/api/v1/data-hub/automation`

## Architecture (final)

| Layer | Storage | API |
|-------|---------|-----|
| **Agent Topics** (GAP-018) | `datahub_automation_topics` | `GET/POST/PUT/DELETE /topics` |
| **Queue / Schedule / Dispatch** (GAP-019) | `datahub_automation_queue`, `datahub_automation_schedule`, `datahub_automation_executions` | `/queue/*`, `/schedule`, `/executions`, `/test-run` |
| **Topic Routing (global)** | `topic_routing_rules` | `/api/v1/topic-routing` — **separate**, AI Center |

Agent topics are **not** merged into `topic_routing_rules`.

---

## ۱. Agent Topics (`datahub_automation_topics`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `name` | VARCHAR | Display title |
| `topic_key` | VARCHAR | Unique slug |
| `source_type` | VARCHAR | Default `pipeline` |
| `trigger_conditions` | JSONB | `agentId`, `categoryIds`, `dataTypes`, `tags`, thresholds, `includeStatuses` |
| `publish_targets` | JSONB | `{ publisherIds: uuid[] }` |
| `is_active` | BOOLEAN | UI `enabled` |
| `priority` | SMALLINT | 1–4 → low/medium/high/critical |
| `created_by` | UUID | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

Migration: `026_create_datahub_automation_topics.sql`

---

## ۲. Queue / Schedule / Executions

### Schedule (`datahub_automation_schedule`, singleton `id=default`)

- `enabled`, `interval_minutes`, `max_items_per_run`, `last_run_at`, `next_run_at`
- **v3.0:** persistence + manual dispatch only — no backend cron worker
- **GAP-020 (v3.1):** distributed / cron scheduler enhancement (non-blocker)

### Queue (`datahub_automation_queue`)

- Status: `pending` | `processing` | `sent` | `failed` | `cancelled`
- Unique pending: `(record_id, publisher_id)` partial index

### Executions (`datahub_automation_executions`)

- Auditable history: `sent` | `failed` | `dry_run`
- Links to `publisher_delivery_history` when applicable

Migration: `027_create_datahub_automation_queue.sql`

---

## ۳. Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/overview` | JWT | Topics + schedule + queue + executions + summary |
| `GET/POST/PUT/DELETE` | `/topics` | read / write | CRUD |
| `GET/PUT` | `/schedule` | read / write | Schedule config |
| `GET` | `/queue` | JWT | List queue |
| `POST` | `/queue/refresh` | admin/trader | Build queue from pipeline + `collected_data` |
| `POST` | `/queue/dispatch` | admin/trader | Batch dispatch `{ limit, dry_run }` |
| `POST` | `/queue/:id/dispatch` | admin/trader | Single item publish |
| `PATCH` | `/queue/:id` | admin/trader | Mark failed |
| `GET` | `/executions` | JWT | History |
| `POST` | `/executions/:id/retry` | admin/trader | Re-queue + dispatch |
| `POST` | `/test-run` | admin/trader | Refresh + dispatch one item (default dry-run) |

Dispatch uses `runPublisherPublish` → `/api/v1/data-hub/telegram-publishers` (not legacy `publishToTelegram`).

---

## ۴. Frontend

| File | Role |
|------|------|
| `services/datahubAutomationApi.ts` | HTTP client |
| `hooks/useDatahubAutomation.ts` | React Query |
| `AutomationTopics.tsx` | No IndexedDB for automation data |
| `hooks/useTelegramPublishers.ts` | Publisher targets dropdown |

---

## ۵. Done criteria ✅

- [x] `AutomationTopics.tsx` — API only
- [x] `dataHub.advanced.automation` = **Implemented**
- [x] GAP-018 Closed, GAP-019 Closed
- [x] GAP-020 Open (cron worker v3.1, non-blocker)
- [x] `npm run build` passes
