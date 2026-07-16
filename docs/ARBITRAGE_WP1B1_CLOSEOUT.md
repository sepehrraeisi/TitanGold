# ARB-WP1B-1 Closeout — AgentControlShell Migration and Viewport-Safe Panel Frame

**Module:** AI → Agents → Arbitrage Scanner  
**Work Package:** ARB-WP1B-1  
**Date:** 2026-07-16  

## Final status

| Item | Value |
|------|--------|
| Human QA | **PASS** (ARB-B1 … ARB-B4) |
| Engineering verdict | **REAL WORKING** |
| ARB-WP1B-1 | **CLOSED AND FROZEN** |
| Arbitrage Agent | **OPEN** — additional per-tab redesign slices remain |
| ARB-WP1B-2 | **NOT STARTED** |

## Final distinction (do not confuse)

| Kind | Value |
|------|--------|
| **Runtime implementation baseline** | `a9d6a5e` (`fix(arb): clarify shared shell runtime statuses`) — owns currently served runtime source (shell migration `5d078e7` + status clarification) |
| **Pre-closeout documentation HEAD** | `058da19` |
| **Documentation closeout HEAD** | *(this commit after push)* |
| **Served frontend bundle** | `assets/index-D6ZmsjWR.js` |
| **Environment** | Staging `https://titan.zala.ir` |

This documentation-only closeout did **not** rebuild or redeploy the application. The served bundle continues to match runtime baseline `a9d6a5e`.

**WP1A baseline (frozen):** runtime `f4fd43a` · docs `dddb55a`

---

## Human QA

| Scenario | Result |
|----------|--------|
| ARB-B1 Shared Shell and Header | **PASS** |
| ARB-B2 Viewport and Scroll | **PASS** |
| ARB-B3 Keyboard and Focus | **PASS** |
| ARB-B4 Navigation and Regression | **PASS** |
| Human-QA final verdict | **PASS** |

Confirmed Human behavior:

- Shared `AgentControlShell` frame works
- Header and statuses are clear
- No raw `DRY_RUN`; Dry Run shown once
- Broker displayed as Offline
- Desktop, tablet, and mobile pass
- Scroll containment passes; Close and actions remain reachable
- Tab/Shift+Tab remain inside the panel; Escape closes; focus returns to Open Agent
- All six tabs work; WP1A data remains correct
- Six approved action-button variants remain correct
- English and Persian pass; dark theme passes
- No raw keys or visible regression found

---

## Implementation summary

### AgentControlShell migration (`5d078e7`)

- Arbitrage panel frame migrated to shared `AgentControlShell`
- Shell owns: overlay, viewport-safe frame, header chrome, Escape, focus trap/restoration, body overflow lock, Close, single body scroll owner
- Arbitrage owns: purpose, Run Scan / Pause / Restart, tabs, WP1A data, settings draft/save/reset, tab content
- One intentional scroll region: `[data-testid="agent-control-shell-body"]`
- Local overlay/header frame removed (no duplicate shell implementation)

### Status clarification (`a9d6a5e`)

- Removed raw `DRY_RUN` / `Active: DRY_RUN`
- Dry Run shown once via localized `execution_mode_*`
- Broker: `Online` / `Offline` (no `Broker: Broker offline`)
- Operational chrome shows Active (filter vocabulary `ready` unchanged for Agents Shell)
- Safety strip: `Emergency Stop: Active · Broker: Offline` + short Live-block line

### Preserved

- WP1A business contracts and truthful analytical semantics
- Six approved button variants (Run Scan primary, Close neutral, Pause amber, Restart blue, Reset neutral, Save primary)
- English / Persian direction and labels
- Responsive shell behavior
- Data Hub and Agents Shell untouched

---

## Evidence

### Automated tests (at implementation time)

| Suite | Executed | Passed | Failed | Env |
|-------|----------|--------|--------|-----|
| `agentCardMeta.test.ts` | 6 | 6 | 0 | vitest/jsdom |
| `ArbitrageAgentControl.wp1a.test.tsx` | 6 | 6 | 0 | vitest/jsdom |
| `ArbitrageAgentControl.wp1b1.test.tsx` | 7 | 7 | 0 | vitest/jsdom |
| `ArbitrageAgentControl.wp1b1.status.test.tsx` | 3 | 3 | 0 | vitest/jsdom |

**Total:** 22 executed · 22 passed · 0 failed · 0 skipped

### Browser QA (Staging)

Served bundle `assets/index-D6ZmsjWR.js` · runtime baseline `a9d6a5e`

| Check | Result |
|-------|--------|
| Shared shell / header / statuses | PASS (Human) |
| No raw `DRY_RUN`; one Dry Run | PASS (Human + engineering) |
| Broker Offline presentation | PASS (Human) |
| Viewport / scroll / Close reachable | PASS (Human) |
| Keyboard / Escape / focus restore | PASS (Human) |
| Six tabs / WP1A / six buttons / EN / FA / dark | PASS (Human) |

### Runtime safety (passive closeout check — no mutations)

- requestedMode / globalRuntimeMode: demo
- effectiveMode: demo (UI Dry Run under Emergency Stop gate)
- killSwitchActive: true
- workerAcknowledged: true
- providerConnected: false (Broker Offline)
- deploymentEngineEnabled: false
- Live impossible

### Git commits (ARB-WP1B-1)

| Commit | Role |
|--------|------|
| `5d078e7` | Runtime — AgentControlShell migration |
| `82f19cb` | Docs — initial Browser QA evidence |
| `a9d6a5e` | Runtime — status clarification (**final runtime baseline**) |
| `058da19` | Docs — header-status Browser QA evidence |
| *(closeout)* | Docs — Human QA closeout |

### Protected unrelated files

Never touched / never staged:

- `scripts/backup-db.sh`
- `scripts/phase2-monitoring/titangold-backup-healthcheck.sh`
- `scripts/phase2-monitoring/titangold-telegram-notify.sh`

### Closed baselines verification

- Data Hub: untouched
- Agents Shell: untouched
- ARB-WP1A contracts: untouched

---

## Ownership (frame)

| Concern | Owner |
|---------|--------|
| Overlay / viewport / Escape / focus / scroll body | `AgentControlShell` |
| Header identity + generic status presentation | `AgentControlShell` |
| Arbitrage purpose, handlers, tabs, WP1A content | `ArbitrageAgentControl` |

---

## Rollback

```bash
# Revert runtime only if needed (rebuild frontend after):
git revert a9d6a5e   # status clarification
git revert 5d078e7   # shell migration
# rebuild + redeploy frontend; no database migration
```

Documentation-only commits (`82f19cb`, `058da19`, this closeout) do not change served runtime.

---

## Remaining work

- **ARB-WP1B-2:** full per-tab content redesign / information architecture polish — **NOT STARTED**
- Do not begin ARB-WP1B-2 until explicitly authorized
- Arbitrage Agent remains **OPEN** for subsequent vertical slices

---

## Stop

ARB-WP1B-1 is **CLOSED AND FROZEN**.  
Do not begin ARB-WP1B-2 in this closeout.
