# DH-AUTODISCOVERY-P2 — Deploy Verification Report

**Date:** 2026-06-14 (final pass)  
**Commit verified:** `bb5ef19050213f45f134e0442a4d53971013171b`  
**Verdict:** **PASS**

---

## Executive summary

P2 Auto Discovery fixes are verified in production-like runtime (pm2 `titan-backend` on port 5002, `titan-frontend` on 3000). Telegram hostname-only false duplicates are resolved; scan detail API, approval guards, safe approve path, i18n, and History UI all work. No new code changes required.

---

## 1. Migration 038

**Status:** Already applied.

```sql
CHECK (status IN ('pending','approved','rejected','duplicate','ignored'))
```

---

## 2. Runtime reload

```bash
pm2 reload titan-backend --update-env
pm2 reload titan-frontend --update-env
```

Both processes online after reload.

---

## 3. Build & tests

| Check | Result |
|-------|--------|
| `npm run build` | ✓ Success (~20s) |
| `NODE_OPTIONS=--experimental-vm-modules npx jest __tests__/unit/datahubDiscovery.test.js` | ✓ **12/12** passed |

---

## 4. i18n verification

| Key | Before (P1) | After (browser) |
|-----|-------------|-----------------|
| `pending_approval` | Raw key `pending_approval` | **"Pending approval"** |
| History hint | `GET /api/v1/data-hub/discovery/history` | **"Past discovery scans and their results."** |

Browser snapshot confirmed translated labels on Auto Discovery panel.

---

## 5. Scan verification

### Latest scan (this session — UI "Scan for sources")

| Field | Value |
|-------|-------|
| **Scan ID** | `795b5506-f535-4294-9c33-fc27d51735b5` |
| **Started** | 2026-06-14T09:20:41.297Z |
| **Duration** | ~42ms |
| **candidates_scanned** | 0 |
| **new_suggestions** | 0 |
| **duplicates** | 0 |
| **blocked** | 0 |

**Expected:** All Telegram built-in candidates are now linked (Test Crypto Signals approved as source). Zero-candidate scan is correct post-approval.

### P2 dedupe proof scan (reference)

| Field | Value |
|-------|-------|
| **Scan ID** | `8d3f85f2-0d61-49d4-8ce3-1b6cf25ea69c` |
| **Started** | 2026-06-14T08:24:09.953Z |
| **candidates_scanned** | **1** |
| **new_suggestions** | **1** |
| **duplicates** | **0** |
| **blocked** | **0** |

```json
{
  "new_suggestions": [{
    "id": "17a3e6f4-ca56-46c9-b466-ac2d7d7f2193",
    "suggested_name": "Test Crypto Signals",
    "suggested_url": "https://t.me/@crypto_signals_test",
    "suggested_type": "telegram",
    "discovery_source": "telegram",
    "priority_score": 48.3
  }],
  "duplicate_details": []
}
```

**P2 fix confirmed:** Test Crypto Signals is **NOT** duplicate of Rokna (`https://t.me/Rokna_news`). Previously hostname-only `t.me` match (confidence 82) blocked all Telegram channels.

---

## 6. Scan detail API

**GET** `/api/v1/data-hub/discovery/scans/8d3f85f2-0d61-49d4-8ce3-1b6cf25ea69c`

- `candidates_scanned`: 1
- `duplicate_details`: []
- `new_suggestions`: 1 (Test Crypto Signals, `https://t.me/@crypto_signals_test`)
- `blocked`: 0
- Linked suggestion status: **approved** (post safe-approval test)

**GET** `/api/v1/data-hub/discovery/scans/795b5506-f535-4294-9c33-fc27d51735b5`

- All counts 0; empty `duplicate_details`, `new_suggestions`, `blocked`.

---

## 7. Suggestions tab

**Current state:** No pending suggestions (Test Crypto Signals already approved).

| Field | Value |
|-------|-------|
| UI | "No pending suggestions" + built-in candidates hint |
| Retrospective evidence (scan `8d3f85f2`) | Suggestion `17a3e6f4` created as **pending**, type **telegram**, priority **48.3**, not duplicate of Rokna |
| Approve/Reject/Ignore | Component wiring verified in P2 implementation; N/A live (0 pending) |

**Check #7:** **N/A (post-approval)** — satisfied by scan `8d3f85f2` + prior approval flow.

---

## 8. History tab

| Check | Result |
|-------|--------|
| Hint text | User-facing copy (no API path) ✓ |
| Table renders | ✓ 17+ rows with timestamps, counts, status |
| Latest scan visible | ✓ `795b5506` at top |
| View details | ✓ Opens scan detail panel; P2 scan row shows 1 candidate / 1 suggestion |

---

## 9. Approval safety

### Duplicate RSS → 409 DUPLICATE_ACTIVE_URL

```json
{
  "error": "This source URL already exists.",
  "code": "DUPLICATE_ACTIVE_URL",
  "normalizedUrl": "https://eghtesaad24.ir/fa/rss/12"
}
```

No `data_sources` row created.

### Duplicate Telegram → 409 DUPLICATE_ACTIVE_TELEGRAM

```json
{
  "error": "This Telegram channel already exists as a source.",
  "code": "DUPLICATE_ACTIVE_TELEGRAM",
  "telegramIdentity": "rokna_news"
}
```

No source created. Temp test rows cleaned to `rejected`.

---

## 10. Safe approval path

| Field | Value |
|-------|-------|
| **Suggestion ID** | `17a3e6f4-ca56-46c9-b466-ac2d7d7f2193` |
| **Created source ID** | `dc21a959-a7d7-434d-b0f9-717e7d0020c0` |
| **Source name** | Test Crypto Signals |
| **Source URL** | `https://t.me/@crypto_signals_test` |
| **Suggestion status** | `approved` with `created_source_id` set |

**Audit log** (`data_hub_logs`):

```json
{
  "action": "discovery_suggestion_approved",
  "status": "success",
  "message": "Data source created from discovery suggestion approval",
  "metadata": {
    "suggestion_id": "17a3e6f4-ca56-46c9-b466-ac2d7d7f2193",
    "suggested_url": "https://t.me/@crypto_signals_test",
    "suggested_type": "telegram"
  }
}
```

---

## 11. Regression checks

| Area | Result |
|------|--------|
| GET `/api/v1/data-sources?limit=1` | ✓ 200 |
| GET `/api/v1/data-sources/duplicate-urls` | ✓ 200 (3 groups) |
| GET `/api/v1/data-hub/crawlers?limit=3` | ✓ 200 |
| GET `/api/v1/data-sources/pipeline` | ✓ 200 |
| Data Sources / Pipeline / Crawlers UI | ✓ Loads (55 sources, healthy) |
| Scheduler / normalization | ✓ No changes in this deploy |

---

## Before / after counts

| Status | Before verify session | After full verification |
|--------|----------------------|-------------------------|
| pending | 0 | 0 |
| approved | 0 → 1 (during P2 test) | **1** |
| rejected | 0 → 4 | **6** (incl. dup-guard test cleanup) |
| duplicate | 215 | **215** (preserved per policy) |
| ignored | 0 | 0 |

---

## Screenshots

Captured during browser verification on `localhost:3000`:

| File | Content |
|------|---------|
| `docs/ssot_v3/screenshots/autodiscovery-suggestions-panel.png` | Suggestions tab — "Pending approval" i18n, scan complete banner |
| `docs/ssot_v3/screenshots/autodiscovery-history-scan-detail.png` | History tab — scan complete + detail panel |
| `docs/ssot_v3/screenshots/autodiscovery-p2-scan-detail.png` | History table + P2 scan row (1 candidate, 1 suggestion) |

---

## IDs reference

| Artifact | ID |
|----------|-----|
| Latest scan | `795b5506-f535-4294-9c33-fc27d51735b5` |
| P2 proof scan | `8d3f85f2-0d61-49d4-8ce3-1b6cf25ea69c` |
| Test Crypto Signals suggestion | `17a3e6f4-ca56-46c9-b466-ac2d7d7f2193` |
| Created source | `dc21a959-a7d7-434d-b0f9-717e7d0020c0` |
| Commit | `bb5ef19050213f45f134e0442a4d53971013171b` |

---

## Verdict

### **PASS**

- P2 dedupe fix works in production runtime (no hostname-only Telegram false duplicate).
- Scan metrics, detail API, approval guards (409 RSS/Telegram), and safe approve path verified.
- i18n and History UX fixes confirmed in UI.
- Build + 12 unit tests pass; regression APIs healthy.
- **No new commit required.**

---

## Rollback (if needed)

```bash
git revert bb5ef19
pm2 reload titan-backend titan-frontend --update-env
```

Approved source `dc21a959-a7d7-434d-b0f9-717e7d0020c0` would remain unless manually deactivated.
