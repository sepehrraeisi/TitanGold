# Human QA Session Log — Support Mode

**Session start:** 2026-07-14T13:40:00Z  
**Git HEAD:** `0bd988872bc5df02dfcd9ffd28318a9f3f0db492`  
**Environment:** staging `https://titan.zala.ir`  
**Engineering freeze:** active — no code changes unless Human QA confirms defect  
**Tester:** pending human + Cursor support capture  

## Preconditions

| Check | Result | Evidence |
|-------|--------|----------|
| ready KS/demo/workerAck | PASS | killSwitchActive=true, effectiveMode=demo, workerAck=true, rev 227 |
| connections | PASS | 0 |
| porcelain empty | PASS | 0 bytes |

---

## Scenario ledger

### HQA-A1 — Global Header / Runtime Status

| Field | Value |
|-------|-------|
| Scenario ID | HQA-A1 |
| Date/time | 2026-07-14 ~13:40Z |
| Tester | Cursor support capture (awaiting Human sign-off) |
| Git HEAD | 0bd9888… |
| Role | admin (session TitanGold Admin) |
| Initial runtime | demo + KS active |
| Page | `/?view=ai` Agents |
| Action | Observe header |
| Expected | requested/effective DEMO visible |
| Actual | DEMO visible; also "Disconnected", "Loading..." spinner in header |
| Engineering observation | **not** Human PASS |
| Screenshot | `hqa-A1-header-runtime.png` (browser capture) |
| Notes for Human | Confirm whether endless "Loading..." is acceptable; KS banner may be below fold on Agents |

**Engineering result:** OBSERVED — await Human PASS/FAIL  
**Human visual:** ⬚ pending

---

### Known-condition investigations (engineering)

#### KC-MEXC-404

| Field | Value |
|-------|-------|
| Exact request (broken) | `GET /api/market/mexc/api/v3/ticker/24hr?symbol=BTCUSDT` → 301 → `/api/v1/market/mexc/api/v3/ticker/24hr` → **404** |
| Correct contract | `GET /api/v1/market/mexc/ticker/24hr?symbol=BTCUSDT` → **200** with real MEXC data |
| Root cause | `getMexcApiUrl()` replaces only `/api/v1/v3/...` but callers pass `/api/v3/...`; result concatenates `/api/market/mexc` + `/api/v3/...` |
| Trigger | AI / header / panels that call `fetchMexcTicker24hr` |
| Frequency | On page loads that fetch tickers; not an infinite backend loop by itself |
| UI impact | Console errors; header may show Loading/Disconnected |
| Fake data? | Throws rather than inventing ticker — need Human to confirm no fake lastPrice |
| Classification | **API CONTRACT DEFECT** (frontend path mapping) — **not** mere staging provider unavailability (provider works on correct path) |
| Severity proposal | Medium (ux/console + possibly header Loading) |
| Work package? | Borderline — market ticker path, not Kill Switch/runtime-safety core; blocks polish of AI surfaces |
| Fix status | **Deferred** until Human QA confirms as in-scope defect |

#### KC-WS-400

| Field | Value |
|-------|-------|
| Exact request | `wss://titan.zala.ir/ws/agents?token=…` and `ws://127.0.0.1:5002/ws/agents?token=…` |
| Response | HTTP **400 Bad Request** body `Bad Request` (upgrade rejected before app auth) |
| Backend | Workers log Agent WebSocket initialized; port 5002 fronted by **PM2 cluster** proxy |
| Frontend | `hooks/useWebSocket.ts` reconnect every **3000ms**, max **5** attempts → then stop |
| UI impact | Console WS errors; Agents still load via REST; no Live capability via WS |
| Classification | **CONFIGURATION DEFECT** (PM2 cluster ↔ WebSocket upgrade on shared :5002) / possible **RETRY** limited to 5 |
| Severity proposal | Medium (realtime updates degraded; REST fallback works) |
| Fix status | **Deferred** until Human confirms |

---

## Next recommended Human steps

1. Sign off HQA-A1 (header DEMO + whether Loading/Disconnected fails criteria).
2. Continue order: user → vip → trader → admin permission scenarios.
3. Explicitly confirm whether KC-MEXC-404 and KC-WS-400 should open a remediation cycle **now** for this work package.

Do not treat this support log as Human QA PASS.

---

## HQA-A1 Remediation Cycle (2026-07-14)

Human result: FAIL → remediation implemented.

### Fixes
- MEXC `getMexcApiUrl` → canonical `/api/v1/market/mexc/ticker/24hr`; unwrap `{ok,data}`; no fake ticker fallbacks in Header
- Agents WS: max 1 reconnect, quiet errors, stable unavailable banner
- AgentSafetyBanner: human labels, hide internal kill reasons, Emergency Stop badge + explanation
- ExecutionModeStatus: Preference/Active labels + header Emergency Stop chip (no raw requested_mode keys)
- Wallet: terminate Loading → Demo N/A when unavailable
- Accuracy: show N/A unless accuracy > 0
- Unit: `__tests__/unit/mexcApiUrl.test.ts` 3/3 PASS
- Playwright staging: 94/94 PASS
- Deployed bundle: `assets/index-CgDVqezb.js`

### Safety after fix
- KS active, demo, worker ack, connections 0

### Human retest required
Return to HQA-A1 on hard-refreshed `https://titan.zala.ir/?view=ai`
