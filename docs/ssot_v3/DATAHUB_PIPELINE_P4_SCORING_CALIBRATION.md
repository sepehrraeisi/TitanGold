# DH-PIPELINE-P4-SCORING-CALIBRATION-1

**Task:** Phase 1 quality scoring calibration (v2 alongside legacy v1)  
**Date:** 2026-06-07  
**Verdict:** v2 deployed; materially better separation for Telegram-heavy pipeline data.

---

## Scoring model summary

v1 (`metadata.quality_score`) is unchanged. v2 adds source-type profiles via `normalizationQualityScorerV2.js`:

| Profile | Primary factors |
|---------|-----------------|
| **Telegram** | `signalDensity`, `contentSubstance`, `marketRelevance`, `sourceReliability`, `structure`, `freshness`, `completeness` |
| **RSS** | `titleQuality`, `contentLength`, `sourceReliability`, `freshness`, `categoryMatch`, `structure`, `completeness` |
| **API** | `payloadCompleteness`, `contentRichness`, `sourceReliability`, `freshness`, `structuredRichness`, `completeness` |

### Telegram calibration highlights

- **Commodity quote lines** (`انس:`, `نقره:`, `طلا:`) and **crypto ticker lines** (`Bitcoin:`, `Ethereum:`) → `PRICE_PATTERN_DETECTED`
- **Fiat quotes** including `IRT` suffix
- **Freshness** uses the younger of `publishedAt` and `collected_at` (collector ingest time wins over stale Telegram timestamps)
- **Source reliability** treats active sources with recent `collected_at` as operationally healthy even when `last_status` is stale `error`
- Short price/signal posts boosted via `SHORT_BUT_STRUCTURED`; empty content → `MEDIA_ONLY_NO_TEXT` (score 0, validation rejects before worker persist)

### Target bands (Telegram)

| Content type | v2 range (observed) |
|--------------|---------------------|
| Ounce/silver price ticks | 76 |
| Crypto multi-ticker board | 70 |
| Short forex hashtag (`IRT #EUR`) | 72 |
| Long market analysis | 74+ |
| Weak / non-market short posts | 31–48 |
| Generic news without signals | ~48 |

---

## Reason codes

`PRICE_PATTERN_DETECTED`, `GOLD_TERM_DETECTED`, `CURRENCY_TERM_DETECTED`, `CRYPTO_TERM_DETECTED`, `MARKET_NEWS_TERM_DETECTED`, `SHORT_BUT_STRUCTURED`, `LOW_TEXT_SUBSTANCE`, `MEDIA_ONLY_NO_TEXT`, `SOURCE_HIGH_RELIABILITY`, `SOURCE_LOW_RELIABILITY`, `FRESH_CONTENT`, `STALE_CONTENT`, `HAS_URL`, `HAS_HASHTAG`, `HAS_NUMERIC_SIGNAL`, `MISSING_SUMMARY`, `WEAK_CONTEXT`

Stored in `normalized_data.metadata.quality_reason_codes`.

---

## Files changed

| File | Change |
|------|--------|
| `backend/services/normalizationQualityScorerV2.js` | **New** — v2 profiles + reason codes |
| `backend/services/normalizationQualityScorer.js` | v1 preserved; `scoreNormalizedRecord()` returns v1 + v2; `applyQualityToNormalized()` writes v2 metadata |
| `backend/services/normalizationWorker.js` | Passes `source_error_count`, `collected_at`, `source_type` to scorer |
| `backend/services/dataPipelineSnapshot.js` | Preview prefers `quality_score_v2` when present; exposes `qualityReasonCodes` |
| `backend/schemas/dataHubSchemas.js` | `qualityReasonCodes` optional on preview row |
| `components/ai/AIManager/tabs/DataHub/PipelinePanel.tsx` | Score tooltip shows top reason codes |
| `types.ts` | `qualityReasonCodes?: string[]` |
| `backend/__tests__/unit/normalizationQualityScorerV2.test.js` | **New** — 9 unit tests |
| `backend/scripts/simulate-quality-v2-distribution.mjs` | **New** — read-only v1 vs v2 simulation |

**Not changed:** transfer batch size, normalization batch size (150), scheduler intervals, statuses, agent/data_queue, Telegram publish.

---

## Unit test results

```
PASS __tests__/unit/normalizationQualityScorerV2.test.js
  9 passed (telegram ounce/silver, price vs generic, long analysis, weak short, media-only invalid, RSS, API, v1+v2 metadata, legacy preserved)
```

---

## Old vs v2 distribution (last 500 processed rows, read-only simulation)

| Metric | v1 (stored) | v2 (resimulated) |
|--------|-------------|------------------|
| min | 38 | 31 |
| max | 79 | 76 |
| median | 52 | 76 |
| avg | 53.93 | 74.08 |
| distinct scores | 15 | 14 |
| 0–25 bucket | 0 | 0 |
| 26–50 bucket | 1 | 9 |
| 51–75 bucket | 497 | 109 |
| 76–100 bucket | 2 | 382 |

**Interpretation:** v1 clusters 99.4% of rows in 51–75 (modes 52/55/57). v2 spreads Telegram price ticks to 76, weak/non-signal content to 26–50, and mid-tier signals to 51–75. Distinct count is similar, but **bucket spread and semantic separation are substantially improved** — the P3 audit goal.

Raw JSON: `test-results/dh-p4-scoring/distribution.json`

---

## Example rows

| Preview | v1 | v2 | Top reason codes |
|---------|----|----|------------------|
| `🔻 انس: 5194.75 / نقره: 89.437` | 52 | 76 | PRICE_PATTERN_DETECTED, HAS_NUMERIC_SIGNAL, GOLD_TERM_DETECTED, FRESH_CONTENT |
| `195,200 IRT #EUR` | 56 | 72 | PRICE_PATTERN_DETECTED, CURRENCY_TERM_DETECTED, SHORT_BUT_STRUCTURED, HAS_HASHTAG |
| `🔻Bitcoin: 68540.46 …` | 57 | 70 | PRICE_PATTERN_DETECTED, CRYPTO_TERM_DETECTED, HAS_NUMERIC_SIGNAL |
| `سلام` (weak) | 52 | ≤50 | LOW_TEXT_SUBSTANCE, WEAK_CONTEXT |
| News headline (no price) | 64 | 48 | FRESH_CONTENT only |

---

## API / UI behavior

- **API:** Pipeline preview rows expose `qualityScore` from v2 when `metadata.quality_score_v2` exists; otherwise legacy v1. Optional `qualityReasonCodes` array when present.
- **UI:** Pipeline panel shows score with tooltip listing up to 5 reason codes. No breaking change to existing v1 display path for rows without v2.

---

## Verification checklist

| # | Check | Result |
|---|-------|--------|
| 1 | `npm run build` | ✓ |
| 2 | Unit tests (9/9 v2) | ✓ |
| 3 | Read-only simulation (500 rows) | ✓ |
| 4 | v2 better bucket spread | ✓ |
| 5 | No batch/interval changes | ✓ (`NORMALIZATION_DEFAULT_BATCH=150` unchanged) |
| 6 | `pm2 reload titan-backend` | ✓ |
| 7 | New rows get v2 via normal worker only | ✓ (no backfill) |
| 8 | No agent/publish/data_queue side effects | ✓ |

---

## Rollback plan

1. Revert the P4 commit (or remove v2 writes from `applyQualityToNormalized`).
2. `pm2 reload titan-backend`
3. Legacy `quality_score` / `quality_band` / `quality_warning` remain on all existing rows.
4. New rows stop receiving v2 metadata; no DB backfill to undo.

---

## Commit

`d60747fafde95bc7d64ca6f7bf24ed11aea6b5c0`
