# Agents Shell — Final Closeout

**Module:** AI → Agents → Agents Shell  
**Status:** CLOSED AND FROZEN  
**Engineering verdict:** REAL WORKING  
**Human QA verdict:** PASS (AS-1 through AS-5)  
**Closeout date:** 2026-07-16  

---

## 1. Scope

Final scoped closeout for Agents Shell i18n remediation and empty-state behavior:

- Localized result-count labels (full / filtered / one / zero)
- Empty-search guidance (`try_different_search`)
- Clear-filters action (`clear_filters`) preserving sort
- EN/FA locale coverage in blue and green deploy bundles
- Focused unit tests

**Out of scope:** Arbitrage Scanner, Data Hub, unrelated monitoring scripts.

---

## 2. RCA

**Symptom:** Human QA observed raw i18n keys in Agents Shell UI: `showing_results`, `try_different_search`, `clear_filters`.

**Cause:** `LanguageContext` imports locale JSON from `deploy/blue/locales/`; missing keys fall back to the key string itself. These keys were referenced in `AIAgents.tsx` but absent from locale files.

**Fix:** Added canonical keys to blue/green EN/FA locales; replaced inline fallback strings with `getAgentsResultsLabel()` helper; added `data-testid` hooks and focused tests.

---

## 2.1 Dependency findings

Proven dependencies for this closeout slice:

| Layer | Dependency | Role |
|-------|------------|------|
| Frontend | `components/ai/AIAgents.tsx` | Agents Shell UI owner |
| i18n | `context/LanguageContext.tsx` | Locale loader (read-only inspection) |
| Locales | `deploy/blue/locales/{en,fa}.json` | Canonical runtime locale source |
| Locales | `deploy/green/locales/{en,fa}.json` | Deploy-slot parity copies |
| Tests | `src/__tests__/components/ai/AIAgents.test.tsx` | Focused shell i18n coverage |
| Deploy | `scripts/deploy-production-frontend.sh` | Staging frontend deploy (used for `8ddb430`) |

**Not modified:** Data Hub, runtime execution state service, Kill Switch APIs, Redis contracts, PM2 process config, Arbitrage Scanner agent internals.

---

## 2.2 Source of Truth

| Concern | Owner |
|---------|-------|
| Agents Shell UI strings / empty states | `components/ai/AIAgents.tsx` |
| Locale string values | `deploy/blue/locales/{en,fa}.json` (runtime import path) |
| Green locale parity | `deploy/green/locales/{en,fa}.json` |
| Runtime Effective Mode / Kill Switch | Existing runtime execution state service (unchanged) |
| Served frontend assets | `/home/ubuntu/webapp/TitanGold/dist` via nginx |
| Agents Shell functional baseline | Implementation commit `8ddb430` |

No duplicate locale owners, runtime-mode stores, or agent registries were introduced.

---

## 3. Scoped files committed

| File | Change |
|------|--------|
| `components/ai/AIAgents.tsx` | Result-count helper, always-visible count, clear-filters UX |
| `deploy/blue/locales/en.json` | 6 new keys |
| `deploy/blue/locales/fa.json` | 6 new keys |
| `deploy/green/locales/en.json` | 6 new keys |
| `deploy/green/locales/fa.json` | 6 new keys |
| `src/__tests__/components/ai/AIAgents.test.tsx` | EN/FA i18n coverage |

**Diff size:** +280 / −27 lines across 6 files only.

---

## 4. Protected unrelated files (not committed)

| File | Git status |
|------|------------|
| `scripts/backup-db.sh` | modified (unstaged) |
| `scripts/phase2-monitoring/titangold-backup-healthcheck.sh` | modified (unstaged) |
| `scripts/phase2-monitoring/titangold-telegram-notify.sh` | untracked |

Contents not inspected or exposed. Original worktree remains dirty **only** because of these files.

---

## 5. Git closeout

| Item | Value |
|------|-------|
| Runtime implementation commit | `8ddb430` — `fix(agents): finalize Agents Shell i18n and empty states` |
| Documentation closeout commit | recorded at push time as `docs(agents): close Agents Shell baseline` |
| Branch | `main` |
| Implementation push | `61457fe..8ddb430` → `origin/main` |
| Isolation method (implementation) | Clean worktree from `origin/main`; staged 6 implementation files only |
| Isolation method (documentation) | Clean worktree from `origin/main`; staged only `docs/AGENTS_SHELL_CLOSEOUT.md` |
| Runtime source vs `8ddb430` | No runtime application source differs after documentation-only commit |
| Served runtime bundle | `assets/index-CqSFwR1U.js` (unchanged by docs commit) |

Prior design-system commit: `61457fe` — `fix(agents): harmonize Agents Shell with Data Hub design system`

A documentation-only commit does **not** require frontend rebuild, nginx reload, or PM2 restart.

---

## 6. Tests

```bash
npx vitest run src/__tests__/components/ai/AIAgents.test.tsx --exclude 'deploy/**'
```

| Suite | Executed | Passed | Failed |
|-------|----------|--------|--------|
| `AIAgents.test.tsx` | 14 | 14 | 0 |

Coverage includes: full count, filtered count, singular, zero, clear-filters (sort preserved), EN/FA, no raw keys in DOM.

---

## 7. Build

```bash
npm run build
```

**Result:** PASS (production-style Vite build, ~31–35s)  
**Main bundle:** `dist/assets/index-CqSFwR1U.js`  
**DataHub bundle:** `dist/assets/DataHubTab-KMFwV01X.js` (unchanged marker smoke)

---

## 8. Staging deployment

| Item | Value |
|------|-------|
| Environment | Staging |
| Domain | https://titan.zala.ir |
| Script | `scripts/deploy-production-frontend.sh` |
| nginx root | `/home/ubuntu/webapp/TitanGold/dist` |
| Served index bundle | `assets/index-CqSFwR1U.js` |
| Deploy result | SUCCESS |
| Hard refresh | Verified via cache-bust navigation |

**Locale verification (browser):**

- EN full: `Showing 15 agents`
- EN zero: `No agents found` + `Try a different search term or adjust the filters.`
- EN clear: restores 15 agents, search cleared
- FA full: `نمایش 15 عامل`
- Raw keys absent from DOM: `showing_results`, `try_different_search`, `clear_filters`

---

## 9. Runtime safety

`/api/health/ready` → `runtime_safety`:

```json
{
  "status": "ok",
  "killSwitchActive": true,
  "effectiveMode": "demo",
  "workerAcknowledged": true,
  "message": "Demo + kill switch active"
}
```

Deploy script authenticated smoke: `runtime-mode OK dry_run dry_run`

- Effective Mode: Demo — VERIFIED
- Emergency Stop / Kill Switch: active — VERIFIED
- Live execution: blocked — VERIFIED
- Data Hub: untouched — VERIFIED

---

## 10. Human QA

| Scenario | Verdict |
|----------|---------|
| AS-1 | PASS |
| AS-2 | PASS |
| AS-3 | PASS |
| AS-4 | PASS |
| AS-5 | PASS |

**Agents Shell Human QA:** PASS (explicit approval 2026-07-16)

Preserved behavior: preference switching/persistence, search, status, sort, redesigned cards, responsive layout, dark theme, no raw shell i18n keys.

---

## 11. Baseline status

| Area | Status |
|------|--------|
| Functionality | PASS |
| Redesign | PASS |
| Browser QA | PASS |
| Human QA | PASS |
| Runtime Safety | PASS |
| Git scoped commit/push | DONE |
| Staging verification | DONE |

**Agents Shell:** CLOSED AND FROZEN  
**Next approved work:** Arbitrage Scanner (only after explicit transition approval)

---

## 12. Rollback

```bash
git revert 8ddb430
npm run build
bash scripts/deploy-production-frontend.sh
```

Revert removes i18n keys and result-count helper; prior commit `61457fe` remains as design-system baseline.
