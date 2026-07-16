# ARB-WP1A Closeout — Contract Repair, Truthful Analytical Mode and Scan History

**Module:** AI → Agents → Arbitrage Scanner  
**Work Package:** ARB-WP1A  
**Date:** 2026-07-16  
**Human QA:** PENDING  
**Engineering verdict (pre-Human-QA):** NEEDS MORE VERIFICATION  

**Not closed:** Full Arbitrage Agent remains open. This is slice 1 only.

---

## 1. RCA (from discovery)

Confirmed Staging contradictions:

1. `Total Scans = 0` while `ai_decisions` had 12 `arbitrage_scan` rows — details used stale `ai_agents.total_decisions`.
2. `Net profit captured ≈ -$51` with empty execution history — mislabeled sum of estimated last-scan profits.
3. Negative net rows shown as opportunities / high-conviction.
4. Best profit hardcoded `0`; histories hardcoded `[]`.
5. Raw strategy keys `strategy_spot` / `strategy_triangle`.
6. Product claimed triangular / cross-exchange / futures / Auto Execute without implementation.

## 2. Architecture decisions

| Decision | Choice |
|----------|--------|
| Scan history SoT | `ai_decisions` where `decision_type = arbitrage_scan` |
| Last scan | Latest decision by `created_at`; `metadata.last_result` is denormalized cache only |
| Total scans | `COUNT(ai_decisions)` — **not** `ai_agents.total_decisions` (deprecated for Arbitrage) |
| Card count | Same COUNT via list aggregate (Agents Shell label still “Results” — shell frozen) |
| Current product mode | Analytical MEXC spot bid/ask **spread monitor** |
| Qualified opportunities | Always empty until proven multi-leg strategy exists |
| Execution / realized profit | Unsupported — not fabricated |
| Schema migration | None in WP1A |

## 3. Canonical definitions

- **Scan:** one persisted `arbitrage_scan` decision  
- **Spread Candidate:** analytical same-market condition with positive expected net above min threshold — **not** executable arbitrage  
- **Rejected Candidate:** failed qualification (e.g. `NON_POSITIVE_NET`, `BELOW_MIN_PROFIT`, …)  
- **Qualified Opportunity:** executable multi-leg arbitrage meeting all WP rules — **none in WP1A**  
- **Missing values:** `N/A` / `null` — never `--` or fake `0.0%`  
- **Risk score:** 0–100 score unit (not %)

## 4. API contract (ARB-WP1A)

### GET `/api/v1/ai-agents` (arbitrage row)

- `decisions` / `totalScans` = canonical scan count  
- `lastUpdate` = last scan completion time  

### GET `/api/ai-agents/:id/details` (arbitrage)

- `metrics.scanStats`, `candidateStats`, `qualifiedStats`, `riskStats`  
- `metrics.netProfitCapturedUSDT = null` (removed meaning)  
- `execution.supported = false`  
- `lastScan` normalized (candidates / rejected / qualified)  
- no `executionHistory` / `opportunityHistory` arrays  

### GET `/api/ai-agents/:id/scan-history?page=&pageSize=`

- Paginated history from `ai_decisions`  
- Auth + `AI_AGENT_READ`  
- Legacy rows normalized at read time  

### POST run

- Same service contract for manual and scheduler  
- Persists one decision; does not invent realized profit  

## 5. Legacy data

Existing 12 decisions preserved. Negative legacy “opportunities” reclassified as rejected (`LEGACY_NEGATIVE_ESTIMATE`) at read time. No destructive backfill.

## 6. Unsupported capability decisions

Disabled / labeled Not available:

- Triangular, cross-exchange, futures scanning  
- Auto Execute (stored preference preserved, not operational)  
- Settlement / transfers  
- Binance / Gate as active integrations  
- Execution history / captured profit  

## 7. Provider

Replaced hardcoded `localhost:5002` with `INTERNAL_API_BASE` or `http://127.0.0.1:${PORT||5002}`.

## 8. Market proxy security note

`/api/market/mexc/*` is reachable via public Nginx `/api/` → `:5002`. Public-read market data. **Foundation Work Package recommended** for auth/rate-limit hardening — out of ARB-WP1A scope.

## 9. Runtime mismatch note

Process health commit was `d17fd8e` while repo HEAD advanced for Agents Shell docs/UI. Arbitrage backend files were **identical** between `d17fd8e` and pre-WP1A `origin/main`. WP1A backend deploy requires backend PM2 reload.

## 10. Protected unrelated files

Never touched:

- `scripts/backup-db.sh`  
- `scripts/phase2-monitoring/titangold-backup-healthcheck.sh`  
- `scripts/phase2-monitoring/titangold-telegram-notify.sh`  

## 11. Tests / performance / deploy

Filled at closeout time in the final report.

## 12. Human-QA scenarios

ARB-A1 … ARB-A8 as specified in the Work Package (pending human execution).

## 13. Remaining Arbitrage slices

- ARB-WP1B: AgentControlShell + full professional redesign  
- Later: real multi-leg strategies only with proven executable contracts  
- Foundation: market-proxy exposure hardening  

## 14. Rollback

```bash
git revert <WP1A_COMMITS>
# rebuild frontend, reload titan-backend
```

No schema migration to roll back.
