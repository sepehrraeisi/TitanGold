# DH-SMARTPRIORITY-P2 — Apply Fix & Telegram Metrics

**Date:** 2026-06-17  
**Verdict:** **PASS** — Real + Apply Working + Telegram-Aware

---

## Summary

Fixed Smart Prioritization apply failure (integer `priority` vs tier string mismatch), wired configurable tier thresholds, integrated Telegram scoring from `collected_data` + collector status, and improved Configure/Apply UX + i18n.

---

## Part A — Apply schema fix

### Problem

`data_sources.priority` is legacy **INTEGER** (scheduler weight, default 5). Migration 031 attempted `ADD COLUMN priority VARCHAR` but column already existed as integer. Apply wrote `'critical'` → PostgreSQL `22P02`.

### Fix

**Migration 039** (`backend/database/migrations/039_datahub_priority_tier.sql`):

```sql
ALTER TABLE data_sources
    ADD COLUMN IF NOT EXISTS priority_tier VARCHAR(20)
        CHECK (priority_tier IS NULL OR priority_tier IN ('low','medium','high','critical'));
```

Apply now writes:

| Column | Written | Notes |
|--------|---------|-------|
| `priority_score` | final numeric score | 0–100 |
| `priority_tier` | tier string | low/medium/high/critical |
| `priority` (integer) | **NOT touched** | legacy scheduler weight preserved |

**Frontend:** `dataSourcesApi.ts` reads `priority_tier ?? priority` for UI tier display.

---

## Part B — Tier thresholds

`settings.tier_thresholds` from `datahub_prioritization_settings` is now used.

### Semantics (`prioritizationScoring.js`)

| Tier | Condition |
|------|-----------|
| **critical** | `score >= tier_thresholds.critical` (default **75**) |
| **high** | `score >= tier_thresholds.high` (default **50**) |
| **medium** | `score >= tier_thresholds.low` (default **25**) |
| **low** | below medium minimum |

Note: key `low` in JSON is the **minimum score for medium tier** (legacy naming).

Defaults: `{ low: 25, high: 50, critical: 75 }`.

---

## Part C — Telegram metrics

For `type = telegram`, scoring uses `collected_data` + `telegramCollectorSourceStatus` (read-only).

| Factor | Telegram source |
|--------|-----------------|
| **freshness** | Latest `COALESCE(processed_at, collected_at)` — ≤15m→100, ≤60m→80, ≤6h→50, ≤24h→25, else 0 |
| **success_rate** | `processed / (processed + error)` in 24h; pending excluded |
| **reliability** | Collector operational status + success rate + activity |
| **error_health** | `1/(1+errors/5)` from 24h rows — **no fetch_count gate** |
| **usage** | `processed_24h / 200` soft cap |

Files: `backend/utils/prioritizationTelegramMetrics.js`, `backend/utils/prioritizationScoring.js`.

---

## Part D — Score distribution (production DB)

### Before P2 preview

| calculated_score | count |
|-----------------|------:|
| 18.50 | **44** |
| other | 5 |

### After P2 preview + apply

| Metric | Value |
|--------|-------|
| Distinct scores | **35** |
| Telegram at exactly 18.5 | **2** (was 44) |
| Telegram score range | 18.5 – 93.5 |
| Telegram distinct scores | **31** |

**Tier histogram (apply run `d93ef8b3`):**

```json
{ "low": 10, "medium": 1, "high": 19, "critical": 19 }
```

### Top 5

| source | score | tier |
|--------|------:|------|
| قیمت لحظه ای دلار سکه | 93.5 | critical |
| نوسانات پله آهنی | 93.5 | critical |
| یورو نقدی تهران | 93.5 | critical |
| قیمت دهی انس | 93.5 | critical |
| هرات دلار آبی | 93.5 | critical |

### Bottom 5

| source | score | tg_status |
|--------|------:|-----------|
| Test Crypto Signals | 18.5 | error |
| جمع آوری داده | 18.5 | error |
| مظنـہ بازار | 23.5 | pending |
| صداقت نرخ دلار | 26.5 | active |
| NerkhLand | 26.5 | active |

---

## Part E — i18n & UX

| Key | EN | FA |
|-----|----|----|
| `configure_factors` | Configure Prioritization Factors | تنظیم ضرایب اولویت‌بندی |
| `prioritization_total_weight_valid` | Total weight is valid (100%). | مجموع وزن‌ها معتبر است (100٪). |
| `prioritization_total_weight_invalid` | Total weight must equal 100%. | مجموع وزن‌ها باید دقیقاً 100٪ باشد. |

Configure modal: green when total=100, amber warning otherwise; Save disabled unless total=100.

---

## Part F — Apply confirmation

Message: *"This will update priority_score and priority_tier for {count} active sources. Source activation and collected data will not be modified."*

---

## Part G — Tests

```
NODE_OPTIONS=--experimental-vm-modules npx jest __tests__/unit/datahubPrioritization.test.js
→ 14/14 passed
```

Covers: tier thresholds, telegram scoring, apply writes priority_tier not integer priority, i18n keys.

---

## Part H — Verification

| Check | Result |
|-------|--------|
| Preview | ✓ run `65bb4fca` success |
| Apply | ✓ run `d93ef8b3` status **success**, 49 applied |
| `priority_tier` populated | ✓ critical=19, high=19, medium=1, low=10 |
| `priority_score` populated | ✓ |
| `priority` integer | ✓ all remain **5** |
| `last_applied_at` | ✓ 49 rows |
| Data Sources API | ✓ 200 |
| Data Pipeline API | ✓ 200 |
| No scheduler/collector changes | ✓ read-only telegram metrics |

---

## API examples

**Preview:**
```http
POST /api/v1/data-hub/prioritization/preview
Authorization: Bearer <token>
```

**Apply:**
```http
POST /api/v1/data-hub/prioritization/apply
Content-Type: application/json
{"confirm_apply": true}
```

**Response (apply):**
```json
{
  "run": { "id": "d93ef8b3-ad66-41ab-b8c0-67f9dc6503e5" },
  "summary": { "low": 10, "medium": 1, "high": 19, "critical": 19 },
  "applied": 49
}
```

---

## DB verification queries

```sql
-- Tier distribution after apply
SELECT priority_tier, COUNT(*), ROUND(AVG(priority_score::numeric),1)
FROM data_sources WHERE is_active GROUP BY 1;

-- Legacy integer untouched
SELECT priority, COUNT(*) FROM data_sources WHERE is_active GROUP BY 1;

-- Apply run success
SELECT id, run_type, status, summary, error_summary
FROM datahub_prioritization_runs ORDER BY created_at DESC LIMIT 1;

-- Telegram spread
SELECT COUNT(DISTINCT calculated_score) FROM datahub_source_priorities sp
JOIN data_sources ds ON ds.id = sp.source_id WHERE ds.type = 'telegram';
```

---

## Files changed

| File | Change |
|------|--------|
| `backend/database/migrations/039_datahub_priority_tier.sql` | New column |
| `backend/utils/prioritizationScoring.js` | Scoring + tier thresholds |
| `backend/utils/prioritizationTelegramMetrics.js` | Telegram batch metrics |
| `backend/services/datahubPrioritizationService.js` | Apply fix, telegram integration |
| `backend/__tests__/unit/datahubPrioritization.test.js` | 14 tests |
| `components/.../SmartPrioritization.tsx` | i18n, weight UX, apply confirm |
| `deploy/blue/locales/en.json`, `fa.json` | Translations |
| `services/dataSourcesApi.ts` | Read priority_tier |

---

## Build

`npm run build` — ✓ (~22s)

---

## Rollback

```bash
# Revert code
git revert <commit>

# Column is additive — optional cleanup:
# UPDATE data_sources SET priority_tier = NULL, priority_score = 0 WHERE priority_updated_at IS NOT NULL;
# Do NOT drop priority_tier without coordination.
```

Legacy integer `priority` values are never modified by this feature.
