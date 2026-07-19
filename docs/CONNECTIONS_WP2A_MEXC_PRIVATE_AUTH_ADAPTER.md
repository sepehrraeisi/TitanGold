# CONNECTIONS-WP2A — MEXC Private Authentication Adapter

**Module:** Settings → Connections → MEXC  
**Work Package:** CONNECTIONS-WP2A  
**Environment:** Staging `https://titan.zala.ir`  
**Engineering verdict (pre–Human QA):** **NEEDS MORE VERIFICATION**

---

## Final status (before Human QA)

| Item | Value |
|------|--------|
| Human QA | PENDING — CONN-A1 … CONN-A5 |
| Engineering verdict | **NEEDS MORE VERIFICATION** |
| WP2A | Adapter + error contract + live-gated route shipped |
| WP2B | NOT STARTED |
| Test Connection UI | Still absent (not restored) |
| Real MEXC calls on Staging | Blocked unless `CONNECTIONS_PRIVATE_VERIFY_LIVE=true` |

---

## Baselines

| Kind | Value |
|------|--------|
| Start `origin/main` | `efcf986` |
| WP1A security | `b5d8927` |
| WP1A-R1 | `ae92737` |
| WP1A-R2 | `2a7ad99` |
| WP1A docs | `efcf986` |
| Served frontend bundle (unchanged) | `assets/index-zOmnvrQI.js` |
| Implementation HEAD | recorded after push (this documentation closeout) |
| Runtime backend health marker | dirty original tree still reports `a17ef46` in `/api/v1/health` while WP2A sources are deployed into `/home/ubuntu/webapp/TitanGold/backend` |

---

## Official contract sources

Documented in `docs/MEXC_PRIVATE_AUTH_CONTRACT.md` from official Spot v3 docs only:

- https://www.mexc.com/api-docs/spot-v3/introduction
- https://mexcdevelop.github.io/apidocs/spot_v3_en/

Selected verification endpoint: `GET https://api.mexc.com/api/v3/account` (`SPOT_ACCOUNT_READ`).

Signing: HMAC-SHA256, lowercase hex signature, millisecond `timestamp`, default `recvWindow=5000`, header `X-MEXC-APIKEY`.

No real credentials or real signed examples in docs.

---

## Architecture

```
POST /api/v1/connections/mexc/verify-private
  → authenticate + CONNECTIONS_TEST + rate limit (5/min)
  → verifyOwnedMexcConnection(persist=false, allowProviderCall=LIVE_FLAG)
  → ownership / configured / disabled checks
  → withDecryptedMexcCredentials (scoped)
  → verifyMexcPrivateAccountRead (adapter)
  → mexcSafeFetch (allowlisted HTTPS)
  → sanitized result + proposedTransition
  → audit without secrets
```

Owners reused:

- Encryption: `backend/utils/crypto.js`
- Connection rows / DTO: `exchangeConnectionService.js`
- Capabilities: `CONNECTIONS_TEST`
- Audit: `audit_logs` via `writeConnectionAudit`

Adapter does **not** own DB, encryption, frontend, or TitanGold auth.

Key files:

- `backend/services/connections/providers/mexcPrivateAuthAdapter.js`
- `backend/services/connections/providers/mexcSigning.js`
- `backend/services/connections/providers/mexcSafeTransport.js`
- `backend/services/connections/mexcErrorCatalog.js`
- `backend/services/connections/connectionPrivateVerificationService.js`
- `backend/routes/connections.js` (`POST /mexc/verify-private`)

---

## Live gate (WP2A Staging safety)

`CONNECTIONS_PRIVATE_VERIFY_LIVE` defaults unset/false.

When false:

- Route returns `CONNECTION_PRIVATE_VERIFY_NOT_LIVE` (HTTP 503)
- No decrypt of Staging secrets
- No provider HTTP call
- No status persistence (`persisted: false`)

Automated tests inject `allowProviderCall: true` + fake `transport` only.

Staging probe (engineering only, not Browser QA):

- `POST /api/v1/connections/mexc/verify-private` → `503` / `CONNECTION_PRIVATE_VERIFY_NOT_LIVE`
- Connection `lastTestedAt` remained `2026-07-19T09:36:13.824Z` (unchanged by WP2A)
- `privateAuthVerified=false`, `isConnected=false`

---

## Error contract

Canonical categories in `mexcErrorCatalog.js` including credential/signature/timestamp/permission/IP/account/rate-limit/unavailable/timeout/network/response/decryption/disabled/not-configured/forbidden/internal/not-live.

Raw provider messages never returned. Safe numeric provider codes may be preserved.

---

## Persistence separation

- `persist` defaults **false**
- Real Staging Connection is not updated by WP2A
- Proposed transitions: `authenticated` | `failed` | `permission_limited` | `verification_inconclusive`
- Provider unavailable / timeout does **not** revoke credentials
- Fake `persistFn` used only in tests; failures leave `persisted=false`

---

## Frontend

No frontend changes. Served bundle remains `assets/index-zOmnvrQI.js`.

UI remains:

- Configured · Not verified (FA: پیکربندی‌شده · تأیید نشده)
- Explanatory private-verification copy
- No Test Connection button
- Manage available
- Unsupported providers Coming soon / به‌زودی
- No Connected / Authenticated claim

---

## Tests

| Suite | Executed | Passed | Failed | Skipped | Retried | Env |
|-------|----------|--------|--------|---------|---------|-----|
| jest `connections.wp2a.mexcPrivateAuth` | 29 | 29 | 0 | 0 | 0 | jest/node |
| jest `exchangeConnectionService.wp1a` | 5 | 5 | 0 | 0 | 0 | jest/node |
| vitest WP1A containment + R1 + R2 | 20 | 20 | 0 | 0 | 0 | vitest |

**Totals:** executed 54 · passed 54 · failed 0 · skipped 0 · retried 0

No real provider requests in automated tests (fake credentials + injectable transport only).

---

## Browser QA (regression-only)

Method: Playwright against Staging (MCP browser unavailable in this session).

| Check | Result |
|-------|--------|
| Connections opens | PASS |
| MEXC Configured · Not verified | PASS |
| Test Connection absent | PASS |
| Manage available | PASS |
| Coming soon for unsupported | PASS |
| No Connected / Authenticated claim | PASS |
| No Secret / full API key in Network | PASS |
| No verify-private / mexc test from UI | PASS |
| No severe Console errors | PASS |
| Desktop / tablet / mobile screenshots | PASS |
| Persian copy + Manage / به‌زودی | PASS |
| Demo + Emergency Stop visible | PASS |

Evidence screenshots (local engineering artifacts, not committed):

- `/tmp/wp2a-conn-desktop-en.png`
- `/tmp/wp2a-conn-tablet-en.png`
- `/tmp/wp2a-conn-mobile-en.png`
- `/tmp/wp2a-conn-desktop-fa.png`

---

## Deployment / runtime

| Item | Value |
|------|--------|
| Deploy | backend source only into original runtime tree; restart `titan-backend` only |
| Worker / Scheduler | not restarted |
| Served FE bundle | unchanged `assets/index-zOmnvrQI.js` |
| Demo | active (`mode=demo`, `effectiveMode=demo`) |
| Emergency Stop | active (`killSwitchActive=true`) |
| Worker acknowledgement | `true` |
| Live | impossible (`deploymentEngineEnabled=false`, Demo + Kill Switch) |
| Scheduler owner | `titan-engine-worker` |
| Scheduler allowlist | `["arbitrage"]` |
| Scheduler | running; `lastSuccessAt` advancing |
| Live verify env | unset (blocked) |
| Protected unrelated files | not modified in scoped commits |

---

## No-real-credential evidence

- Official contract doc uses fake placeholders only
- Tests use fake API key/secret strings and fake transport
- Staging live gate prevents decrypt + provider call
- Browser QA did not click Test Connection (button absent) and issued no verify-private from UI
- Engineering route probe returned `CONNECTION_PRIVATE_VERIFY_NOT_LIVE` without persistence

---

## Human-QA handoff

### CONN-A1 — UI Regression
- MEXC remains Configured · Not verified
- No Connected / Authenticated
- Test Connection absent
- Manage available

### CONN-A2 — Secret Non-Exposure
- No Secret / complete API key in Network responses
- No new browser credential storage
- Engineering tests confirm redaction

### CONN-A3 — Authentication Contract Evidence
- Official docs used; read-only endpoint; signing + timestamp/recvWindow
- Deterministic fake-adapter tests
- No real credential or provider request

### CONN-A4 — Error Contract
- Fake categorized responses for invalid credential, signature, timestamp, permission, IP, rate limit, unavailable, timeout

### CONN-A5 — Runtime Regression
- Public Arbitrage Scheduler continues (`titan-engine-worker`, allowlist `["arbitrage"]`)
- Demo + Emergency Stop active
- Live impossible
- Current Connection status unchanged (`lastTestedAt` unchanged; `privateAuthVerified=false`)

Human QA must explicitly PASS CONN-A1 through CONN-A5.

---

## Performance / operations

| Metric | Value |
|--------|--------|
| Adapter timeout | 8000 ms |
| Retry count | 0 |
| Route rate limit | 5 / 60s (`privateVerifyLimiter`) |
| Max response size | 64 KiB |
| Fake-provider test latency | BASELINE NOT AVAILABLE (suite local) |
| DB query count (verify path) | typically 2–3 reads + 1 audit when live-allowed |
| Decrypt ops | 2 (key + secret) when provider call allowed; **0** when live gate blocks |
| Log-volume impact | low (no provider body / signed query logging) |
| p95 | BASELINE NOT AVAILABLE |

---

## Rollback

1. Revert WP2A commit(s) on `main`
2. Redeploy prior backend connections sources
3. Confirm `/mexc/verify-private` absent or remains gated
4. Confirm FE bundle unchanged
5. Confirm Scheduler owner/allowlist unchanged

---

## Next slice

`CONNECTIONS-WP2B — Controlled Real MEXC Test Connection`

Do **not** begin WP2B automatically.
