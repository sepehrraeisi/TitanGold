# TitanGold Rule 02 — Current Active Work (Arbitrage Closeout)

**Updated:** 2026-07-29  
**Branch:** `feat/arbitrage-agent-full-product`

## Closed baselines

| Baseline | Status |
|----------|--------|
| Agent Product Template V1 | **CLOSED AND FROZEN** |
| Arbitrage Overview | **CLOSED AND FROZEN** |
| Manual analytical scan | **VERIFIED** (Human QA PASS) |

Reopen only for a reproduced production defect with scoped RCA and explicit approval.

## Next active outcome

**Arbitrage Candidates completion** — full product tab on `feat/arbitrage-agent-full-product`.

Deferred (shell only, no internal redesign):

- Scan History
- Profit & Risk
- Settings
- Integrations

## Hard boundaries (unchanged)

- No database migration without explicit approval
- No new provider endpoints
- No private credential access
- No Live / Tier-4 enablement
- Do not restart `titan-engine-worker`
- Scheduler allowlist remains `["arbitrage"]`
- Do not open a PR unless explicitly authorized
