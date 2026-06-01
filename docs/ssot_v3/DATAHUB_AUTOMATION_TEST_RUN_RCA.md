# DataHub Automation Test-Run — RCA & Minimal Fix Plan

> **Phase:** DH-P0-SECURITY-12 (RCA + plan only — **no implementation**)  
> **Date:** 2026-05-31  
> **Branch:** `feat/gap-008-sources-backend-wiring`  
> **Related:** D-03 (SECURITY-11), GAP-036, [`DATAHUB_DRY_RUN_RUNTIME_RESULTS.md`](./DATAHUB_DRY_RUN_RUNTIME_RESULTS.md) § D-03

---

## 1. Executive summary

D-03 failed **safely** (HTTP 500, no Telegram send, no execution/history rows) because `runAutomationTest()` ignores the optional `topic_id` for queue selection and always dispatches **global** `queue[0]` after a **global** `refreshAutomationQueue()`. On this host, `queue[0]` was a stale Demo Topic item whose `record_id` no longer exists in `collected_data`, so `loadRecordPayload()` returned `null` and threw **before** `runPublisherPublish()` ran.

This is a **logic bug** (incomplete `topic_id` wiring), compounded by **stale queue data** and **asymmetric error handling** vs bulk dispatch. The env dry-run gate (`TELEGRAM_PUBLISHER_DRY_RUN=true`) was never exercised on the automation→publisher path.

**Recommended fix:** **Option A** (topic-scoped refresh + queue selection when `topic_id` is provided) plus a **small Option B** slice (skip or fail orphan heads inside test-run only, with structured 4xx instead of opaque 500). **Do not** use manual DB cleanup as the primary fix.

**GAP-036:** Remains **Open** until D-03 is re-run and passes after the code fix.

---

## 2. D-03 failed-safe result (SECURITY-11)

| Field | Value |
|-------|-------|
| Env gate | `TELEGRAM_PUBLISHER_DRY_RUN=true` (both `titan-backend` workers) |
| Health | **200** |
| Request | `POST /api/v1/data-hub/automation/test-run` |
| Body | `{ "dry_run": true, "topic_id": "bc6c5f1b-4df1-4e11-a324-3f94efc55e0e" }` |
| HTTP | **500** |
| Error | `Source record not found` |
| Publisher invoked | **No** |
| `telegram_message_id` | **None** |
| `datahub_automation_executions` | 10 → 10 (no new row) |
| `publisher_delivery_history` | 14 → 14 (no new row) |
| Live Telegram / Bot API | **None** (logs) |

**Verdict:** Telegram-safe; D-03 **Fail** (dry-run chain not proven end-to-end).

---

## 3. Function trace

### 3.1 Route layer

| Item | Location |
|------|----------|
| Route | `POST /api/v1/data-hub/automation/test-run` |
| File | `backend/routes/data-hub-automation.js` |
| Handler | L217–234: `validateBody(testRunSchema)` → `runAutomationTest(req.user?.id, { topicId: req.validatedBody.topic_id, dryRun: req.validatedBody.dry_run })` |
| Auth | `writeAuth` (admin/trader) |
| Errors | `catch` → `res.status(error.status \|\| 500).json({ error: message })` |

### 3.2 Schema

| Item | Location |
|------|----------|
| File | `backend/schemas/datahubAutomationSchemas.js` |
| `testRunSchema` | L51–54: `topic_id` optional UUID; `dry_run` optional, **default `true`** |

### 3.3 Service — test-run entry

| Step | Function | File | Lines | Behavior |
|------|----------|------|-------|----------|
| 1 | `runAutomationTest(userId, { topicId, dryRun })` | `datahubAutomationService.js` | L682–699 | If `topicId`: `getAutomationTopic(topicId)` → single topic in `topics[]`. Else: all enabled topics. **`topics` is never used after validation.** |
| 2 | `refreshAutomationQueue()` | same | L352–437 | Refreshes **all** enabled topics with publishers; returns `{ added, queue }` where `queue = listAutomationQueue()` (**global** pending list). |
| 3 | Queue pick | same | L692–696 | `queue = refresh.queue`; if empty → 200 early return; else **`item = queue[0]`** (no `topic_id` filter). |
| 4 | Load row | same | L697–698 | `SELECT * FROM datahub_automation_queue WHERE id = $1` |
| 5 | `dispatchQueueItem(row, userId, { dryRun })` | same | L463–534 | See below |

### 3.4 Queue listing (defines `queue[0]`)

| Item | Location |
|------|----------|
| `listAutomationQueue({ status = 'pending', limit = 50 })` | `datahubAutomationService.js` L286–295 |
| SQL | `SELECT * FROM datahub_automation_queue WHERE status = 'pending' ORDER BY priority DESC, created_at ASC LIMIT $2` |
| Effect | **Global** pending queue; highest numeric `priority` first, then **oldest** `created_at` among ties |

### 3.5 Refresh (enqueues, does not prune orphans)

| Item | Location |
|------|----------|
| `refreshAutomationQueue()` | L352–437 |
| Scope | **All** `enabled` topics with `publisherTargets` — **not** filtered by test-run `topicId` |
| Inserts | New `pending` rows when pipeline records match topic triggers and per-topic/per-publisher caps allow (`MAX_PER_PAIR = 3`, `MAX_QUEUE = 25`) |
| Does **not** | Remove or fail stale pending rows with missing `collected_data` |

### 3.6 Dispatch + payload load

| Step | Function | Lines | Behavior |
|------|----------|-------|----------|
| Payload | `loadRecordPayload(recordId)` | L439–461 | `SELECT … FROM collected_data cd WHERE cd.id = $1`; returns `null` if missing |
| Guard | `dispatchQueueItem` | L465–468 | If `!payload` → **`throw new Error('Source record not found')`** (no `error.status` → route returns **500**) |
| Publish | `runPublisherPublish(…, { confirm_publish: true }, userId)` | L472–482 | Only reached if payload exists |
| Dry-run merge | L493–499 | `effectiveDryRun = publishResult.dry_run \|\| dryRun`; execution `status` can be `dry_run` |
| Mutations on success | L501–531 | `UPDATE datahub_automation_queue`; `INSERT datahub_automation_executions` |

### 3.7 Publisher gate (would apply if reached)

| Item | Location |
|------|----------|
| `isPublisherDryRunForced()` | `telegramPublisherService.js` L5–9 |
| `runPublisherPublish` dry path | L271–304 | When forced: `status: 'dry_run'`, `telegram_message_id: null`, history row — **no** `sendTelegramBotMessage` |

### 3.8 Contrast — bulk dispatch error handling

| Path | On `Source record not found` |
|------|------------------------------|
| `dispatchAutomationQueue` | L551–577: **try/catch** → mark queue `failed`, insert failed execution, continue |
| `runAutomationTest` | **No try/catch** → exception propagates → **HTTP 500**, queue stays **`pending`**, no execution row |

---

## 4. Queue state evidence (SECURITY-11 runtime)

### 4.1 Topic requested in D-03

| Field | Value |
|-------|-------|
| Topic ID | `bc6c5f1b-4df1-4e11-a324-3f94efc55e0e` |
| Name | سیگنال |
| `is_active` | true |
| `publish_targets.publisherIds` | `["5ab9a6bc-5f17-4aae-bb06-4a34e827af24"]` (D-02 publisher) |
| Pending queue rows for this topic | **0** at test time |

### 4.2 Global pending queue (what `queue[0]` was)

All three pending items shared `priority = 2`, `topic_id = 7ffb5473-cc05-43b1-bfa9-05cd5870b3e6` (Demo Topic), `publisher_id = bc5ce007-71f3-4a0d-89fe-a717d79641f9`. None of the `record_id` values existed in `collected_data` (`valid_record = false`).

| queue id | record_id | created_at (UTC) | Notes |
|----------|-----------|------------------|-------|
| `0db4cf7c-feaa-497c-8eca-9b35eb6f805f` | `a75e9591-8761-42fd-aabf-dac2d5afda19` | 2026-05-29 11:51:21 | **Selected as `queue[0]`** (oldest among priority-2 pending) |
| `eea3f036-1344-41c3-90e2-fb58b6edf1bb` | `771fd394-d077-401b-b603-e606af1e678b` | 2026-05-29 11:51:24 | Orphan |
| `a3cc0b48-358c-4c89-b605-1ac1b234772a` | `038491e7-8cff-4d71-a7e4-32f8ac70657c` | 2026-05-29 11:51:26 | Orphan |

`collected_data` on host had valid rows (e.g. `975bfd4d-…`, `cb089dbb-…`) — data exists, but not for these queue `record_id`s.

---

## 5. Root cause

### 5.1 Primary (logic bug)

**`topic_id` in the test-run request only validates that the topic exists; it does not scope refresh or queue selection.**

Evidence in code:

```682:699:backend/services/datahubAutomationService.js
export async function runAutomationTest(userId, { topicId, dryRun = true } = {}) {
  const topics = topicId
    ? [await getAutomationTopic(topicId)]
    : (await listAutomationTopics()).filter(t => t.enabled);
  // ... topics validated but never referenced again ...
  const refresh = await refreshAutomationQueue();
  const queue = refresh.queue;
  // ...
  const item = queue[0];
  // ...
  return dispatchQueueItem(row.rows[0], userId, { dryRun: dryRun !== false });
}
```

Operator expectation: `topic_id` selects the automation topic (and its publisher chain) for the probe. Actual behavior: **global** `queue[0]`, which was a **different** topic/publisher with **orphan** records.

### 5.2 Contributing factors

1. **Stale pending queue** — historical items reference deleted/missing `collected_data` rows; refresh does not reconcile them.
2. **Same priority ordering** — new valid items for سیگنال would sort **after** older Demo Topic pending rows when priorities tie.
3. **Test-run lacks dispatch-style catch** — bulk dispatch recovers from missing records; test-run surfaces **500** and leaves the bad head **pending** (blocks repeat tests).

### 5.3 Not root cause

- **Env dry-run gate** — working (proven in D-02); simply not reached in D-03.
- **Live send attempt** — did not occur.
- **Missing `dry_run` in request** — schema defaults to `true`; failure was pre-publish.

---

## 6. Logic-bug checklist (code-verified)

| Question | Answer |
|----------|--------|
| Does `topic_id` only validate topic existence? | **Yes** — `getAutomationTopic(topicId)` then unused `topics` array. |
| Does it filter queue selection? | **No** — always `queue[0]` from global `listAutomationQueue()`. |
| Does `refreshAutomationQueue()` enqueue for selected topic only? | **No** — iterates **all** enabled topics. |
| Does test-run use global pending queue? | **Yes** — `refresh.queue` is global pending list. |
| Does it skip invalid/orphan queue items? | **No** — dispatches first head; throws if record missing. |
| Does `dry_run` prevent source/queue mutation? | **Partially.** `dry_run` does **not** skip `refreshAutomationQueue()` inserts. On **success**, `dispatchQueueItem` still `UPDATE`s queue and `INSERT`s execution (with `dry_run` flags). On D-03 **failure**, throw happens **before** any queue/execution/publisher writes. `dry_run` does **not** prevent `runPublisherPublish` from being called once payload exists — but `TELEGRAM_PUBLISHER_DRY_RUN=true` forces publisher dry-run (no Bot API). |

---

## 7. Fix option comparison

| Option | Description | Pros | Cons | Risk |
|--------|-------------|------|------|------|
| **A — Topic-scoped test-run** | When `topic_id` present: refresh/enqueue only for that topic; select next pending item `WHERE topic_id = $1` (same `ORDER BY`); optional require topic `enabled` | Matches API intent; minimal surface; reuses real queue + `dispatchQueueItem` + publisher chain; fixes D-03 probe for سیگنال | Requires small refactor of `refreshAutomationQueue({ topicId })` or post-refresh filter; must define behavior when topic has no pending rows after refresh | **Low** — test-run only |
| **B — Skip orphan heads (test-run)** | Before dispatch, skip items where `loadRecordPayload` would fail; mark `failed` with `metadata.mode: 'test_run_orphan'` or try next candidate | Unblocks global test-run; aligns with `dispatchAutomationQueue` resilience | Mutates queue/executions for orphans; must scope to **test-run** to avoid changing production dispatch semantics without review | **Low–medium** — controlled writes, no live send if env gate on |
| **C — Synthetic dry-run payload** | Bypass queue; build sample message from topic + first `publisherIds[]`; call `runPublisherPublish` directly | Always reaches publisher gate; good for “publisher-only” proof | Does **not** validate queue selection, refresh caps, or real record payload; diverges from production dispatch path | **Low** for Telegram safety; **medium** for fidelity |
| **D — Manual DB cleanup** | Delete/fail stale pending rows in SQL/UI | Fast one-off unblock | Hides logic bug; repeatable failure on next orphan; ops burden; outside SSOT automation contract | **Low** live-send risk if only deleting queue rows; **not** a durable fix |

---

## 8. Recommended option

### **Option A + small Option B** (matches operator expectation; verified against code)

#### A — Topic-scoped test-run (primary)

When `topic_id` is provided:

1. Load topic via `getAutomationTopic`; reject if not `enabled` (400).
2. Call `refreshAutomationQueue({ topicId })` **or** refresh all then **filter** queue to `topic_id` before pick (prefer dedicated scope to avoid unrelated inserts filling caps).
3. Select head with:

   ```sql
   SELECT * FROM datahub_automation_queue
   WHERE status = 'pending' AND topic_id = $1
   ORDER BY priority DESC, created_at ASC
   LIMIT 1
   ```

4. If none after refresh → **200** with `{ dryRun: true, message: 'No pending queue items for topic', processed: 0 }` (not 500).

When `topic_id` is **omitted**, keep global behavior but apply **B** below.

#### B — Orphan handling (test-run only, secondary)

For the candidate item(s) in test-run:

1. If `loadRecordPayload(record_id)` is null → mark queue item `failed` (and optional failed execution with `dry_run: true`, `metadata.mode: 'test_run_orphan'`) **or** advance to next topic-scoped/global candidate.
2. Return **400** with clear code only if **no** valid candidate after scan (e.g. `NO_VALID_QUEUE_ITEM`) — avoid bare 500 for expected data drift.
3. **Do not** call `runPublisherPublish` for orphan items.

**Do not implement Option C** as the sole fix for GAP-036 D-03 — use only as fallback if product accepts publisher-only proof (document separately).

**Reject Option D** as primary — see §9.

### Minimal code touch list (implementation phase — not now)

| File | Change |
|------|--------|
| `datahubAutomationService.js` | `refreshAutomationQueue({ topicId }?)`; `runAutomationTest` topic-scoped pick; test-run orphan loop / catch |
| `datahubAutomationSchemas.js` | Optional: document `topic_id` semantics in comment or OpenAPI |
| `data-hub-automation.js` | No route change expected |
| Tests | Add unit/integration: topic_id selects same-topic item; orphan skipped; forced dry-run still no `telegram_message_id` |

---

## 9. Safety constraints (implementation + re-test)

| Constraint | Requirement |
|------------|-------------|
| Live Telegram | `TELEGRAM_PUBLISHER_DRY_RUN=true` must remain for D-03 re-run |
| Endpoints | Only `POST …/automation/test-run` — no `/publish`, no `/queue/dispatch` |
| Scope | Test-run behavior change only; avoid altering live `dispatchAutomationQueue` without explicit approval |
| Queue writes | Orphan fail/skip in test-run is acceptable; must not set `sent` + live `telegram_message_id` |
| `dry_run: false` on test-run | Out of scope for GAP-036 closure; keep default `true` |
| DB manual cleanup | **Not** required for fix validation |

### Why DB cleanup is not preferred

1. **Does not fix the bug** — next orphan or wrong-topic head reproduces D-03 failure.
2. **Misleading pass** — D-03 could pass on Demo Topic + wrong publisher while `topic_id` remains meaningless.
3. **Audit/ops risk** — manual queue edits are error-prone and undocumented in code.
4. **SECURITY-12 scope** — code contract should match `{ topic_id, dry_run: true }` operator model.

Cleanup may still be a **separate** hygiene task after the fix, not a substitute for it.

---

## 10. Verification plan after fix

### 10.1 Pre-re-run gates (unchanged)

- `GET /health` → 200  
- PM2 `TELEGRAM_PUBLISHER_DRY_RUN=true`  
- Admin/trader JWT  

### 10.2 Automated (preferred before production re-run)

- Topic A has valid pending item → test-run dispatches **that** topic’s head, not another topic’s.  
- Topic B has only orphan pending → test-run fails item, tries next or returns 400 `NO_VALID_QUEUE_ITEM` without 500.  
- With env gate mocked/true → `publishResult.dry_run === true`, `telegram_message_id === null`.  

### 10.3 D-03 re-run (single execution — separate approval)

| Step | Action |
|------|--------|
| 1 | Capture `COUNT(*)` on `datahub_automation_executions`, `publisher_delivery_history` |
| 2 | `POST /api/v1/data-hub/automation/test-run` with `{ "dry_run": true, "topic_id": "bc6c5f1b-4df1-4e11-a324-3f94efc55e0e" }` |
| 3 | Expect **HTTP 200**, response includes `dryRun: true` / `publishResult.dry_run: true`, `telegram_message_id: null` |
| 4 | Verify execution row (if created) has `dry_run = true`, `status = dry_run` |
| 5 | Verify new `publisher_delivery_history.status = dry_run` if publisher path ran |
| 6 | Logs: no `sendMessage`; no `/queue/dispatch` |

**Pass criteria:** Same as [`GAP_036_DRY_RUN_GATE_PLAN.md`](./GAP_036_DRY_RUN_GATE_PLAN.md) D-03 row.

### 10.4 GAP-036 closure

Close GAP-036 in `GAPS_AND_PLAN.md` only when **D-02 Pass** (done) **and** **D-03 Pass** (after fix + re-run).

---

## 11. Decision — GAP-036 status

| Item | Status |
|------|--------|
| Env gate (`e4f2b79`) | Applied |
| D-02 | **Pass** |
| D-03 | **Fail** (logic bug + stale global queue head) |
| **GAP-036** | **Open** |
| High-risk live publish/dispatch | **NO-GO** |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-31 | DH-P0-SECURITY-12 — RCA + minimal fix plan (no code) |
