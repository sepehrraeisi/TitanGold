# DH-SMARTPRIORITY-P2 — Post-Verify & Tuning Audit

**Date:** 2026-06-17  
**Mode:** Read-only (no code changes)  
**P2 commit:** `a9fbe7e0108c355a401c39b7a971d694ccc31418`  
**Verdict:** **PASS WITH BACKLOG** (B — Accepted with tuning backlog)

---

## Executive summary

P2 fixes are **confirmed working**: Apply succeeds, `priority_tier` populated, legacy integer `priority` untouched. Score distribution improved dramatically (44 sources at 18.5 → 2). The **93.5 cluster is legitimate**, not a bug — it is the mathematical ceiling when five Telegram factors saturate at 100 while `category_importance=70` and `source_type=80` remain constant. Tuning backlog recommended for P3 (category model, usage cap, score explanation UX).

**No code change required in this audit.**

---

## PART A — Current Smart Priority status

### Latest preview run

| Field | Value |
|-------|-------|
| **id** | `ad14969f-6ecc-4cb6-803f-8d84b6120719` |
| **status** | success |
| **created_at** | 2026-06-17T12:55:02Z |
| **summary** | `{"low":10,"high":19,"medium":0,"critical":20}` |
| **error_summary** | null |

### Latest apply run

| Field | Value |
|-------|-------|
| **id** | `d93ef8b3-ad66-41ab-b8c0-67f9dc6503e5` |
| **status** | **success** |
| **applied** | 49 |
| **summary** | `{"low":10,"high":19,"medium":1,"critical":19}` |
| **error_summary** | null |

### Failed apply runs after P2

```sql
SELECT COUNT(*) FROM datahub_prioritization_runs
WHERE run_type='apply' AND status='failed' AND created_at > '2026-06-17';
-- → 0
```

Pre-P2 failures (2026-06-03): 4 runs with `22P02 invalid input syntax for type integer: "critical"`.

### Column state (49 active sources)

| Check | Result |
|-------|--------|
| `priority` integer | All **5** (unchanged) |
| `priority_tier` populated | **49/49** |
| `priority_score` > 0 | **49/49** |
| `last_applied_at` set | **49/49** |
| `priority_updated_at` | 2026-06-17T12:45:40 (apply time) |

```sql
SELECT priority, COUNT(*) FROM data_sources WHERE is_active GROUP BY priority;
-- priority=5 → 49

SELECT priority_tier, COUNT(*) FROM data_sources WHERE is_active GROUP BY priority_tier;
-- critical=19, high=19, medium=1, low=10
```

---

## PART B — Top 20 score breakdown audit

### Why exactly 93.5?

**Formula** (weights from DB):

```
score = (
  reliability×20 + success_rate×10 + freshness×20 + error_health×15
  + category_importance×15 + source_type×10 + usage×10
) / 100
```

When a Telegram source hits **ceiling on 5 factors**:

| Factor | Value | Weighted |
|--------|------:|---------:|
| reliability | 100 | 20.0 |
| success_rate | 100 | 10.0 |
| freshness | 100 | 20.0 |
| error_health | 100 | 15.0 |
| usage | 100 | 10.0 |
| category_importance | **70** | 10.5 |
| source_type | **80** | 8.0 |
| **Total** | | **93.5** |

**Maximum possible Telegram score = 93.5** (not 100) because `source_type=80` and `category_importance=70` are fixed for all `signals` category sources.

### Which factor prevents 100?

Both **source_type** (80, not 100) and **category_importance** (70, not 100). Even with perfect operational metrics, Telegram signals sources cannot exceed **93.5**.

### Identical breakdown cluster

**6 sources at exactly 93.5** share identical subscores:

| source | proc_24h | latest_at | op_status |
|--------|----------|-----------|-----------|
| قیمت لحظه ای دلار سکه | 2,374 | ~3 min ago | active |
| نوسانات پله آهنی | 4,997 | ~3 min ago | active |
| یورو نقدی تهران | 1,836 | ~4 min ago | active |
| قیمت دهی انس | 105,472 | ~3 min ago | active |
| هرات دلار آبی | 7,519 | ~5 min ago | active |
| آکادمی Mr.GOLD | 250 | ~6 min ago | active |

All: `freshness=100, reliability=100, success_rate=100, error_health=100, usage=100`.

**Assessment:** Legitimate saturation — these are genuinely high-volume, fresh, active collector channels with near-zero 24h errors. Clustering is **acceptable** but limits ranking differentiation among top performers.

### Top 20 summary table

| # | source | score | tier | freshness | reliability | success_rate | error_health | usage | cat | type |
|---|--------|------:|------|----------:|------------:|-------------:|-------------:|------:|----:|-----:|
| 1 | هرات دلار آبی | 93.5 | critical | 100 | 100 | 100 | 100 | 100 | 70 | 80 |
| 2 | نوسانات پله آهنی | 93.5 | critical | 100 | 100 | 100 | 100 | 100 | 70 | 80 |
| 3 | یورو نقدی تهران | 93.5 | critical | 100 | 100 | 100 | 100 | 100 | 70 | 80 |
| 4 | قیمت لحظه ای دلار سکه | 93.5 | critical | 100 | 100 | 100 | 100 | 100 | 70 | 80 |
| 5 | قیمت دهی انس | 93.5 | critical | 100 | 100 | 100 | 100 | 100 | 70 | 80 |
| 6 | آکادمی Mr.GOLD | 93.5 | critical | 100 | 100 | 100 | 100 | 100 | 70 | 80 |
| 7 | آن تايم انس | 91.0 | critical | 100 | 100 | 100 | 83.3 | 100 | 70 | 80 |
| 8 | دلار سلیمانیه | 91.0 | critical | 100 | 100 | 100 | 83.3 | 100 | 70 | 80 |
| 9 | تحلیل دلار پیشبینی | 90.4 | critical | 100 | 100 | 100 | 100 | 69 | 70 | 80 |
| 10 | IndyPersian | 87.7 | critical | 100 | 99.6 | 99.6 | 62.5 | 100 | 70 | 80 |
| 11–20 | (various) | 80.4–86.7 | critical/high | 80–100 | 95–100 | 95–100 | 20–56 | 39–100 | 70 | 80 |

---

## PART C — Score distribution

### All active sources (n=49)

| Metric | Value |
|--------|------:|
| Distinct scores | **33** |
| Min | 18.5 |
| P25 | 66.3 |
| Median | 76.7 |
| P75 | 85.9 |
| Max | 93.5 |

### Telegram only (n=45)

| Metric | Value |
|--------|------:|
| Distinct scores | **30** |
| Min | 18.5 |
| P25 | 67.1 |
| Median | 78.3 |
| P75 | 86.7 |
| Max | 93.5 |

### RSS/API only

| type | distinct | min | median | max |
|------|----------|----:|-------:|----:|
| api | 1 | 66.3 | 66.3 | 66.3 |
| rss | 3 | 65.7 | 66.3 | 66.9 |

RSS/API scores cluster ~66 due to fetch-path metrics (no telegram collected_data path).

### Tier counts (latest preview)

| Tier | Count |
|------|------:|
| critical | 20 |
| high | 19 |
| low | 10 |
| medium | 0 |

### Exact duplicate scores

| Score | Count |
|------:|------:|
| 26.50 | 7 |
| **93.50** | **6** |
| 91.00 | 2 |
| 86.70 | 2 |
| 68.60 | 2 |
| 66.30 | 2 |
| 18.50 | 2 |

**Before P2:** 44 sources at 18.5. **After P2:** 2 at 18.5, meaningful spread across 33 distinct values.

---

## PART D — Factor saturation audit

### All active sources (bucket counts)

| Factor | =0 | 1–24 | 25–49 | 50–74 | 75–99 | =100 |
|--------|---:|-----:|------:|------:|------:|-----:|
| usage | 14 | 6 | 5 | 1 | 1 | **18** |
| freshness | 10 | 1 | 5 | 4 | 6 | **23** |
| reliability | 2 | 0 | 8 | 0 | 15 | **16** |
| source_type | 0 | 0 | 0 | 0 | 48 | 1 |
| error_health | 10 | 6 | 5 | 4 | 6 | **16** |
| success_rate | 10 | 0 | 0 | 0 | 15 | **16** |
| category_importance | 0 | 0 | 0 | **49** | 0 | 0 |

### Telegram-only at ceiling (=100)

| Factor | Count at 100 | / 45 |
|--------|-------------:|-----:|
| freshness | 23 | 51% |
| usage | 18 | 40% |
| reliability | 15 | 33% |
| success_rate | 15 | 33% |
| error_health | 15 | 33% |

**Yes — freshness and usage saturate most easily** for active Telegram channels:
- Freshness: any data within 15 minutes → 100 (23/45 channels)
- Usage: `processed_24h / 200` caps at 100 → **18 channels** exceed 200 processed/day

**source_type** is constant 80 for all 45 Telegram sources (by design).

**category_importance** is constant 70 for 45 `signals` + 2 `news` sources (placeholder).

---

## PART E — Telegram metric correctness

### Top 10 — genuinely active?

| source | op_status | proc_24h | err_24h | latest_at | score |
|--------|-----------|----------|---------|-----------|------:|
| دلار سکه | active | 2,374 | 0 | 3 min ago | 93.5 |
| Mr.GOLD | active | 250 | 0 | 6 min ago | 93.5 |
| یورو نقدی | active | 1,836 | 0 | 4 min ago | 93.5 |
| هرات دلار | active | 7,519 | 0 | 5 min ago | 93.5 |
| پله آهنی | active | 4,997 | 0 | 3 min ago | 93.5 |
| قیمت دهی انس | active | 105,472 | 0 | 3 min ago | 93.5 |

**Yes** — top sources are active collectors with high processed volume and fresh data. Scores align with reality.

### Bottom 10 — genuinely dead/stale?

| source | op_status | proc_24h | latest_at | score | Assessment |
|--------|-----------|----------|-----------|------:|------------|
| جمع آوری داده | **error** | 0 | Feb 19 | 18.5 | Correct — dead |
| Test Crypto Signals | **error** | 0 | null | 18.5 | Correct — no data |
| مظنـہ بازار | **pending** | 0 | Feb 17 | 23.5 | Correct — pending |
| ایران زمین (×7 similar) | active | **0** | 3–10 days ago | 26.5 | Correct — stale |

**Active but stale** sources score 26.5 (reliability=40 from `active` path with zero 24h processed, freshness=0). **Not over-scored.**

### Pending ingestion

مظنـہ بازار (`pending`): score 23.5, reliability=25 — **not over-scored**.

### Error sources

Test Crypto Signals, جمع آوری داده (`error`): score 18.5 — **correctly lowest** (static factors only: cat=70, type=80 → 18.5).

### Collector status alignment

| op_status | score range | Count |
|-----------|-------------|------:|
| active + high volume | 80–93.5 | ~25 |
| active + stale (0 proc 24h) | 26.5 | 7 |
| pending | 23.5 | 1 |
| error | 18.5 | 2 |

**Collector operational status aligns with scores.**

---

## PART F — Category importance placeholder

**Still true after P2:**

| category | score | count |
|----------|------:|------:|
| signals | **70** | 45 |
| news | **70** | 2 |
| uncategorized | **50** | 2 |

**Classification:** Placeholder (hardcoded in `prioritizationScoring.js`).

### Recommended P3 model (document only)

| Category | Proposed score |
|----------|---------------:|
| price/gold/dollar/signals | 100 |
| economy | 90 |
| crypto | 80 |
| politics/geopolitical | 70 |
| general news | 50 |
| uncategorized | 30–50 |

---

## PART G — Usage signal audit

### What usage means after P2

| Source type | Usage signal |
|-------------|-------------|
| **Telegram** | `processed_24h / 200` soft cap from `collected_data` |
| **RSS/API/Web** | `data_hub_logs` count in 24h / 200 soft cap |

**Not based on:** AI agent consumption, user access, dashboard views.

`data_hub_logs` has **0 rows** in last 24h — non-Telegram usage is effectively 0 for all sources.

### Saturation analysis

- Soft cap = **200** processed rows/day
- **18/45** Telegram sources exceed 200 → usage=100
- قیمت دهی انس: 105,472 processed/24h → usage still 100 (capped)

### P3 recommendation

Raise Telegram usage cap (e.g. 2000 or log-scale) to differentiate high-volume channels. Current cap causes top 18 channels to tie on usage=100.

**Not a bug** — working as designed.

---

## PART H — Tier threshold audit

### DB settings

```json
{
  "tier_thresholds": { "low": 40, "high": 60, "critical": 80 },
  "factor_weights": { "usage": 10, "freshness": 20, "reliability": 20, ... }
}
```

Note: DB thresholds are **40/60/80**, not code defaults 25/50/75.

### Tier mapping (verified via `tierFromScore`)

| Score | Tier (with 40/60/80) |
|------:|---------------------|
| 24.9 | low |
| 25 | low |
| 39.9 | low |
| **40** | **medium** |
| 49.9 | medium |
| 50 | medium |
| 59.9 | medium |
| **60** | **high** |
| 74.9 | high |
| 75 | high |
| 79.9 | high |
| **80** | **critical** |
| 93.5 | critical |

**Semantics:** `tier_thresholds.low` = minimum for **medium**; `high` = minimum for **high**; `critical` = minimum for **critical**.

Thresholds **are used** from DB (not hardcoded 25/50/75).

---

## PART I — Configure factors UX

### API verification

| Test | Result |
|------|--------|
| PUT weights sum=110 | **400** `INVALID_WEIGHTS` ✓ |
| PUT weights sum=90 | **400** `INVALID_WEIGHTS` ✓ |
| Restore original (sum=100) | **200** ✓ |
| Settings persist | `updated_at` refreshed ✓ |

### i18n (en.json)

| Key | Value |
|-----|-------|
| `configure_factors` | Configure Prioritization Factors ✓ |
| `prioritization_total_weight_valid` | Total weight is valid (100%). ✓ |
| `prioritization_total_weight_invalid` | Total weight must equal 100%. ✓ |

### UI behavior (from code review)

- Total=100 → green (`text-emerald-300`) + valid message
- Total≠100 → amber warning + invalid message
- Save disabled unless total=100

---

## PART J — Apply safety

| Check | Result |
|-------|--------|
| Requires `confirm_apply: true` | ✓ 400 without it |
| Does NOT modify `is_active` | ✓ (SQL only sets tier/score/updated_at) |
| Does NOT modify `collected_data` | ✓ |
| Does NOT modify integer `priority` | ✓ all remain 5 |
| Does NOT modify source config | ✓ |
| Writes `priority_score`, `priority_tier`, `priority_updated_at` | ✓ |
| Sets `last_applied_at` on priorities | ✓ |
| Run status success | ✓ `d93ef8b3` |

### Preview vs apply drift

14 sources have `calculated_score ≠ priority_score` because preview ran at **12:55** but apply at **12:45** (scores changed between runs). **Expected** — user should re-apply after preview. Not a safety bug.

---

## PART K — Verdict

### **B — ACCEPTED WITH TUNING BACKLOG**

| Criterion | Status |
|-----------|--------|
| Apply works | ✓ |
| Score distribution meaningful | ✓ (33 distinct vs 6 pre-fix) |
| Saturation documented | ✓ (93.5 ceiling is math, not bug) |
| Telegram metrics align | ✓ |
| UI settings safe | ✓ |
| Placeholders remain | ⚠ category_importance, usage cap |
| Top-tier clustering | ⚠ 6 at identical 93.5 |

**Not FAIL** — scores reflect real operational data.  
**Not fully PRODUCTION-READY without backlog** — differentiation among top channels limited.

---

## PART L — Recommended P3 backlog

1. **Real Category Importance Model** — replace 50/70 placeholder
2. **Usage Signal Cap Tuning** — log-scale or higher cap for Telegram volume
3. **Score Explanation UX** — show why max is 93.5 for Telegram; highlight ceiling factors
4. **Top Sources Compare** — side-by-side breakdown for tied scores
5. **Priority Drift Monitoring** — warn when preview ≠ applied
6. **Scheduled preview without apply** — cron preview + alert on score collapse
7. **Alert when many sources collapse to same score** — detect saturation clusters
8. **Manual override governance** — audit trail for overrides
9. **Re-apply prompt** — UI nudge when preview is newer than last apply
10. **Tier threshold UI** — expose 40/60/80 settings in Configure modal

---

## PART M — Deliverables summary

| Item | Status |
|------|--------|
| Audit doc | This file |
| Code changes | **None** |
| Bug found | **None** — 93.5 cluster is legitimate saturation |
| Tests run | Existing 14/14 (from P2 commit) |
| Build | Not re-run (read-only audit) |

### Rollback

N/A — no changes in this audit.
