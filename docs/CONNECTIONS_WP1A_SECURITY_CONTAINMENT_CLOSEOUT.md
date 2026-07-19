# CONNECTIONS-WP1A Closeout — Security Containment and Canonical MEXC Path

**Module:** Settings → Connections  
**Work Package:** CONNECTIONS-WP1A  
**Date:** 2026-07-18  
**Environment:** Staging `https://titan.zala.ir`

---

## Final status (before Human QA)

| Item | Value |
|------|--------|
| Human QA | **PENDING** — CONN-R1 … CONN-R6 (WP1A-R1 remediation) |
| Engineering verdict | **NEEDS MORE VERIFICATION** |
| CONNECTIONS-WP1A | Security containment shipped; R1 truthfulness remediation deployed; awaiting Human QA |
| Full Connections program | **NOT CLOSED** |
| Next slice after Human QA PASS | MEXC private authentication (not started) |

---

## Runtime vs documentation

| Kind | Value |
|------|--------|
| **Runtime implementation baseline** | *(this WP1A implementation commit on `main` after push)* |
| **Documentation closeout HEAD** | recorded with implementation / docs commit |
| **Served frontend bundle** | `assets/index-D5cFR88n.js` |
| **Environment** | Staging |

---

## 1. Scope

Security containment for Connections:

- canonical TitanGold session auth for Connections requests
- browser secret-storage containment
- backend secret non-return DTO
- plaintext `/exchanges` route containment
- canonical encrypted MEXC persistence
- false-connected removal
- Connections capabilities + ownership
- safe audit + rate limits
- focused tests, Staging deploy, Human-QA handoff

## 2. Out of Scope

Real credentials; MEXC private authentication (WP2); full UI redesign; other exchange persistence; health background jobs; Agent consumer migration; ENV fallback removal; Arbitrage changes; Live; Data Hub / Agents Shell.

## 3. Repository Status

- Isolated worktree: `/tmp/titangold-connections-wp1a`
- Branch: `feat/connections-wp1a-security`
- Starting HEAD: `2dffed9`
- Original `/home/ubuntu/webapp/TitanGold`: dirty with protected unrelated scripts + backend sync copies — not cleaned

Protected files untouched:

- `scripts/backup-db.sh`
- `scripts/phase2-monitoring/titangold-backup-healthcheck.sh`
- `scripts/phase2-monitoring/titangold-telegram-notify.sh`

## 4. RCA (Discovery → WP1A)

| Symptom | Cause | WP1A fix |
|---------|-------|---------|
| `Invalid token` on Save/Test/Health | FE used `localStorage.token` instead of `titan_token` | `authenticatedFetch` / `connectionsApi` only |
| Secrets in browser | `saveConnectionSettings` wrote IndexedDB + `titan_mexc_settings` | No browser secret writes; legacy detect/remove only |
| Plaintext `/exchanges` | Separate persistence without encrypt | Delegate MEXC to canonical service; unsupported fail closed |
| False Connected | Public `/api/v3/time` + format check | Disabled; status `configured_unverified` / `authentication_pending` |
| Competing SoT | Dual UI + client stores + ENV | Canonical service owns MEXC metadata path for Settings UI |

## 5. Dependency Findings

| Layer | Owner |
|-------|-------|
| Crypto | `backend/utils/crypto.js` (AES-256-GCM) — reused |
| Capabilities | `CONNECTIONS_READ` / `MANAGE` / `TEST` |
| Routes | `/api/v1/connections/*` + `/exchanges` aliases |
| Service | `backend/services/exchangeConnectionService.js` |
| FE client | `services/connectionsApi.ts` |
| Audit | `audit_logs` |
| Rate limit | `middleware/rateLimit.js` on mutate/test |

## 6. Source of Truth

- **Canonical:** encrypted `exchange_connections` rows via `exchangeConnectionService`
- **Not SoT:** browser localStorage/IndexedDB secrets; plaintext `/exchanges` writes; public time reachability
- **Status WP1A:** `not_configured` \| `configured_unverified` \| `authentication_pending` \| `secret_reentry_required`
- **Connected / privateAuthVerified:** always false until WP2

## 7. Architecture Decision

One vertical path for MEXC Settings Connections:

UI → `connectionsApi` + `authenticatedFetch` → v1 Connections routes → capabilities → canonical service → encrypted DB → safe DTO.

Compatibility `/exchanges` aliases call the same service. Non-MEXC providers fail closed for credential persistence.

## 8–12. Backend / DB / Redis / Security / Runtime

| Area | Result |
|------|--------|
| Backend | Canonical service + contained routes |
| Database | No migration (Staging row count 0); plaintext legacy rows marked re-entry |
| Redis | Rate-limit keys only |
| Security | Non-return DTO; capabilities; ownership by `user_id`; sanitized errors |
| Runtime | No Live; Kill Switch unchanged; Arbitrage public path untouched |

## 13. Frontend Changes

- `MultiExchangeSettings.tsx` — canonical client, no `token` key, no health poll storm, draft-only secrets
- `ConnectionsSettings.tsx` — removed duplicate legacy MEXC form
- `services/connectionsApi.ts` — new
- `services/api.ts` — no browser secret SoT; legacy test never succeeds as Connected
- locales EN/FA blue+green — WP1A messages

## 14. UI/UX

Minimal containment UI (not full redesign): truthful status labels, legacy insecure-copy warning without revealing values, unsupported provider message.

## 15. Tests

| Suite | Executed | Passed | Failed | Env |
|-------|----------|--------|--------|-----|
| `exchangeConnectionService.wp1a.test.js` + `crypto.test.js` | 17 | 17 | 0 | jest/node |
| `connections.wp1a.containment.test.ts` | 6 | 6 | 0 | vitest/jsdom |

## 16. Performance

| Metric | Result |
|--------|--------|
| Prior invalid-token health poll | Removed (no 30s loop) |
| Connections list request | Single GET on load |
| Encryption latency baseline | **BASELINE NOT AVAILABLE** |

## 17. Browser QA

Staging Browser QA without real provider credentials (session restore only). Evidence recorded in deployment section after deploy.

## 18. Human-QA Handoff

See CONN-S1 … CONN-S6 below. Must explicitly PASS before closing WP1A.

## 19. Regression

- Public Arbitrage monitor not tied to private Connection
- Scheduler / Demo / Emergency Stop preserved
- Data Hub / Agents Shell untouched

## 20. Build/Deployment

Recorded after deploy: bundle marker, process cwd, HEAD, health.

## 21. Files Changed

- `backend/services/capabilities.js`
- `backend/services/connectionErrors.js`
- `backend/services/exchangeConnectionService.js`
- `backend/routes/connections.js`
- `backend/routes/exchanges.js`
- `backend/__tests__/unit/exchangeConnectionService.wp1a.test.js`
- `components/settings/MultiExchangeSettings.tsx`
- `components/settings/ConnectionsSettings.tsx`
- `services/connectionsApi.ts`
- `services/api.ts`
- `deploy/blue/locales/{en,fa}.json`
- `deploy/green/locales/{en,fa}.json`
- `src/__tests__/connections.wp1a.containment.test.ts`
- `docs/CONNECTIONS_WP1A_SECURITY_CONTAINMENT_CLOSEOUT.md`

## 22–23. Commits / Git

Scoped commits on feature branch → push `main`. Isolated worktree clean after push. Original tree remains dirty only for protected/unrelated work.

## 24. Remaining Risks

- Runtime `mexc.js` ENV fallback and decrypt gap remain until Agent-consumer slice
- WP2 private auth not implemented — users must not expect Connected
- Wallet Connections UI still separate / older

## 25. Final Verdict

**NEEDS MORE VERIFICATION** — pending Human-QA PASS on CONN-S1 … CONN-S6.

---

## Human-QA scenarios

### CONN-S1 — TitanGold Authentication
- Connections opens with valid session
- No misleading `Invalid token` as MEXC error
- Expired session identified as login/session issue

### CONN-S2 — Browser Secret Safety
- No provider Secret retained after refresh
- No new Secret in localStorage / IndexedDB
- Legacy warning exposes no value
- Explicit cleanup removes only known legacy keys

### CONN-S3 — Backend Non-Exposure
- List/detail metadata only
- No complete API key / Secret / ciphertext / sensitive errors

### CONN-S4 — Truthful Connection State
- Public reachability ≠ Connected
- Configured but untested clear
- Unsupported providers truthful
- No private-auth success before WP2

### CONN-S5 — Permissions and Ownership
- Read-only cannot mutate
- Authorized actions match capabilities
- Other user’s Connection inaccessible

### CONN-S6 — Public Arbitrage Regression
- Analytical scans continue
- Scheduler active
- No private Connection required
- Demo + Emergency Stop active
- No real side effect

---

## WP1A-R1 — Truthful Status and UI Containment

### Interruption and resume preflight

- Prior run blocked by execution-environment outage (`/bin/sh ENOENT` / missing worktree).
- Resume: previous `/tmp/titangold-conn-wp1a-r1` was **prunable/missing**; no partial commits.
- Fresh isolated worktree recreated from `origin/main` @ `b5d8927`.
- Branch: `feat/connections-wp1a-r1-truth`
- `origin/main` had **not** advanced beyond `b5d8927` at resume.
- Original `/home/ubuntu/webapp/TitanGold` left dirty only for protected scripts (not reset/stashed).

### Configured-state RCA (accepted)

Admin Staging account has **one** canonical encrypted MEXC row in `exchange_connections`:

- encrypted API key/secret present
- `is_active = false`
- API `configured = true`
- `credentialStatus` pending / unverified

Therefore the truthful UI status is **Configured · Not verified** with action **Manage**.

Non-sources that must **not** create configured status (covered by unit tests):

- server ENV credentials
- public market reachability
- legacy browser `titan_mexc_settings` presence
- stale frontend inference

Zero-row → **Not configured** + **Configure** is proven by deterministic tests (`connectionDisplayStatus`), without mutating Staging data.

### Product copy cleanup

- Removed visible internal Work-Package / slice names from Connections description.
- Professional EN/FA copy explains public analytics vs private verified account access.

### Settings i18n repair

- Added canonical `settings_configuration` and `clear_cache` to blue/green EN/FA locale owners.
- Settings sidebar no longer falls back to raw keys for those entries.

### Unsupported providers

- Binance / Bybit / KuCoin / Gate.io → **Coming soon**
- No `+`, no credential panel, no mutation affordance.

### MEXC action

- Configured row → accessible **Manage** (`aria-label` includes MEXC)
- No-row fixture → **Configure**
- Does not claim Connected / Authenticated; does not repopulate secrets from storage.

### Tests (R1 + WP1A regression)

| Suite | Executed | Passed | Failed | Skipped | Retried | Env |
|-------|----------|--------|--------|---------|---------|-----|
| vitest `connections.wp1a.r1.truthfulness` + `connections.wp1a.containment` | 15 | 15 | 0 | 0 | 0 | node/vitest (worktree) |
| jest `exchangeConnectionService.wp1a` | 5 | 5 | 0 | 0 | 0 | node + experimental-vm-modules |

### Deployment (R1)

| Item | Value |
|------|--------|
| Environment | Staging (`https://titan.zala.ir`) |
| Build source | isolated worktree `/tmp/titangold-conn-wp1a-r1` |
| Backend restart | **not required** (frontend-only R1) |
| Worker / Scheduler restart | **not performed** |
| Served frontend bundle | `assets/index-Dd3lHHeS.js` |
| Health / Ready | `/api/health` + `/api/ready` → ok |
| Demo / Emergency Stop | `effectiveMode=demo`, `killSwitchActive=true` |
| Worker acknowledgement | `workerAcknowledged=true` |
| Scheduler owner | `titan-engine-worker` |
| Scheduler allowlist | `["arbitrage"]` |
| Live | impossible under Demo + Kill Switch |
| Protected files | untouched (`scripts/backup-db.sh`, backup-healthcheck, telegram-notify) |

### Browser QA (Staging, no real credentials, no Test Connection)

| Check | Result |
|-------|--------|
| MEXC status | **Configured · Not verified** VERIFIED |
| MEXC action | **Manage** / `aria-label="Manage MEXC"` (FA: مدیریت MEXC) VERIFIED |
| Connected / Authenticated claim | absent VERIFIED |
| Credential fields on Manage | empty placeholders only; no secret repopulation VERIFIED |
| Product copy | no `CONNECTIONS-WP*`; professional public-vs-private EN/FA VERIFIED |
| Settings i18n | Configuration / Clear Cache (EN) and پیکربندی / پاک‌سازی کش (FA) VERIFIED; no raw keys |
| Unsupported exchanges | Coming soon / به‌زودی; `role="status"`; no active `+` VERIFIED |
| Network DTO | `apiKey`/`apiSecret` empty; no ciphertext; `isConnected=false` VERIFIED |
| Browser storage | no new provider Secret writes; legacy key may remain until explicit cleanup; values not shown VERIFIED |
| Arbitrage Scheduler | lastScan modern + updating; allowlist `[arbitrage]` VERIFIED |
| Demo + Emergency Stop | active VERIFIED |
| Dark theme | active VERIFIED |
| Horizontal overflow | none observed (desktop) VERIFIED |
| Tablet / mobile layout | Connections content readable; no horizontal overflow probe failure VERIFIED |
| Global `dir=rtl` / IRANSans on Settings | **NOT VERIFIED as document-level** (FA labels verified; app shell RTL is page-local elsewhere) |
| Keyboard focus-visible ring | code present (`focus-visible:outline-*`); harness Tab focus name VERIFIED; visual ring evidence partial |

### Human-QA handoff (R1)

#### CONN-R1 — Truthful MEXC Status
- Current canonical row → Configured · Not verified + Manage
- No Connected / Authenticated claim
- Tests prove no-row → Not configured; ENV/public/legacy cannot create configured

#### CONN-R2 — Product Copy
- No internal WP names in product UI copy
- Public vs private access explained (EN/FA)

#### CONN-R3 — Settings i18n
- No raw `settings_configuration` / `clear_cache`
- EN/FA translated

#### CONN-R4 — Unsupported Providers
- Coming soon; no setup action; no credential form

#### CONN-R5 — MEXC Action
- Manage accessible; no-row uses Configure; no auth success claimed

#### CONN-R6 — Security Regression
- WP1A secret containment intact; no real credential / Test Connection in Browser QA
- Public Arbitrage + Demo + Emergency Stop remain active

### R1 Final engineering verdict (pre–Human QA)

**NEEDS MORE VERIFICATION** — implementation, focused tests, Staging deploy, and Browser QA complete. Human QA must explicitly PASS CONN-R1 through CONN-R6 before closeout freeze.

---

## Rollback

1. Revert WP1A / WP1A-R1 commit(s) on `main`
2. Redeploy prior frontend bundle + backend routes/services as needed
3. Confirm served bundle marker

## Next

Private MEXC authentication / Test Connection contract remains **deferred** until WP1A Human QA PASS and CLOSED AND FROZEN.

Do **not** begin that work automatically after this remediation handoff.
