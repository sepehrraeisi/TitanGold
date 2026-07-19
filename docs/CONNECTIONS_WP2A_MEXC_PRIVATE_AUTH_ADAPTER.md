# CONNECTIONS-WP2A — MEXC Private Authentication Adapter

**Module:** Settings → Connections → MEXC  
**Work Package:** CONNECTIONS-WP2A  
**Environment:** Staging `https://titan.zala.ir`

---

## Final status

| Item | Value |
|------|--------|
| CONNECTIONS-WP2A Engineering Verdict | **REAL WORKING** |
| CONNECTIONS-WP2A Status | **CLOSED AND FROZEN** |
| Human-QA verdict | **PASS** |
| Full MEXC Connections Program | **OPEN** |
| Next Outcome | MEXC End-to-End Program Slice |
| Next Outcome Status | **NOT STARTED** |
| Test Connection UI | Absent (not restored) |
| Real MEXC calls during WP2A | None |

---

## Human QA

| Scenario | Result |
|----------|--------|
| CONN-A1 — UI Regression | **PASS** |
| CONN-A2 — Secret and Gate Safety | **PASS** |
| CONN-A3 — Authentication Contract | **PASS** |
| CONN-A4 — Error Contract | **PASS** |
| CONN-A5 — Runtime Regression | **PASS** |
| Final Human-QA verdict | **PASS** |

---

## Baseline distinction

| Kind | Value |
|------|--------|
| WP2A adapter implementation | `864f95e` |
| Runtime-provenance implementation | `bfd7e39` |
| Pre-closeout documentation HEAD | `05a0a63` |
| Active runtime implementation marker | `bfd7e39` |
| Documentation closeout HEAD | recorded in the final closeout report (not embedded here) |
| Served frontend bundle | `assets/index-zOmnvrQI.js` |
| Environment | Staging |

Do not conflate runtime implementation commit, documentation HEAD, active runtime marker, or served frontend bundle.

---

## Authentication foundation

- Official MEXC private-authentication contract documented in `docs/MEXC_PRIVATE_AUTH_CONTRACT.md`
- Read-only verification endpoint: `GET https://api.mexc.com/api/v3/account` (`SPOT_ACCOUNT_READ`)
- Server-side HMAC-SHA256 signing implemented (lowercase signature)
- Millisecond timestamp and `recvWindow` handling implemented (default `5000`, max &lt; `60000`)
- Safe provider transport implemented (HTTPS allowlist, no redirects, bounded timeout/size, zero retries)
- Normalized provider error contract implemented (`700001`–`700007`, HTTP `429`/`500`/`503`/`504`, sanitized)
- No real credential used during WP2A
- No real provider request made during WP2A
- Test Connection remains absent
- Current Connection remains **Configured · Not verified**

---

## Gate safety

When `CONNECTIONS_PRIVATE_VERIFY_LIVE` is absent/false:

| Check | Result |
|-------|--------|
| Live private verification default | Disabled |
| Decrypt call count | **0** |
| Signing call count | **0** |
| Provider transport call count | **0** |
| Persistence call count | **0** |
| Blocked result | Sanitized `CONNECTION_PRIVATE_VERIFY_NOT_LIVE` |
| Secrets in logs / audit / responses / browser storage | None |

---

## Runtime provenance

| Check | Result |
|-------|--------|
| Runtime implementation commit | `bfd7e39` |
| Provenance assignment | Injected during deployment (`TITAN_RUNTIME_COMMIT` and/or generated `runtime-provenance.json`) |
| Tracked `ecosystem.config.json` | Contains **no** historical implementation hash |
| Health and readiness | Agree on `bfd7e39` |
| Backend cluster workers | Same implementation commit |
| Documentation-only commits | Do **not** change the runtime marker |
| Missing trusted provenance | Reports `unknown` / `unverified` (does not claim dirty Git HEAD is deployed) |

Deploy owner: `scripts/deploy-backend-runtime-provenance.sh`

---

## Regression (verified)

| Check | Result |
|-------|--------|
| Browser QA | **PASS** |
| English | **PASS** |
| Persian | **PASS** |
| RTL | **PASS** |
| Secret prefill | None |
| Test Connection | Absent |
| Unsupported providers | Coming soon / به‌زودی |
| Private verification request from UI | None |
| Public Arbitrage | Continues updating |
| Scheduler owner | `titan-engine-worker` |
| Scheduler allowlist | `["arbitrage"]` |
| Demo | Active |
| Emergency Stop | Active |
| Live | Impossible |
| MEXC status / `lastTestedAt` | Unchanged (`lastTestedAt=2026-07-19T09:36:13.824Z`, `privateAuthVerified=false`) |

---

## Tests

| Metric | Value |
|--------|--------|
| Total executed | **66** |
| Passed | **66** |
| Failed | **0** |
| Skipped | **0** |
| Retried | **0** |

Suites: jest provenance/gate, jest WP2A adapter, jest WP1A exchangeConnectionService, vitest WP1A containment/R1/R2.  
No real provider requests.

---

## Architecture (summary)

```
POST /api/v1/connections/mexc/verify-private
  → session + CONNECTIONS_TEST + rate limit
  → live gate (default off)
  → scoped decrypt → adapter → allowlisted HTTPS
  → sanitized result + proposedTransition (persist default false)
```

Canonical files:

- `backend/services/connections/providers/mexcPrivateAuthAdapter.js`
- `backend/services/connections/providers/mexcSigning.js`
- `backend/services/connections/providers/mexcSafeTransport.js`
- `backend/services/connections/mexcErrorCatalog.js`
- `backend/services/connections/connectionPrivateVerificationService.js`
- `backend/utils/runtimeProvenance.js`

---

## Remaining MEXC program work

**Next approved outcome:** MEXC End-to-End Program Slice  

**Status:** NOT STARTED  

Includes (when separately authorized): controlled live verification, persistence of outcomes, Test Connection under capability/rate-limit, and related End-to-End program work.

Do **not** begin automatically after this closeout.

---

## Rollback (reference)

1. Revert WP2A adapter and/or provenance commits as needed
2. Redeploy prior backend sources
3. Re-run `deploy-backend-runtime-provenance.sh` with the prior implementation commit
4. Restart only `titan-backend`
5. Confirm FE bundle and Connection status unchanged
