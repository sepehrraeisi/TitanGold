# Human QA Executable Checklist

**Environment:** staging host / `https://titan.zala.ir` (see `HUMAN_QA_DEPLOYMENT_TARGET.md`)  
**Hard rules:** Do **not** clear Kill Switch. Do **not** enable Live. Do **not** connect a real exchange. Do **not** send real external notifications. Do **not** place a real order.

**Access:** SSH tunnel per `docs/STAGING_ACCESS.md` or approved browser to `titan.zala.ir`.

---

## Preconditions (every session)

| Check | Expected | Evidence |
|-------|----------|----------|
| `GET /api/v1/health/ready` | `killSwitchActive=true`, `effectiveMode=demo`, `workerAcknowledged=true` | Screenshot / response JSON |
| Broker connections | `0` | ready `user_connections.count` |
| Engine | deployment disabled / not live | execution-runtime JSON |

---

## Role matrix

Roles: **user**, **vip**, **trader**, **admin** (use staging accounts issued by ops — not production secrets in docs).

---

## Checklist steps

### A. Header / runtime display

| # | Role/State | UI action | Expected UI | Expected API | Reason / DB / Redis / Worker | Capture |
|---|------------|-----------|-------------|--------------|------------------------------|---------|
| A1 | any / demo+KS | Open AI view | requested/effective DEMO visible | GET execution-runtime 200 (auth) | PG authoritative; Redis may cache equal revision only | header screenshot |
| A2 | admin / KS active | Observe kill/emergency indicators | KS or emergency_stop visible on Agents | ready.runtime_safety | no KS clear | banner screenshot |

### B. Agents — read & safe run

| # | Role/State | UI action | Expected UI | Expected API | Effects | Capture |
|---|------------|-----------|-------------|--------------|---------|---------|
| B1 | user | Open technical panel | Panel loads; empty/loading OK | GET agents / detail 200 or 403 per caps | no Redis weaken KS | panel shot |
| B2 | trader/admin | Run safe analytical cycle | Result or denied with reason; no live order | POST run → deny or safe demo | sideEffects suppressed if order class | network tab |
| B3 | any | Attempt order agent Run | Denied / cannot live | deny reason (KS/demo/cap) | no broker order; worker no live | panel-order shot |

### C. Agent config / enable

| # | Role/State | UI action | Expected UI | Expected API | Effects | Capture |
|---|------------|-----------|-------------|--------------|---------|---------|
| C1 | user | Edit agent config | Rejected / read-only | 403 | no DB unsafe mode change | UI + status |
| C2 | admin | Toggle enable under demo+KS | Allowed only within policy; live still impossible | 200/403 with reason | PG agent row only; KS unchanged | before/after |

### D. Topic Routing

| # | Role/State | UI action | Expected UI | Expected API | Effects | Capture |
|---|------------|-----------|-------------|--------------|---------|---------|
| D1 | user | Open Topic Routing | Read-only or rules list | GET 200; POST 403 | none unsafe | topic-routing-user |
| D2 | admin | Create rule (dummy keywords) | Rule appears | POST 200/201 | DB rule row | network + UI |
| D3 | admin | Edit/Delete same rule | Updated/removed | PATCH/DELETE | DB only | network |

### E. Artemis

| # | Role/State | UI action | Expected UI | Expected API | Effects | Capture |
|---|------------|-----------|-------------|--------------|---------|---------|
| E1 | trader | Overview / Decision tabs | Renders; Demo badge | GET state 200/403 | read-only | artemis shots |
| E2 | admin | Settings / Autopilot controls | No live dispatch; dry/deny | writes capability-gated | KS stays true | settings shot |
| E3 | admin | Trigger decision (if UI) | Demo path / deny live | policy reason | no exchange | API body |

### F. Negative Live attempt (display only)

| # | Role/State | UI action | Expected UI | Expected API | Effects | Capture |
|---|------------|-----------|-------------|--------------|---------|---------|
| F1 | admin / requested Live UI if shown | Toggle toward Live **without** clearing KS | effective remains DEMO | runtime view effectiveMode=demo | PG KS true; Redis cannot force live | header |

**Forbidden:** confirming Live, clearing KS, connecting exchange, real webhook/Telegram live send.

---

## Sign-off

| Role completed | Reviewer | Date | Result |
|----------------|----------|------|--------|
| user | | | |
| vip | | | |
| trader | | | |
| admin | | | |

Human visual approval is separate from engineering READY.
