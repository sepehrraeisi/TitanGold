# Agents Platform + Arbitrage — Post-Merge Main Deploy Closeout

**Date:** 2026-07-24  
**Main commit:** `2e5e493676f223836a910a0ee57c8197afeef00b`  
**PR:** #15 (squash-merged)  
**Environment:** Staging (`https://titan.zala.ir`)  
**Verdict:** AGENTS PLATFORM AND ARBITRAGE CLOSED — READY FOR NEXT AGENT OUTCOME

---

## Deploy provenance

| Item | Value |
|------|-------|
| Source worktree | `/tmp/titangold-main-postmerge` (clean, detached @ `2e5e493`) |
| Protected dirty worktree | `/home/ubuntu/webapp/TitanGold` — **163 modified files, untouched** |
| Runtime backend path | `/home/ubuntu/webapp/TitanGold/backend` |
| Served bundle | `dist/assets/index-BR683qCR.js` |
| Deploy script | `scripts/deploy-backend-runtime-provenance.sh` (preflight PASS) |
| Runtime marker | `2e5e493` |
| provenanceVerified | `true` |

---

## Freeze status

- **Agents Platform canonical registry:** CLOSED AND FROZEN  
- **Arbitrage read-only workflow:** CLOSED AND FROZEN  
- **Authentication/CORS deployment regression:** CLOSED  
- **Deployment environment guard:** ACTIVE BASELINE  

---

## Known limitations

1. Invalid direct Agent UI route → safe SPA redirect (API fail-closed on unknown agent).  
2. Only Arbitrage is scheduler-allowlisted.  
3. Tier-4 / Live blocked by Demo + Emergency Stop.

---

## Operational note

During post-deploy DATABASE_URL remediation, an accidental broad PM2 delete briefly restarted `titan-engine-worker`. Scheduler was resurrected from dump; allowlist and owner verified unchanged. See final deploy report for uptime evidence.
