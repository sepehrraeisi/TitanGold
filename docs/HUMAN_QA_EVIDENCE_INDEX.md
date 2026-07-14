# Human QA Evidence Index

Engineering automated checks ≠ Human visual approval.  
Runtime during capture: **demo**, Kill Switch **active**, worker acknowledged, engine disabled, brokers **0**.

Screenshot root: `e2e/screenshots/` (gitignored binaries; available on staging host).  
Playwright suites: `agent-panels`, `artemis-tabs`, `topic-routing-browser`, `pre-human-qa`, `runtime-safety`.

---

## Global Surfaces

| Surface | Roles | Screenshots | Playwright | Automated check | Human visual |
|---------|-------|-------------|------------|-----------------|--------------|
| Header / runtime status | admin, trader, user | `agents-banner-*.png`, `pre-qa-home.png` | `pre-human-qa`, `agent-panels` banner | Suite PASS | ⬚ pending |
| Agents parent page | admin, trader, user | `agents-banner-*`, `agents-mobile-*` | `agent-panels` | Suite PASS | ⬚ pending |
| Topic Routing | admin, user | `topic-routing-admin.png`, `topic-routing-user.png` | `topic-routing-browser` | Suite PASS | ⬚ pending |
| Artemis navigation | admin, trader, user | `artemis-overview-*` (tabs visible) | `artemis-tabs` | Suite PASS | ⬚ pending |

---

## Agent Panels (15)

Shared architecture: lazy `*AgentControl` chunk + Agents shell. Permission: capability-gated; live-capable actions fail-closed under Kill Switch / demo. Expected Dry Run: no real exchange order.

| Agent | Category | Screenshots (admin / trader / user) | Mobile | Dark | Playwright | Expected permission | Human visual |
|-------|----------|-------------------------------------|--------|------|------------|---------------------|--------------|
| technical | Analytical | `panel-technical-{role}.png` | via agents-mobile | dark UI | agent-panels | read+safe run (role caps) | ⬚ |
| risk | Analytical | `panel-risk-*` | same | dark | agent-panels | same | ⬚ |
| sentiment | Provider/LLM | `panel-sentiment-*` | same | dark | agent-panels | same | ⬚ |
| pattern | Analytical | `panel-pattern-*` | same | dark | agent-panels | same | ⬚ |
| price_prediction | Analytical | `panel-price_prediction-*` | same | dark | agent-panels | same | ⬚ |
| arbitrage | Market-data | `panel-arbitrage-*` | same | dark | agent-panels | same | ⬚ |
| portfolio | Analytical | `panel-portfolio-*` | same | dark | agent-panels | same | ⬚ |
| liquidity | Market-data | `panel-liquidity-*` | same | dark | agent-panels | same | ⬚ |
| trend_detection | Analytical | `panel-trend_detection-*` | same | dark | agent-panels | same | ⬚ |
| optimization | Analytical | `panel-optimization-*` | same | dark | agent-panels | same | ⬚ |
| order | Order/live-capable | `panel-order-*` | same | dark | agent-panels | order paths denied under KS | ⬚ |
| fundamental | Provider/LLM | `panel-fundamental-*` | same | dark | agent-panels | same | ⬚ |
| market_intelligence | Market-data | `panel-market_intelligence-*` | same | dark | agent-panels | same | ⬚ |
| volume | Analytical | `panel-volume-*` | same | dark | agent-panels | same | ⬚ |
| timing | Analytical | `panel-timing-*` | same | dark | agent-panels | same | ⬚ |

**Known limitations (all panels):** staging MEXC ticker proxy may 404; agent WebSocket may return 400 — documented console noise; does not authorize Live execution.

---

## Artemis Tabs

| Tab | Screenshots | Playwright | Automated | Human visual |
|-----|-------------|------------|-----------|--------------|
| Overview | `artemis-overview-{role}.png` | artemis-tabs | PASS | ⬚ |
| Decision Engine | `artemis-decision_engine-*` | artemis-tabs | PASS | ⬚ |
| Agent Orchestration | `artemis-orchestration-*` | artemis-tabs | PASS | ⬚ |
| Trading Scenarios | `artemis-scenarios-*` | artemis-tabs | PASS | ⬚ |
| Artemis Settings | `artemis-settings-*` | artemis-tabs | PASS | ⬚ |
| Autopilot | `artemis-autopilot-*` | artemis-tabs | PASS | ⬚ |

Also: `artemis-keyboard-*`, `artemis-refresh-*`.

---

## Design Review Criteria (Human)

For every surface tick Layout, Spacing, Cards, Typography, Badges, Loading, Empty, Error, Forms, Actions, Confirmations, Accessibility, Keyboard, Responsive, Dark theme, i18n, Overflow, Runtime-state clarity, Permission clarity, Dry Run clarity.

Automated engineering review notes: `docs/evidence/design-system-manual-review-20260714.md` (engineering only — not Human PASS).
