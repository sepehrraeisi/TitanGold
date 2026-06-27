# DH-AUTOMATION-ROUTING-P3 — End-to-End Fix and Redesign

Date: 2026-06-27  
Task: `DH-AUTOMATION-ROUTING-P3-FUNCTIONAL-FIX-AND-REDESIGN`  
Prior RCA: [`DH-AUTOMATION-ROUTING-P3-END-TO-END-RCA.md`](./DH-AUTOMATION-ROUTING-P3-END-TO-END-RCA.md) (verdict accepted: **PARTIAL — FUNCTIONAL BUT CONFUSING**)  
Design reference: [`DESIGN_SYSTEM_DATAHUB.md`](../../DESIGN_SYSTEM_DATAHUB.md)

---

## Final Verdict

### **REAL WORKING** — implementation + Human QA i18n verified (2026-06-27)

| Criterion | Result |
|-----------|--------|
| E2E dry-run chain (fixture → queue → dispatch → publisher history) | **PASS** |
| Invalid topics shown explicitly (not silent) | **PASS** |
| Queue refresh summary | **PASS** |
| Dry-run dispatch | **PASS** |
| Delivery history human-readable | **PASS** |
| **No raw `automation_*` keys in UI (Human QA i18n)** | **PASS** — see §11 |
| Disabled publisher / missing mapping explainable | **PASS** |
| Retry disabled for `SOURCE_RECORD_NOT_FOUND` | **PASS** |
| Dry-run default + `confirm_live` for live | **PASS** |
| Redesign aligned with DataHub design system | **PASS** |
| Browser verification | **PASS** |
| Production operator config repair | **PENDING** — existing topics still target disabled publishers |

**Operator note:** Code and UX are verified working. Production routing from the three existing topics remains blocked until an admin selects an active publisher and creates source→publisher mappings (repair UX provided).

---

## 1. RCA Summary (Accepted)

Key confirmed findings from Phase 1 RCA:

- Telegram Collector is healthy; pipeline has processed data.
- Automation blocked by **production configuration**, not missing backend.
- All active topics target **disabled publishers**.
- Mappings point to disabled publisher; active publisher has no mappings.
- Queue empty because refresh correctly skips invalid targets (`PUBLISHER_DISABLED`).
- `SOURCE_RECORD_NOT_FOUND` is stale historical orphan data.
- Scheduler is manual-only by design.

**Collector was not modified** (no verified Collector bug).

---

## 2. What Changed

### 2.1 Backend — configuration validation

| File | Change |
|------|--------|
| `backend/services/automationTopicValidity.js` | **NEW** — `evaluateTopicValidity`, `computeAutomationHealth`, `loadPublisherValidityMaps` |
| `backend/services/automationErrorLabels.js` | **NEW** — human labels + `isRetryAllowedForExecution` |
| `backend/services/datahubAutomationService.js` | Topic `validity` on list/overview; refresh `summary`; enhanced health banner; `validateAutomationTopic`; retry guard for orphan records; `errorLabel` / `retryAllowed` / `isStale` on executions |
| `backend/routes/data-hub-automation.js` | `POST /topics/:id/validate` |

**Topic validity statuses:**

| Status | Meaning |
|--------|---------|
| `valid` | Active publisher + mapping + enabled topic |
| `disabled_publisher` | Topic targets inactive publisher |
| `missing_mapping` | No enabled source→publisher mapping |
| `stale_source_record` | Historical execution references deleted record |
| `no_candidates` | Valid config but no matching processed records (validate endpoint) |

**Queue refresh response shape:**

```json
{
  "added": 0,
  "skipped": 3,
  "blocked": 0,
  "candidates": 0,
  "summary": {
    "candidates": 0,
    "queued": 0,
    "skipped": 3,
    "blocked": 0,
    "reasons": [{ "code": "PUBLISHER_DISABLED", "count": 3, "label": "..." }]
  }
}
```

**Retry guard:** `retryAutomationExecution` rejects `SOURCE_RECORD_NOT_FOUND` and missing `collected_data` rows.

### 2.2 Frontend — redesign + repair UX

| File | Change |
|------|--------|
| `AutomationTopics.tsx` | Explanation card, health banner, metrics (valid/invalid topics), refresh summary, dry-run toggle default, action feedback |
| `AutomationTopicList.tsx` | Validity badges (amber invalid cards), repair buttons: Select active publisher, Validate, Test dry-run |
| `AutomationQueueManager.tsx` | Contextual empty state, refresh summary panel, disabled publisher guard on dispatch |
| `automationErrorLabels.ts` | **NEW** — shared labels + queue empty messages |
| `datahubAutomationApi.ts` / `useDatahubAutomation.ts` | Types + `validateAutomationTopic` mutation |

**Design system compliance:**

- Dark slate cards (`bg-slate-950/70`, `border-white/5`)
- Semantic banners (emerald / amber / red)
- `MetricCard`, `StatusPill`, `BTN_PRIMARY`, `BTN_OUTLINE_*` from `dataHubUi`
- Typography: `text-sm` headers, `text-[11px]` body, `text-[10px]` hints

### 2.3 Tests & scripts

| Artifact | Result |
|----------|--------|
| `backend/__tests__/unit/datahubAutomationP3.test.js` | 5/5 PASS |
| `backend/__tests__/unit/datahubAutomationSafety.test.js` | 5/5 PASS |
| `src/__tests__/automationErrorLabels.test.ts` | 5/5 PASS |
| `backend/scripts/automation-p3-e2e-dry-run.mjs` | **PASS** (see §4) |
| `backend/scripts/automation-p3-browser-evidence.mjs` | API evidence + optional Playwright |

---

## 3. E2E Dry-Run Proof (Safe Fixture)

**Command:**

```bash
cd backend && node scripts/automation-p3-e2e-dry-run.mjs
```

**Result (2026-06-27T14:08:46Z):**

```
=== P3 Automation E2E dry-run ===
Active publisher: 887495e6-0b47-4450-88ef-35dd43477f9a
Created topic: 9f656879-f22f-4e9b-98a1-c566d7083062
Validation: valid []
Refresh summary: { candidates: 1, queued: 1, skipped: 0, blocked: 0, reasons: [] }
Dispatch processed: 1
Publisher history dry_run: true
PASS: E2E dry-run chain verified (no live Telegram send).
Cleanup complete.
```

**Chain verified:**

```
processed record → topic → ACL/filter/mapping → queue → dry-run dispatch → publisher dry_run history → cleanup
```

No live Telegram message sent (`telegram_message_id` null on dry_run history row).

---

## 4. Browser & Network Verification

**Path:** AI → Manager → Data Hub → Advanced Features → Automation Routing  
**URL:** `http://localhost:3000/?view=ai`

### 4.1 UI sections verified

| Section | Verified |
|---------|----------|
| Overview (explanation, health banner, metrics) | Yes — disabled publisher banner visible |
| Topic cards | Yes — invalid topics with amber styling + disabled publisher badge |
| Queue | Yes — contextual empty message + refresh summary after Refresh |
| Delivery history | Yes — human-readable `errorLabel` (not raw codes only) |
| Dry-run toggle default ON | Yes |
| Repair actions | Yes — Select active publisher, Validate, Test dry-run buttons present |

### 4.2 Network evidence

Saved: [`screenshots/automation-p3-network-evidence.json`](./screenshots/automation-p3-network-evidence.json)

**Overview (`GET /api/v1/data-hub/automation/overview`) — 131 ms:**

- `health.banner`: `disabled_publisher`
- `summary.validTopics`: 0, `invalidTopics`: 3
- Each topic includes `validity.status: disabled_publisher` with reasons

**Refresh (`POST /api/v1/data-hub/automation/queue/refresh`) — 6874 ms:**

```json
{
  "candidates": 0,
  "queued": 0,
  "skipped": 3,
  "blocked": 0,
  "reasons": [
    {
      "code": "PUBLISHER_DISABLED",
      "count": 3,
      "label": "The selected Telegram Publisher is disabled. Choose an active publisher or enable it in Telegram Publisher."
    }
  ]
}
```

**Executions:** all sampled rows include `errorLabel` and `retryAllowed: false` for `PUBLISHER_DISABLED`.

### 4.3 Screenshots

Captured via Cursor IDE browser session during verification:

- Overview + health banner (disabled publisher)
- Automation Routing controls (dry-run ON, Refresh, Add topic)
- Topic cards with invalid validity styling

*(PNG files stored in IDE browser capture; network JSON in repo for reproducible evidence.)*

### 4.4 Console

No React render errors observed during Automation Routing navigation. Write actions gated for non-admin users via `dataHubWriteGate` (expected RBAC).

---

## 5. Performance Before / After

| Operation | Before (P3 RCA baseline) | After (2026-06-27) | Notes |
|-----------|--------------------------|--------------------|-------|
| Overview API | ~200–500 ms (estimated) | **131 ms** | Adds validity computation; still fast |
| Queue refresh | ~7–9 s (slow `collected_data` scan) | **6874 ms** | Dominant cost: `loadAutomationCandidateRecords` LIMIT 75; not regressed |
| E2E dry-run script | N/A | **~62 s** | Includes DB fixture + full refresh scan |

**Future optimization (out of scope P3):** index/tune `collected_data` candidate query if refresh latency becomes operator pain.

---

## 6. Production State (Post-Fix)

| Item | State |
|------|-------|
| Topics | 3 enabled, **0 valid**, 3 `disabled_publisher` |
| Queue | 0 pending (correct — refresh skips disabled targets) |
| Active publisher | `887495e6-0b47-4450-88ef-35dd43477f9a` (تایتان تست) — needs topic repair + mappings |
| Scheduler | Manual-only (`enabled: false`) — by design |

**Repair steps for operator:**

1. Open Automation Routing → edit each topic → **Select active publisher** (or use repair button).
2. In Telegram Publisher → create **enabled source→publisher mapping** for routed sources.
3. Click **Validate** on topic → confirm `valid` + candidate count.
4. **Refresh** queue → confirm summary shows `queued > 0` when matches exist.
5. **Test dry-run** or dispatch with dry-run toggle ON.

---

## 7. Safety Constraints (Verified)

- Dry-run remains default in UI.
- Live publish requires `confirm_live=true` + browser confirm dialog.
- No Collector changes.
- E2E fixture fully cleaned up after run.
- `SOURCE_RECORD_NOT_FOUND` retry disabled in UI and API.

---

## 8. Test Commands

```bash
# Backend unit tests
cd backend && npm test -- --runInBand \
  __tests__/unit/datahubAutomationP3.test.js \
  __tests__/unit/datahubAutomationSafety.test.js

# Frontend unit tests
npm test -- --run src/__tests__/automationErrorLabels.test.ts

# E2E dry-run (safe, no live send)
cd backend && node scripts/automation-p3-e2e-dry-run.mjs

# API + performance evidence
cd backend && node scripts/automation-p3-browser-evidence.mjs

# Build
npm run build
```

---

## 9. Files in Scope (P3 Commit)

**Backend:** `automationTopicValidity.js`, `automationErrorLabels.js`, `datahubAutomationService.js`, `data-hub-automation.js`, P3 tests, E2E/evidence scripts  

**Frontend:** `AutomationTopics.tsx`, `AutomationTopicList.tsx`, `AutomationQueueManager.tsx`, `automationErrorLabels.ts`, `datahubAutomationApi.ts`, `useDatahubAutomation.ts`, `types.ts`, frontend test  

**Docs:** this file, RCA reference, network evidence JSON

---

## 11. Human QA i18n Repair

**Trigger:** Human QA found raw i18n keys visible in Automation Routing UI (violates Engineering Rules v2.1 — raw keys block REAL WORKING).

### Root cause

P3 added new `automation_*` keys in React components but did not add matching entries to locale JSON. `LanguageContext.t()` returns the key string when missing; because keys are truthy, `t('key') || 'fallback'` never reached English fallbacks.

### Missing keys added (25)

| Key | EN label |
|-----|----------|
| `automation_explanation` | Routes processed DataHub records to Telegram Publisher targets… |
| `automation_valid_topics` | Valid topics |
| `automation_invalid_topics` | Invalid topics |
| `automation_last_blocked` | Last blocked reason |
| `automation_valid` | Valid |
| `automation_disabled_publisher` | Disabled publisher |
| `automation_missing_mapping` | Missing mapping |
| `automation_no_candidates` | No candidates |
| `automation_select_active_publisher` | Select active publisher |
| `automation_validate` | Validate |
| `automation_test_dry_run` | Test dry-run |
| `automation_test_dry_run_success` | Dry-run test completed. |
| `automation_fix_topic_first` | Fix topic configuration before dry-run test |
| `automation_matching_candidates` | Matching records |
| `automation_candidates` | Candidates |
| `automation_queued` | Queued |
| `automation_no_pending_items` | No pending queue items to dispatch |
| `automation_publisher_disabled` | Publisher is disabled |
| `automation_dispatch_no_items` | Dispatch finished with no successful deliveries. |
| `automation_retry_disabled` | Retry is disabled for this history entry. |
| `automation_stale_history` | Historical record is no longer available. |
| `automation_queue_empty_no_match` | No processed records matched active routing rules. |
| `automation_queue_empty_disabled_publisher` | Queue is empty because routing topics target disabled publishers… |
| `automation_queue_empty_missing_mapping` | Queue is empty because source→publisher mapping is missing… |
| `automation_queue_empty_manual` | Automation scheduler is manual-only… |

### Files updated

| File | Change |
|------|--------|
| `deploy/blue/locales/en.json` | +25 automation keys |
| `deploy/blue/locales/fa.json` | +25 automation keys (Persian) |
| `deploy/green/locales/en.json` | +25 automation keys (synced with blue) |
| `deploy/green/locales/fa.json` | +25 automation keys (synced with blue) |
| `src/__tests__/automationRoutingI18n.test.ts` | **NEW** — scans components, asserts keys in en/fa blue/green |
| `src/__tests__/automationErrorLabels.test.ts` | Updated mocks for locale-aware assertions |
| `backend/scripts/automation-p3-i18n-screenshots.mjs` | Browser screenshot helper + raw-key guard |

### Tests

```bash
npm test -- --run src/__tests__/automationRoutingI18n.test.ts src/__tests__/automationErrorLabels.test.ts
# 12/12 PASS
npm run build
# PASS
```

### Browser verification (post-fix)

**Path:** DataHub → Advanced Features → Automation Routing

| Check | Result |
|-------|--------|
| No raw `automation_*` in body text | **PASS** (`rawKeys: []`) |
| Explanation card human-readable | **PASS** |
| Metrics: Valid topics / Invalid topics / Last blocked reason | **PASS** |
| Topic cards: Disabled publisher, Validate, Test dry-run, Select active publisher | **PASS** |
| History: human error labels + stale history suffix | **PASS** |
| Console errors | **None observed** |

Evidence: [`screenshots/automation-p3-i18n-browser-evidence.json`](./screenshots/automation-p3-i18n-browser-evidence.json)

Screenshots (Cursor IDE browser capture):

- `automation-p3-i18n-overview.png`
- `automation-p3-i18n-topic-cards.png`
- `automation-p3-i18n-queue-history.png`

---

## 12. Sign-Off

| Phase | Status |
|-------|--------|
| P3 Backend validity + summary + retry guard | **Done** |
| P4 Frontend redesign | **Done** |
| P6 Tests | **Done** (10 backend + 5 frontend) |
| P7 E2E dry-run + cleanup | **Done** |
| P8 Browser verification | **Done** |
| P11 SSOT | **Done** |
| Human QA i18n repair | **Done** |
| Production config repair | **Operator task** |

**Implementation verdict: REAL WORKING** (E2E + browser + i18n Human QA pass).  
Production routing from legacy topics remains blocked until operator completes repair UX flow described in §6.
