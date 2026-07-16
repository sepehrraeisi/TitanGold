# ARB-WP1B-1 Closeout — AgentControlShell Migration and Viewport-Safe Panel Frame

**Module:** AI → Agents → Arbitrage Scanner  
**Work Package:** ARB-WP1B-1  
**Date:** 2026-07-16  
**Human QA:** PENDING (ARB-B1 … ARB-B4)  
**Engineering verdict (pre-Human-QA):** **NEEDS MORE VERIFICATION**  

**Not closed:** ARB-WP1B-1 awaits Human PASS. ARB-WP1B-2 **NOT STARTED**.

**WP1A baseline (frozen):** runtime `f4fd43a` · docs `dddb55a`

---

## 1. RCA

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

- **`AgentControlShell`:** overlay, viewport-safe frame, sticky header, Escape, focus trap/restoration, body overflow lock, default Close (DS Secondary), optional `belowHeader`, single body scroll (`data-scroll-owner` / `agent-control-shell-body`).  
- **Arbitrage:** purpose text, Run Scan handler, Pause/Restart, tabs, WP1A data, settings draft/save/reset, all tab content.  
- **No Arbitrage-specific business logic** added to the shell.  
- **Data Hub / Agents Shell pages:** not modified. `dataHubUi.tsx` not modified in this slice.

---

## 3. Scroll owner

**One intentional scroll region:** `#agent-control-shell-body` / `[data-testid="agent-control-shell-body"]`.

Header, safety strip, status row, analytical banner, and tablist are `shrink-0` outside that region.

---

## 4. Tests

| Suite | Executed | Passed | Failed | Env |
|-------|----------|--------|--------|-----|
| `ArbitrageAgentControl.wp1a.test.tsx` | 6 | 6 | 0 | vitest/jsdom |
| `ArbitrageAgentControl.wp1b1.test.tsx` | 7 | 7 | 0 | vitest/jsdom |

---

## 5. Browser QA

Filled after Staging deployment (supporting evidence). Human QA is final.

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
### ARB-B2 — Viewport and Scroll
### ARB-B3 — Keyboard and Focus
### ARB-B4 — Navigation and Regression

Human must explicitly PASS ARB-B1 through ARB-B4.

---

## 9. Remaining work

- **ARB-WP1B-2:** full per-tab content redesign / IA polish — **NOT STARTED**  
- Do not begin until WP1B-1 Human QA closes.

---

## 10. Rollback

```bash
git revert <WP1B1_COMMITS>
# rebuild frontend; no migration
```
