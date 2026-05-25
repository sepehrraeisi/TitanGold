# Pull Request addendum — GAP-024 Blacklist/Whitelist

> Branch: `feat/gap-008-sources-backend-wiring` · See also `PR_GAP-008-010.md` for full PR body.

## Summary (DataHub advanced — this branch)

| Module | Backend | Design | GAP |
|--------|---------|--------|-----|
| **Blacklist / Whitelist** | `/api/v1/data-hub/filter-rules` + migration `028` | Done | **GAP-024 Closed** |
| **Web Crawlers** | `/api/v1/data-hub/crawlers` + migration `029` | Done | **GAP-026 Closed** |

**Pending advanced:** discovery, prioritization, archiving (IndexedDB / mock today).

**Open v3.1:** GAP-025 (publishing filter hook), GAP-027 (crawler scheduler + Playwright prod only).

**Next contract:** GAP-028 Auto Discovery (`DISCOVERY_API_CONTRACT.md`) — awaiting approval.

Contract: `docs/ssot_v3/advanced/BLACKLIST_WHITELIST_API_CONTRACT.md`  
Demos + ingestion proof: `docs/ssot_v3/DataHub_DEMOS.md` § `dataHub.advanced.blacklist`  
Evidence: `docs/ssot_v3/EVIDENCE.md` § Filter rules  
Migration proof: `docs/ssot_v3/audit/ENVIRONMENT.md` § Migration 028

---

## Stash note (out-of-scope work)

**Out-of-scope Telegram/Agents changes are in `stash@{0}`** (`out-of-scope telegram/agents changes before GAP-024`).

This PR **intentionally does not include** those files (e.g. `backend/routes/telegram.js`, `AIAgents.tsx`, `AgentDetailPanel`, `BreakingNewsMonitor`, `TelegramDataPanel`, `ai-agents.js`, `telegram-collector/dist`, related tests).

Restore only with an **explicit separate decision**:

```bash
git stash list    # confirm stash@{0}
git stash pop     # only when intentionally resuming Telegram/Agents work
```

Do **not** `stash pop` onto GAP-024 / blacklist commits unless that work is being resumed deliberately.

---

## Test plan (GAP-024)

- [ ] `GET/POST/PUT/DELETE /api/v1/data-hub/filter-rules`
- [ ] `POST /api/v1/data-hub/filter-rules/evaluate` (ingestion + publishing targets)
- [ ] Ingestion: `POST /api/v1/collected-data` with active blacklist → **403** `FILTER_BLOCKED`
- [ ] Batch: `POST /api/v1/collected-data/batch` increments `blocked` when filtered
- [ ] Advanced → Blacklist: UI loads rules from API (no IndexedDB list)
- [ ] `cd backend && npm run migrate` applies `028_create_datahub_filter_rules`
- [ ] `npm run build`

**Deferred (GAP-025 v3.1):** publishing worker hook on automation dispatch / telegram publish (evaluate API only in v3.0).
