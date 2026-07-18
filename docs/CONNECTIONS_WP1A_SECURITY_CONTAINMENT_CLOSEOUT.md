# CONNECTIONS-WP1A Closeout — Security Containment and Canonical MEXC Path

**Module:** Settings → Connections  
**Work Package:** CONNECTIONS-WP1A  
**Date:** 2026-07-18  
**Environment:** Staging `https://titan.zala.ir`

---

## Final status (before Human QA)

| Item | Value |
|------|--------|
| Human QA | **PENDING** — CONN-S1 … CONN-S6 |
| Engineering verdict | **NEEDS MORE VERIFICATION** |
| CONNECTIONS-WP1A | Implemented + Staging deploy + Browser QA evidence; awaiting Human QA |
| Full Connections program | **NOT CLOSED** |
| Next slice | `CONNECTIONS-WP2 — MEXC Private Authentication and Test Connection Contract` |

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

## Rollback

1. Revert WP1A commit(s) on `main`
2. Redeploy prior frontend bundle + backend routes/services
3. Confirm served bundle marker

## Next

`CONNECTIONS-WP2 — MEXC Private Authentication and Test Connection Contract`

Do **not** begin WP2 until WP1A Human QA PASS and CLOSED AND FROZEN.
