# CONNECTIONS-WP2A — MEXC Private Authentication Adapter

**Module:** Settings → Connections → MEXC  
**Work Package:** CONNECTIONS-WP2A (including final runtime-provenance remediation)  
**Environment:** Staging `https://titan.zala.ir`  
**Engineering verdict (pre–Human QA):** **NEEDS MORE VERIFICATION**

---

## Final status (before Human QA)

| Item | Value |
|------|--------|
| Human QA | PENDING — CONN-A1 … CONN-A5 |
| Engineering verdict | **NEEDS MORE VERIFICATION** |
| WP2A adapter / contract / gate | Accepted (not reimplemented) |
| Runtime provenance | Deployment-injected (env + generated manifest) |
| WP2B / MEXC E2E | NOT STARTED |
| Test Connection UI | Absent |
| Real MEXC calls | Blocked unless `CONNECTIONS_PRIVATE_VERIFY_LIVE=true` |

---

## Baselines (do not conflate)

| Kind | Value |
|------|--------|
| WP2A runtime implementation (adapter) | `864f95e` |
| WP2A documentation commit | `8d320d8` |
| Prior provenance owner fix | `8504609` |
| Current documentation HEAD | see Git after push (not embedded as a self-hash here) |
| Served frontend bundle | `assets/index-zOmnvrQI.js` |

The **deployed runtime marker** is assigned at deploy time and may differ from documentation HEAD. Documentation-only commits must not change the deployed marker.

---

## Official MEXC contract (accepted)

See `docs/MEXC_PRIVATE_AUTH_CONTRACT.md`:

- `GET https://api.mexc.com/api/v3/account`
- `SPOT_ACCOUNT_READ`
- `X-MEXC-APIKEY`
- HMAC-SHA256 lowercase signature
- timestamp milliseconds
- `recvWindow` default `5000`, maximum &lt; `60000`
- Weight(IP) 10 · rate note 2 times/s
- Mapped codes `700001`–`700007`, HTTP `429`/`500`/`503`/`504`
- Read-only / no-order purpose

No real credentials or signed examples.

---

## Gate safety (accepted)

When `CONNECTIONS_PRIVATE_VERIFY_LIVE` is unset/false:

- `CONNECTION_PRIVATE_VERIFY_NOT_LIVE`
- decrypt = 0 · signing = 0 · transport = 0 · persistence = 0
- Connection `lastTestedAt` unchanged; `privateAuthVerified=false`

---

## Runtime provenance RCA and final owner

### Original stale marker (`a17ef46`)

`health.js` captured `git rev-parse --short HEAD` once at module import. After a file-copy deploy onto a dirty tree whose HEAD was still `a17ef46`, the process kept reporting that SHA even after Git moved and WP2A sources were loaded.

### Why a literal ecosystem hash is insufficient

Storing `TITAN_RUNTIME_COMMIT=864f95e` inside tracked `ecosystem.config.json`:

- becomes stale after the next backend implementation deploy
- couples documentation/config Git history to a historical implementation SHA
- is not recalculated by deployment

### Final owner

Preferred flow (Option A + durable generated manifest):

1. Clean deployment worktree determines the backend implementation commit
2. `scripts/deploy-backend-runtime-provenance.sh` writes **untracked** `backend/runtime-provenance.json`
3. Same script exports `TITAN_RUNTIME_COMMIT` into the PM2 process environment and restarts **only** `titan-backend`
4. Every cluster worker reads the same immutable value at startup
5. Health and readiness report `commit`, `commitSource`, `provenanceVerified`, optional `deployedAt`

Trusted resolution order (`backend/utils/runtimeProvenance.js`):

1. `process.env.TITAN_RUNTIME_COMMIT`
2. generated `runtime-provenance.json`
3. otherwise `commit=unknown` / `source=unverified` (does **not** claim dirty Git HEAD is deployed)

Tracked `ecosystem.config.json` must **not** contain a historical implementation hash.

---

## Architecture (adapter — unchanged)

```
POST /api/v1/connections/mexc/verify-private
  → CONNECTIONS_TEST + rate limit
  → live gate (default off)
  → scoped decrypt → adapter → allowlisted HTTPS
  → sanitized result + proposedTransition (persist default false)
```

---

## Tests

| Suite | Executed | Passed | Failed | Skipped | Retried | Env |
|-------|----------|--------|--------|---------|---------|-----|
| jest provenance + gate | 12 | 12 | 0 | 0 | 0 | jest/node |
| jest WP2A adapter | 29 | 29 | 0 | 0 | 0 | jest/node |
| jest WP1A service | 5 | 5 | 0 | 0 | 0 | jest/node |
| vitest WP1A containment/R1/R2 | 20 | 20 | 0 | 0 | 0 | vitest |
| **Total** | **66** | **66** | **0** | **0** | **0** | |

No real provider requests.

---

## Deployment / runtime verification checklist

| Item | Expectation |
|------|-------------|
| Restart | `titan-backend` only |
| Workers | Same `commit` + `commitSource` |
| Health ↔ readiness | Agree on commit/source |
| Provenance source | `env:TITAN_RUNTIME_COMMIT` and/or `manifest:…` |
| ecosystem tracked file | No literal implementation SHA |
| MEXC Connection | Configured · Not verified; `lastTestedAt` unchanged |
| FE bundle | `assets/index-zOmnvrQI.js` |
| Scheduler | `titan-engine-worker` · `["arbitrage"]` |
| Demo / Emergency Stop | Active; Live impossible |

---

## Remaining MEXC End-to-End / WP2B

`CONNECTIONS-WP2B — Controlled Real MEXC Test Connection`

- Controlled live gate enablement
- Real persistence of verification outcomes
- Optional Test Connection UI under capability + rate limit

Do **not** begin automatically.

---

## Human-QA handoff

### CONN-A1 — UI Regression
Configured · Not verified · Test Connection absent · Manage available · EN/FA/RTL

### CONN-A2 — Secret and Gate Safety
No Secret in browser/API DTO · gated route: no decrypt/signing/transport/persistence

### CONN-A3 — Authentication Contract
Official MEXC contract documented · no real credential/provider request

### CONN-A4 — Error Contract
Official provider errors normalized and sanitized

### CONN-A5 — Runtime Regression
Deployment-injected provenance truthful · both workers agree · Scheduler/Arbitrage continue · Connection unchanged · Demo + Emergency Stop · Live impossible

---

## Rollback

1. Revert provenance remediation commit(s)
2. Remove generated `runtime-provenance.json` / clear PM2 `TITAN_RUNTIME_COMMIT` if needed
3. Restart only `titan-backend`
4. Confirm FE bundle unchanged
