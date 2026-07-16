# ARB-WP1B-1 Closeout — AgentControlShell Migration and Viewport-Safe Panel Frame

**Module:** AI → Agents → Arbitrage Scanner  
**Work Package:** ARB-WP1B-1  
**Date:** 2026-07-16  
**Human QA:** PENDING (ARB-B1 … ARB-B4) — header status remediation awaiting re-check  
**Engineering verdict (pre-Human-QA):** **NEEDS MORE VERIFICATION**  

**Not closed:** ARB-WP1B-1 awaits Human PASS. ARB-WP1B-2 **NOT STARTED**.

**WP1A baseline (frozen):** runtime `f4fd43a` · docs `dddb55a`  
**Shell migration:** `5d078e7` · prior docs `82f19cb`

---

## 0. Human-QA remediation — Header Status Clarity

### Confirmed defects

1. Raw enum `DRY_RUN` via `Active: {(effectiveMode).toUpperCase()}`
2. Redundant second `Dry Run` badge beside the mode chip
3. `Broker: Broker offline` from concatenating `broker_label` + `broker_disconnected`

### RCA

Presentation lived in shared `AgentControlShell` (generic chrome), not Arbitrage business code. Underlying gate values (`effectiveMode`, `killSwitchActive`, `providerConnected`, agent `status`) were correct; only **formatting** was wrong.

### Ownership

| Concept | Source of truth | Presentation owner |
|---------|-----------------|--------------------|
| Operational status | Agent details `status` → `mapAgentOperationalState` | Shell maps `ready` → localized `Active` for chrome only (filter vocabulary unchanged) |
| Effective mode | `useAgentExecutionGate().effectiveMode` | Shell via `execution_mode_*` i18n keys — never raw enum |
| Execution class | `getAgentExecutionKind(agent_key)` | Shell |
| Last run | `agent.lastUpdate` | Shell `formatLastRun` |
| Emergency Stop | `runtime.killSwitchActive` | Shell safety strip |
| Broker | `runtime.providerConnected` | Shell: `Broker: Online\|Offline` |

### Fix summary

- Removed `Active: DRY_RUN` and duplicate Dry Run badge
- Effective mode chip shows localized **Dry Run** once
- Safety: `Emergency Stop: Active · Broker: Offline` + `Live side effects are blocked.`
- No Arbitrage-specific enums added to shell; no WP1A contract change

---

## 1. RCA (original shell migration)

### Why Arbitrage did not use `AgentControlShell`

`ArbitrageAgentControl` owned a local `fixed inset-0` overlay + rounded panel, local Header (title/purpose/Run Scan/Close), StatusBar, tab strip, and an inner `overflow-y-auto` body. `AgentControlShell` existed as the shared modal chrome but had **zero consumers**.

### Local frame vs shared ownership

| Behavior | Before (local) | After (shared shell) |
|----------|----------------|----------------------|
| Overlay / portal | Local | `AgentControlShell` |
| Viewport max height | Local `max-h-[92vh]` | Shell `max-h-[min(92vh,100dvh-1.5rem)]` |
| Escape / body overflow lock | Missing / partial | Shell |
| Focus trap / restoration | Missing | Shell |
| Header identity + safety badges | Local Header | Shell header |
| Run Scan | Local | Arbitrage `primaryAction` |
| Close | Local SecondaryButton | Shell Close (`SecondaryButton`, `arb-close`) |
| Status metrics + Pause/Restart | Local StatusBar | Arbitrage `belowHeader` |
| Tabs + analytical banner | Local | Arbitrage `belowHeader` |
| Tab panel content | Local scroll | Shell body scroll owner |
| Business data / handlers | Arbitrage | Arbitrage (unchanged) |

### Duplicate removed

Local outer overlay, dialog container, and `Header` component removed. Status pill duplicated with shell operational badge was removed from StatusBar.

### Regression risks

- Focus / Escape ownership must not conflict with parent page  
- Close must remain approved neutral pill  
- Nested scroll must not reappear  
- WP1A metrics and handlers must stay truthful  

---

## 2. Ownership decisions

- **`AgentControlShell`:** overlay, viewport-safe frame, sticky header, Escape, focus trap/restoration, body overflow lock, default Close (DS Secondary), optional `belowHeader`, single body scroll, **generic status presentation formatting**.  
- **Arbitrage:** purpose text, Run Scan handler, Pause/Restart, tabs, WP1A data, settings draft/save/reset, all tab content.  
- **No Arbitrage-specific business logic** added to the shell.  
- **Data Hub / Agents Shell pages:** not modified. Agents Shell filter still uses `ready` vocabulary.

---

## 3. Scroll owner

**One intentional scroll region:** `[data-testid="agent-control-shell-body"]`.

Header, safety strip, status row, analytical banner, and tablist are `shrink-0` outside that region.

---

## 4. Tests

| Suite | Executed | Passed | Failed | Env |
|-------|----------|--------|--------|-----|
| `agentCardMeta.test.ts` | 6 | 6 | 0 | vitest/jsdom |
| `ArbitrageAgentControl.wp1a.test.tsx` | 6 | 6 | 0 | vitest/jsdom |
| `ArbitrageAgentControl.wp1b1.test.tsx` | 7 | 7 | 0 | vitest/jsdom |
| `ArbitrageAgentControl.wp1b1.status.test.tsx` | 3 | 3 | 0 | vitest/jsdom |

**Total:** 22 executed · 22 passed · 0 failed · 0 skipped

---

## 5. Browser QA

**Environment:** Staging `https://titan.zala.ir` · Served bundle `assets/index-D6ZmsjWR.js` · HEAD `a9d6a5e`

| Check | Result |
|-------|--------|
| No raw `DRY_RUN` / `dry_run` in header | VERIFIED — EN status Active / Dry Run / Provider |
| One Dry Run chip only | VERIFIED (`dryRunCount=1`) |
| `Broker: Offline` (not `Broker: Broker offline`) | VERIFIED — `Emergency Stop: Active · Broker: Offline` |
| Operational status Active (not Ready+Active) | VERIFIED |
| Live-block detail without ES duplication | VERIFIED — `Live side effects are blocked.` |
| Persian labels / no English leakage on statuses | VERIFIED — فعال / اجرای آزمایشی / کارگزار: آفلاین |
| Desktop / tablet / mobile / landscape overflow | VERIFIED — no page overflow-x; Close reachable |
| Escape closes panel | VERIFIED |
| Runtime safety | VERIFIED — Demo preference, killSwitchActive true, workerAcknowledged true |

Human QA remains the final authority for ARB-B1…B4.

---

## 6. Runtime safety

Must remain: Effective Mode Demo · Emergency Stop active · worker acknowledged · Live impossible. No real side effects in this slice.

---

## 7. Protected unrelated files

Never touched:

- `scripts/backup-db.sh`  
- `scripts/phase2-monitoring/titangold-backup-healthcheck.sh`  
- `scripts/phase2-monitoring/titangold-telegram-notify.sh`  

---

## 8. Human-QA handoff

### ARB-B1 — Shared Shell and Header
- One clear operational status (Active)
- One clear Dry Run status (no raw `DRY_RUN`)
- Broker displays as Offline (`Broker: Offline`)
- No `Broker: Broker offline`
- Emergency Stop clear without unnecessary duplication
- Header remains professional

### ARB-B2 — Viewport and Scroll
- Desktop / Tablet / Mobile portrait / Mobile landscape
- One intentional scroll region
- No clipping or horizontal overflow

### ARB-B3 — Keyboard and Focus
- Tab/Shift+Tab contained
- Escape closes
- Focus returns to Open Agent
- Focus visible

### ARB-B4 — Navigation and Regression
- All six tabs work
- WP1A data remains correct
- Six approved buttons remain correct
- English / Persian / dark theme
- No raw keys / no Console errors

Human must explicitly PASS ARB-B1 through ARB-B4.

---

## 9. Remaining work

- **ARB-WP1B-2:** full per-tab content redesign / IA polish — **NOT STARTED**  
- Do not begin until WP1B-1 Human QA closes.

---

## 10. Rollback

```bash
git revert <HEADER_STATUS_FIX_COMMIT>
# rebuild frontend; no migration
```
