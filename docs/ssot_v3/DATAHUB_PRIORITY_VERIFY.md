# DataHub Data Sources Priority — DH-QA-VERIFY-3

> **Date:** 2026-06-03  
> **Task:** DH-QA-FIX-3 — Fix misleading Critical priority display  
> **Target:** Local Vite dev `http://localhost:3000` → proxy → backend  
> **Method:** Playwright headless (`tmp-dh-qa-verify-3.mjs`, not committed); admin JWT session inject

---

## RCA — chosen mapping

| Evidence | Finding |
|----------|---------|
| DB column | `data_sources.priority` **INTEGER DEFAULT 5** |
| Live distribution | **49/49** rows have `priority = 5` |
| Prioritization apply | Writes varchar tier (`low`…`critical`) when Smart Prioritization is applied; list still shows raw integers until then |
| Old FE bug | `map[priority - 1]` capped at index 3 → **5 → critical** (misleading; same red styling as Error) |

**Decision:** Treat integer **1–10** as legacy queue weight (5 = normal/default), not a 4-tier index:

| Integer | UI tier |
|---------|---------|
| 1–3 | low |
| 4–6 | medium (includes default **5**) |
| 7–8 | high |
| 9–10 | critical |

String tiers (`low`, `medium`, `high`, `critical`) pass through unchanged. Unknown/null → **medium**. No DB migration; API contract unchanged (raw `priority` still returned).

**UI:** Pills prefixed — `Status: Error`, `Priority: Medium` — so priority is not confused with operational health.

---

## Files changed

- `services/dataSourcesApi.ts` — `normalizePriority()` bucket mapping
- `components/ai/AIManager/tabs/DataHub/DataSourcesPanel.tsx` — labeled status/priority pills
- `deploy/blue/locales/en.json`, `fa.json` — `datahub_source_status_pill`, `datahub_source_priority_pill`
- `deploy/green/locales/en.json`, `fa.json` — same keys

---

## Verification results

| Check | Result |
|-------|--------|
| Build (`npm run build`) | **Pass** |
| `Priority: Medium` on list (sample) | **20** visible in first viewport |
| `Priority: Critical` | **0** |
| `Status: Error` (real ops status) | **17** (Telegram errors preserved) |
| Bare “Critical” without Priority prefix | **0** |
| DataHub write requests (POST/PUT/PATCH/DELETE on data-sources) | **0** |
| Screenshot | `test-results/dh-qa-verify-3/data-sources-priority-pills.png` |

---

## Before / after (UX)

| Before | After |
|--------|-------|
| Red pill **Critical** on ~all sources (priority 5) | Blue/info **Priority: Medium** |
| Red **Error** + red **Critical** on Telegram | **Status: Error** (red) + **Priority: Medium** (info) — distinct semantics |

---

## Out of scope (unchanged)

- DB migration / rewriting `priority = 5`
- Backend list response shape
- Smart Prioritization apply path
- Operational `last_status = error` display (still honest)
