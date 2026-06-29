# DH-TELEGRAM-COLLECTOR-P7 — Agent Feed Performance Final

**Phase:** P7 (backend query + UX)  
**Status:** REAL WORKING  
**Depends on:** P6 UI/i18n/design polish (accepted)

---

## Context

P6 fixed UI/i18n/enum labels and replaced the raw API error with a designed empty state, but **Agent Feed was not truly working**:

| Symptom | Before P7 |
|---------|-----------|
| `/api/v1/telegram/agents/{agent}/feed` | **3–5 minutes** per request |
| nginx workaround | `proxy_read_timeout 180s` on `/api/v1/telegram/agents/` |
| UI | Empty state hid slow backend |
| Verdict | NOT REAL WORKING |

---

## Phase 1 — RCA / Query Profiling

### Table sizes (production DB)

| Table | Rows |
|-------|------|
| `telegram_agent_impacts` | ~10.9M |
| `processed_telegram_messages` | ~5.6M |
| `telegram_messages` | ~5.5M |
| `telegram_channels` | 45 |

### Root causes (before)

1. **Join order inverted** — query started from `telegram_agent_impacts`, joined all of `processed_telegram_messages`, filtered on `pm.created_at` *after* join.
2. **Text cast join** — `pm.id::text = ai.processed_message_id::text` prevented UUID index use.
3. **OR channel join** — `pm.channel_id = tc.id OR pm.channel_id = tc.channel_id` blocked index-only plans (only `tc.id` needed — verified 100% match via `tc.id`).
4. **No early LIMIT** — large join + sort before limiting rows.
5. **Full `cleaned_text`** — unnecessary payload size.

### EXPLAIN ANALYZE — before (legacy query)

- Did not complete within practical timeout (minutes).
- Seq scans / massive join on ~10M impact rows.

### EXPLAIN ANALYZE — after (P7 query)

```
Execution Time: 0.393 ms
Index Scan idx_agent_impacts_created → Limit 5 → Index Scan processed_telegram_messages_pkey
Buffers: shared hit=24
```

---

## Phase 2 — Backend Endpoint Optimization

**New service:** `backend/services/telegramAgentFeed.js`

Strategy:

1. **Inner subquery** on `telegram_agent_impacts` with `agent_key`, `ai.created_at` filter, `ORDER BY ai.created_at DESC`, `LIMIT/OFFSET`.
2. **UUID join** `pm.id = ai.processed_message_id` (no cast).
3. **Simple channel join** `pm.channel_id = tc.id`.
4. **Preview text** `LEFT(pm.cleaned_text, 500)`.
5. **Default limit** 20 (was 50).
6. **Empty feed** → fast `200` with `message: "No feed items for this agent and filter."`
7. **Pagination** — `hasMore`, `nextCursor` (offset-based).

**Route:** `backend/routes/telegram.js` — uses `loadAgentFeed()` inside existing Redis cache wrapper.

---

## Phase 3 — Migration / Indexes

**File:** `backend/database/migrations/045_telegram_agent_feed_indexes.sql`

```sql
CREATE INDEX IF NOT EXISTS idx_agent_impacts_agent_created
    ON telegram_agent_impacts (agent_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_impacts_agent_priority_created
    ON telegram_agent_impacts (agent_key, priority_level, created_at DESC);
```

Recorded in `pgmigrations` as `045_telegram_agent_feed_indexes`.  
Existing indexes retained (`idx_agent_impacts_created_agent`, `unique_message_agent`, etc.) — no duplicates removed.

---

## Phase 4 — Redis / Shared Cache

- Uses existing `getTelegramAnalyticsCached()` → shared Redis via `pipelineSnapshotCache.js`.
- Cache key includes: `agentKey`, `timeRange`, `limit`, `offset`, `minImpact`, `requiresAction`, `priority`.
- TTL: **60s** (`TELEGRAM_CACHE_TTL.agentFeed`).

Warm repeat requests served from cache (<100ms through nginx).

---

## Phase 5 — Pagination

Response shape:

```json
{
  "pagination": { "limit": 20, "offset": 0, "hasMore": true, "nextCursor": 20 }
}
```

Frontend `AgentDetailPanel` already uses offset pagination (`page`, `LIMIT=20`).

---

## Phase 6 — Frontend AI Inbox Feed UX

**File:** `components/ai/AIManager/tabs/DataHub/AgentDetailPanel.tsx`

| State | Message key |
|-------|-------------|
| Loading | `telegram_agent_feed_loading` |
| Empty (fast 200) | `telegram_agent_feed_empty_filter` |
| Error | `telegram_agent_feed_load_error` + Retry |
| Timeout (15s client) | `telegram_agent_feed_timeout` |

Removed `feedNotConfigured` fake empty state (no longer masks slow backend).

**File:** `TelegramDataPanel.tsx` — `data-agent-key` on agent cards for reliable QA.

---

## Phase 7 — Browser Verification

**Script:** `backend/scripts/telegram-collector-p7-browser-audit.mjs`  
**Evidence:** `docs/ssot_v3/screenshots/telegram-collector-p7-browser-evidence.json`  
**Screenshot:** `docs/ssot_v3/screenshots/telegram-collector-p7-ai-inbox-feed.png`  
**Captured:** 2026-06-29 @ https://titan.zala.ir  
**Bundle:** `DataHubTab-X-IXCc4s.js`

| Agent | loadMs | HTTP |
|-------|--------|------|
| trend | 295 | 200 |
| sentiment | 468 | 200 |
| technical | 492 | 200 |
| price_prediction | 461 | 200 |
| fundamental | 536 | 200 |

- No forbidden API messages  
- No raw i18n  
- **Verdict: REAL WORKING**

---

## Phase 8 — Performance Verification

**Script:** `backend/scripts/telegram-collector-p7-perf.mjs`  
**Evidence:** `docs/ssot_v3/screenshots/telegram-collector-p7-network-evidence.json`

### nginx p95 sample (5 iterations, 5 agents, 3 time/limit combos)

| Agent | timeRange | limit | p95 (nginx) |
|-------|-----------|-------|-------------|
| trend | 24 | 5 | 484ms |
| trend | 24 | 20 | 101ms |
| sentiment | 24 | 20 | 131ms |
| technical | 168 | 5 | 123ms |
| price_prediction | 24 | 5 | 92ms |
| fundamental | 168 | 5 | 152ms |

- All successful requests **< 2s**; most **< 500ms** warm p95.
- Local backend direct p95 mostly **< 200ms**.
- **No timeouts.**

### nginx 180s timeout note

The P6 workaround (`location ^~ /api/v1/telegram/agents/` with 180s) is **no longer required** for normal feed use. It can remain harmlessly or be reverted to 30s — queries complete in sub-second.

---

## Phase 9 — No Regression

| Area | Status |
|------|--------|
| Overview / Categories / Breaking / Geographic | Unchanged routes |
| AI Inbox list (`/agents/summary`) | 200 |
| Collector health | 200 |
| Import/Sync write paths | Not modified |

---

## Phase 10 — Tests / Build / DevOps

```
backend: telegramAgentFeed.test.js — 4 passed
frontend: telegramCollectorI18n.test.ts — 6 passed
npm run build — pass
pm2 titan-backend — restarted
migration 045 — applied
```

---

## Remaining limitations

- Planner may still choose `idx_agent_impacts_created` + filter on `agent_key` for some plans; execution remains sub-ms.
- Rate limiter (429) can appear under rapid automated benchmark bursts — not a query performance issue.
- Full message text truncated to 500 chars in feed list (detail endpoint can be added later if needed).

---

## Final Verdict

**REAL WORKING** — Agent feed endpoint responds in **< 1s** (typically **< 500ms**) for all verified agents; browser + nginx evidence confirms; no minute-long waits; no fake empty state; tests/build pass.

**Commit:** `fix(datahub): optimize telegram collector agent feed performance`
