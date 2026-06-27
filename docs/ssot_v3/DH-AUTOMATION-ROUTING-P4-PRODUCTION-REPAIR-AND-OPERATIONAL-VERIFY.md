# DH-AUTOMATION-ROUTING-P4 — Production Repair and Operational Verify

Date: 2026-06-27  
Task: `DH-AUTOMATION-ROUTING-P4-PRODUCTION-REPAIR-AND-OPERATIONAL-VERIFY`  
Prior phase: [`DH-AUTOMATION-ROUTING-P3-END-TO-END-FIX-AND-REDESIGN.md`](./DH-AUTOMATION-ROUTING-P3-END-TO-END-FIX-AND-REDESIGN.md) (implementation REAL WORKING; production config **PENDING**)

Environment: **dev DB on server** (`ubuntu`, branch `feat/gap-008-sources-backend-wiring`, commit `0fd7d36` + uncommitted P4 changes)

---

## Final Verdict

### **Production Operational (Dry-run)** — 2026-06-27

| Criterion | Result |
|-----------|--------|
| Pre-repair audit documented | **PASS** |
| Production config repair (topics → active publisher + mappings) | **PASS** |
| All 3 active topics `valid` (0 `disabled_publisher`, 0 invalid) | **PASS** |
| Queue refresh from real processed data | **PASS** (9 pending) |
| Dry-run dispatch through active publisher + mapping | **PASS** |
| Publisher history `dry_run`, `telegram_message_id` null | **PASS** |
| No live Telegram send | **PASS** |
| Browser verify (post-repair) | **PASS** (MCP browser + API network) |
| Performance refresh ≤ 500ms target | **PASS** (138–146ms after optimization) |
| Migration 042 applied | **PASS** |
| DevOps (pm2 reload, health, nginx syntax) | **PASS** |
| Backend tests | **PASS** (12/12 automation-related) |

**Claim scope:** Real production topics (`سیگنال` + 2 demo topics) now route through canonical active publisher `887495e6-0b47-4450-88ef-35dd43477f9a` (`تایتان تست`) with enabled source→publisher mappings. Dry-run E2E verified on live dev DB — **not** live Telegram publish.

**Not claimed:** Live Telegram delivery to production channels (dry-run default retained; `confirm_live` required for live).

---

## 1. Before State (Pre-repair Audit)

Read-only audit before any mutation:

| Item | Before |
|------|--------|
| Active topics | 3 |
| `Demo Topic 1779636651973` | Target: disabled `Automation Demo Publisher` (`bc5ce007-…`) |
| `Demo Topic 1779636779020` | Target: disabled `Automation Demo Publisher` (`bc5ce007-…`) |
| `سیگنال` (production topic) | Target: active `تایتان تست` (`887495e6-…`) |
| Active publishers | `887495e6` (تایتان تست), `26cf7d4a` (سس) |
| Enabled mappings for `887495e6` | **0** |
| Legacy mappings on disabled `5ab9a6bc` | alphavantage DEMO TEST, BBCPersian |
| Queue pending | **0** (refresh skipped all — `PUBLISHER_DISABLED` / `PUBLISHER_MAPPING_REQUIRED`) |
| Refresh latency | **6874ms** (seq scan on `collected_data`) |

Evidence: `docs/ssot_v3/screenshots/automation-p4-repair-evidence.json` → `before`

### Safe Repair Plan (documented before apply)

1. Point all 3 active topics at canonical active publisher `887495e6-0b47-4450-88ef-35dd43477f9a`.
2. Copy enabled mappings from disabled legacy publisher `5ab9a6bc` to active publisher (UPSERT, no delete).
3. Ensure `JUST IN TIME` (`c787a64f-…`) mapping exists for `سیگنال` production source.
4. Do **not** delete history, topics, or disabled publishers.
5. Keep dry-run default; verify with dry-run dispatch only.

---

## 2. Repair Actions

Script: `backend/scripts/automation-p4-production-repair.mjs`  
Applied: 2026-06-27 (manual + script; history preserved)

| Action | Detail |
|--------|--------|
| Topic repoint | All 3 topics → `publish_targets.publisherIds: ["887495e6-0b47-4450-88ef-35dd43477f9a"]` |
| Mapping copy | `ed0fb136` (alphavantage DEMO TEST) → active publisher |
| Mapping copy | `d51d05a4` (BBCPersian) → active publisher |
| Mapping ensure | `c787a64f` (JUST IN TIME) → active publisher |
| Disabled publishers | **Retained** (`bc5ce007`, `5ab9a6bc`) — not deleted |
| History | **Retained** — no row deletes |

Post-repair DB (topics):

```
70b6affe… | Demo Topic 1779636651973 | active | publisherIds: [887495e6…]
7ffb5473… | Demo Topic 1779636779020 | active | publisherIds: [887495e6…]
bc6c5f1b… | سیگنال                   | active | publisherIds: [887495e6…]
```

---

## 3. Topic Validation (Post-repair)

| Topic | Validity | Matching candidates | Can enqueue |
|-------|----------|---------------------|-------------|
| Demo Topic 1779636651973 | `valid` | 75 | yes |
| Demo Topic 1779636779020 | `valid` | 75 | yes |
| سیگنال | `valid` | 75 | yes |

**Invalid / disabled_publisher topics remaining:** 0

Per-record skips for unmapped sources (e.g. Meltgold channel) are **expected** at dispatch time (`PUBLISHER_MAPPING_REQUIRED`) — not topic-level invalidity.

---

## 4. Production Dry-run Flow

### 4.1 Queue refresh

```
POST /api/v1/data-hub/automation/queue/refresh → 200
summary: candidates=172, queued=8, skipped=164 (initial repair run)
queue pending after refresh: 9
duration: 106–146ms (post-optimization)
```

### 4.2 Dry-run dispatch

```
POST /api/v1/data-hub/automation/queue/dispatch { dryRun: true, limit: 1 }
→ processed: 1
→ status: dry_run
→ telegram_message_id: null
→ execution: 09299d21-0fc7-4a4e-af70-917391a12275
→ publisher_history_id: a0bb51b5-dce4-4584-b1a6-a896db2ec78a
→ errorLabel: "Automation event recorded"
```

### 4.3 DB evidence — no live send

```sql
SELECT id, status, telegram_message_id, created_at
FROM publisher_delivery_history
WHERE publisher_id = '887495e6-0b47-4450-88ef-35dd43477f9a'
ORDER BY created_at DESC LIMIT 5;
```

| status | telegram_message_id |
|--------|---------------------|
| dry_run | NULL |
| dry_run | NULL |
| dry_run | NULL |
| dry_run | NULL |
| dry_run | NULL |

Evidence file: `docs/ssot_v3/screenshots/automation-p4-repair-evidence.json`

---

## 5. Browser Verification (Post-repair)

Path: **AI → Manager → Data Hub → Advanced Features → Automation Routing**

### UI checks (Cursor IDE browser, user `p4verify2@test.local`)

| Check | Result |
|-------|--------|
| Valid topics | **3** |
| Invalid topics | **0** |
| Queue size | **9** |
| Health banner | **Ready to dispatch** |
| Dry-run toggle | **On** (default) |
| Delivery history visible | **Yes** — includes "Automation event recorded" |
| Raw `automation_*` i18n keys | **None** (`rawKeys: []`) |
| Not Found | **No** |
| Console errors | **None observed** |

API network (authenticated admin JWT):

| Endpoint | Status | ms |
|----------|--------|-----|
| GET `/automation/overview` | 200 | 86–364 |
| GET `/automation/topics` | 200 | 20–56 |
| GET `/automation/queue` | 200 | 14–35 |
| GET `/automation/executions?limit=20` | 200 | 18–38 |
| POST `/automation/queue/refresh` | 200 | 135–146 |

Evidence: `docs/ssot_v3/screenshots/automation-p4-browser-evidence.json`

Note: Headless Playwright nav failed on `Manager` button timeout (no persisted screenshot files); interactive MCP browser session confirms UI state above.

---

## 6. Performance Before / After

| Endpoint | Before (ms) | After (ms) | Target |
|----------|-------------|------------|--------|
| `/automation/overview` | 6874 | 127–364 | < 500 page load |
| `/automation/queue/refresh` | **6874** | **135–146** | < 500 operator action |
| `/automation/topics` | — | 20–56 | — |
| `/automation/queue` | — | 14–35 | — |
| `/automation/executions` | — | 18–38 | — |

### Bottleneck and fix

**Root cause:** Sequential scan ~1.5s on `collected_data` + N+1 queries for queue/mapping checks per candidate.

**Fixes (P4):**

| Change | File |
|--------|------|
| Partial index `idx_collected_data_automation_candidates` | `backend/database/migrations/042_collected_data_automation_refresh_index.sql` |
| Batch preload `pendingQueueKeys` + `enabledMappingKeys` | `backend/services/datahubAutomationService.js` |
| Candidate time filter via index-friendly predicate | same |

Refresh is now an acceptable **operator action** (~140ms), not a page-load blocker.

Evidence: `docs/ssot_v3/screenshots/automation-p4-performance.json`  
Measure script: `backend/scripts/automation-p4-performance.mjs`

---

## 7. DevOps

| Check | Result |
|-------|--------|
| Migration 042 applied | **Yes** — latest in `pgmigrations` |
| `pm2 reload titan-backend` | **Done** (prior step) |
| `pm2 reload titan-frontend` | **Done** 2026-06-27 |
| `GET /api/v1/health` | **200** |
| Frontend `:3000` | **200** |
| `nginx -t` | **syntax ok** |
| Backend logs | Clean — no automation errors during verify |

---

## 8. Tests

```
backend/__tests__/unit/datahubAutomationP3.test.js       — PASS
backend/__tests__/unit/datahubAutomationFilterRules.test.js — PASS
backend/__tests__/unit/datahubAutomationAccessGateway.test.js — PASS
src/__tests__/automationRoutingI18n.test.ts                — PASS (prior P3 i18n)
Total automation-related: 12/12 PASS
```

---

## 9. Artifacts

| Artifact | Path |
|----------|------|
| Repair evidence | `docs/ssot_v3/screenshots/automation-p4-repair-evidence.json` |
| Performance | `docs/ssot_v3/screenshots/automation-p4-performance.json` |
| Browser/API evidence | `docs/ssot_v3/screenshots/automation-p4-browser-evidence.json` |
| Repair script | `backend/scripts/automation-p4-production-repair.mjs` |
| Performance script | `backend/scripts/automation-p4-performance.mjs` |
| Browser evidence script | `backend/scripts/automation-p4-browser-evidence.mjs` |
| Index migration | `backend/database/migrations/042_collected_data_automation_refresh_index.sql` |

---

## 10. Operator Notes

1. **Demo topics** remain active with broad filters — they can enqueue demo signal traffic alongside `سیگنال`. Disable demo topics in production if not wanted (repair moved them, did not delete).
2. **Historical delivery entries** showing `PUBLISHER_MAPPING_REQUIRED` are pre-repair skips — expected in history, not current topic validity.
3. **Additional source mappings** may be needed for channels like Meltgold if those sources should route; current mappings cover alphavantage DEMO TEST, BBCPersian, and JUST IN TIME.
4. **Live publish** requires explicit operator action: dry-run off + `confirm_live` + valid bot token — out of scope for this verify.

---

## 11. Sign-off Checklist

- [x] Pre-repair audit read-only
- [x] Safe repair applied without history delete
- [x] 3/3 topics valid
- [x] Real topic dry-run through active publisher + mapping
- [x] No live Telegram send
- [x] Browser + network 200
- [x] Refresh < 500ms
- [x] DevOps + migration
- [x] SSOT P4 complete

**Verdict: Production Operational (Dry-run)** — ready for operator dry-run dispatch on real topics; live publish remains gated.
