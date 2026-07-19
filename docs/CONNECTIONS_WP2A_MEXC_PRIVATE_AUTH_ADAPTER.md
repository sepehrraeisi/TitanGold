# CONNECTIONS-WP2A — MEXC Private Authentication Adapter

**Module:** Settings → Connections → MEXC  
**Work Package:** CONNECTIONS-WP2A (+ R1 provenance/gate verification)  
**Environment:** Staging `https://titan.zala.ir`  
**Engineering verdict (pre–Human QA):** **NEEDS MORE VERIFICATION**

---

## Final status (before Human QA)

| Item | Value |
|------|--------|
| Human QA | PENDING — CONN-A1 … CONN-A5 |
| Engineering verdict | **NEEDS MORE VERIFICATION** |
| WP2A | Adapter + error contract + live-gated route |
| WP2A-R1 | Runtime provenance owner + gate-safety proof |
| WP2B | NOT STARTED |
| Test Connection UI | Still absent (not restored) |
| Real MEXC calls on Staging | Blocked unless `CONNECTIONS_PRIVATE_VERIFY_LIVE=true` |

---

## Baselines (do not conflate)

| Kind | Value |
|------|--------|
| WP2A runtime implementation | `864f95e` |
| WP2A documentation commit | `8d320d8` |
| Prior docs HEAD stamp (historical) | `67222cc` |
| Repository HEAD after R1 | recorded by Git after push (not embedded here as a self-hash) |
| Served frontend bundle | `assets/index-zOmnvrQI.js` |

---

## Official contract sources

Documented in `docs/MEXC_PRIVATE_AUTH_CONTRACT.md` from official Spot v3 docs only:

- https://www.mexc.com/api-docs/spot-v3/introduction
- https://mexcdevelop.github.io/apidocs/spot_v3_en/

Selected verification endpoint: `GET https://api.mexc.com/api/v3/account` (`SPOT_ACCOUNT_READ`).

Signing: HMAC-SHA256, lowercase hex signature, millisecond `timestamp`, default `recvWindow=5000`, maximum recvWindow **&lt; 60000**, header `X-MEXC-APIKEY`.

Account endpoint official limit: `Weight(IP): 10`, rate note `2 times/s`. Purpose: read-only account information — **no order placement**.

Mapped codes: `700001`, `700002`, `700003`, `700005`, `700006`, `700007`, HTTP `429`, `500`, `503`, `504`.

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

---

## Live gate (WP2A Staging safety)

`CONNECTIONS_PRIVATE_VERIFY_LIVE` defaults unset/false.

When false / `allowProviderCall=false`:

- Returns `CONNECTION_PRIVATE_VERIFY_NOT_LIVE` (HTTP 503)
- Terminates **before** Secret decryption, signing, provider transport, DNS/TLS, status/last-tested persistence
- Proven by WP2A-R1 deterministic tests: decrypt/sign/transport/persist call counts = 0

---

## Runtime provenance (WP2A-R1)

### RCA — why health previously reported `a17ef46`

| Finding | Detail |
|---------|--------|
| Owner | `backend/routes/health.js` captured `git rev-parse --short HEAD` once at module import |
| Process cwd / script | PM2 `cwd=/home/ubuntu/webapp/TitanGold/backend`, script `server.js` |
| Start time | Backend cluster workers started while original-tree HEAD was still `a17ef46` |
| Later git move | Original tree HEAD advanced; in-memory `gitCommit` stayed stale |
| Loaded WP2A source | Disk hashes for adapter/route/service matched `864f95e` (untracked/restored copies over staged deletes) |
| Classification | **Health provenance owner defective** for file-copy deploys + **stale observability marker**; not a missing WP2A module load |

### Fix

- Canonical owner: `backend/utils/runtimeProvenance.js`
- Prefer `TITAN_RUNTIME_COMMIT` / `GIT_COMMIT` / `GIT_SHA`, else git from repo root
- Health/readiness expose `commit` + `commitSource`
- Staging deploy sets `TITAN_RUNTIME_COMMIT=864f95e` and restarts **only** `titan-backend`

---

## Persistence separation

- `persist` defaults **false**
- Real Staging Connection is not updated by WP2A
- Proposed transitions only; WP2B owns real persistence

---

## Frontend

No frontend changes. UI remains Configured · Not verified / پیکربندی‌شده · تأیید نشده. No Test Connection.

---

## Tests

| Suite | Executed | Passed | Failed | Skipped | Retried | Env |
|-------|----------|--------|--------|---------|---------|-----|
| jest WP2A-R1 provenance/gate | 9 | 9 | 0 | 0 | 0 | jest/node |
| jest WP2A adapter | 29 | 29 | 0 | 0 | 0 | jest/node |
| jest WP1A exchangeConnectionService | 5 | 5 | 0 | 0 | 0 | jest/node |
| vitest WP1A containment/R1/R2 | 20 | 20 | 0 | 0 | 0 | vitest |

**Totals:** executed 63 · passed 63 · failed 0 · skipped 0 · retried 0

No real provider requests.

---

## Deployment / runtime

| Item | Value |
|------|--------|
| Deploy | provenance owner + schemas; restart `titan-backend` only |
| Worker / Scheduler | not restarted |
| Served FE bundle | unchanged `assets/index-zOmnvrQI.js` |
| Demo / Emergency Stop | remain active |
| Scheduler | `titan-engine-worker` · `["arbitrage"]` |
| Live verify env | unset (blocked) |
| Runtime implementation marker | `TITAN_RUNTIME_COMMIT=864f95e` |

---

## Remaining WP2B work

`CONNECTIONS-WP2B — Controlled Real MEXC Test Connection`

- Controlled live gate enablement
- Real persistence of verification outcomes
- Optional Test Connection UI under capability + rate limit
- Do not begin automatically

---

## Human-QA handoff

### CONN-A1 — UI Regression
- MEXC remains Configured · Not verified
- Test Connection absent
- Manage available

### CONN-A2 — Secret Non-Exposure
- Safe Network DTO contains no Secret or full API key
- Tests prove gated verification does not decrypt or contact provider

### CONN-A3 — Official Authentication Contract
- Official endpoint, header, signing, timestamp and recvWindow documented
- No real credential or provider request used

### CONN-A4 — Error Contract
- Official fake response codes mapped and sanitized
- No raw provider payload returned

### CONN-A5 — Runtime Regression
- Backend runtime provenance verified (`864f95e` via env / commitSource)
- Scheduler continues
- Demo and Emergency Stop remain active
- Current Connection status unchanged
- Live remains impossible

---

## Rollback

1. Revert R1 provenance commits
2. Redeploy prior `health.js` / remove `runtimeProvenance.js`
3. Clear `TITAN_RUNTIME_COMMIT` if set
4. Restart only `titan-backend`
5. Confirm FE bundle unchanged
