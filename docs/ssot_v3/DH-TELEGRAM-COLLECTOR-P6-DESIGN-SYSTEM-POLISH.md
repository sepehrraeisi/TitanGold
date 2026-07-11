# DH-TELEGRAM-COLLECTOR-P6 — Design System Polish

**Phase:** P6 (UI/UX only)  
**Status:** COMPLETE (Human QA repair verified 2026-06-29)  
**Scope:** Telegram Collector analytics UI — i18n, enum labels, AI Inbox polish, production deploy verification.

---

## Goal

Bring the entire Telegram Collector analytics UI to the same design quality as Automation Routing, Data Archiving, Telegram Publisher, Data Pipeline, and the DataHub Design System (`DESIGN_SYSTEM_DATAHUB.md`).

---

## Phase 1 — Design Audit (Before)

| Area | Legacy issue |
|------|----------------|
| **Global toolbar** | Custom pill buttons for time range (`border-slate-700`, inline purple active); Refresh used ad-hoc sizing |
| **Tab navigation** | `DataHubSubTabBar` used but without `activeVariant: 'telegram'` (sky accent) |
| **Overview metrics** | Inline gradient divs instead of `MetricCard` |
| **Overview stats grid** | `bg-slate-900/60 rounded-lg` flat boxes |
| **AI Inbox** | Custom spinners, manual purple category badges, no `StatusPill` |
| **Categories** | Duplicate time-range/chart-type button styles; inline stat cards |
| **Breaking News** | Dynamic Tailwind (`border-${color}-500`) — broken at runtime; custom modals; no shared components |
| **Geographic Map** | Gradient refresh button; inline stat cards; custom controls |
| **Agent Detail** | Legacy filters, badges, buttons across feed + modal |
| **Loading / empty** | Per-file spinners instead of `DataHubLoadingSpinner` / `DataHubEmpty` |
| **Errors** | Inline red boxes instead of `DataHubAlert` |

---

## Phase 2–3 — Toolbar & Tabs (After)

### Toolbar
- **Time Range** → `DataHubSegmentedControl` with `TIME_RANGE_OPTIONS_SHORT` (24h / 2d / 7d)
- **Refresh** → `PrimaryButton` (`BTN_PRIMARY` tokens: height, radius, typography)
- Layout → `DataHubToolbar` + responsive wrap

### Tabs
- All five analytics tabs use `DataHubSubTabBar` with `activeVariant: 'telegram'` (sky underline)
- Keyboard: native `role="tab"` / `aria-selected`; focus ring on segmented control

**File:** `components/ai/AIManager/tabs/DataHub/TelegramDataPanel.tsx`

---

## Phase 4 — Overview

- Top pipeline metrics → `MetricCard` (emerald / blue / purple)
- Overview section → `DataHubSectionHeader` + 6× `MetricCard`
- Loading → `DataHubLoadingSpinner`; empty → `DataHubEmpty`

---

## Phase 5 — AI Inbox

- List cards: sky hover ring (telegram variant), focus-visible ring
- Category chips → `StatusPill variant="primary"`
- Agent detail delegated to shared components (see Phase 9)

---

## Phase 6 — Categories

- Controls → `DataHubSegmentedControl` (time + chart type) + `PrimaryButton` refresh
- Stats row → `MetricCard`
- Chart shell → `DATAHUB_SHELL` + `DataHubSectionHeader`
- Category cards → `DATAHUB_INNER_LIST` + sky selection ring
- Timeline → `DataHubAlert` / `DataHubEmpty` / `DataHubLoadingSpinner`

**File:** `CategoryBreakdown.tsx`

---

## Phase 7 — Breaking News

- Header + filters → `DataHubSectionHeader`, `DataHubToolbar`, `DataHubFilterBar`
- Severity filter → `DataHubSegmentedControl`
- Toggles → `DataHubToggle` (sound, auto-refresh)
- Metrics row → 4× `MetricCard`
- Headlines → `StatusPill`, fixed `border-l-*` severity classes (no dynamic Tailwind)
- Actions → `PrimaryButton` / `SecondaryButton`
- Detail view → `DataHubModal`
- Alerts → `DataHubAlert`; empty/loading → shared components

**File:** `BreakingNewsMonitor.tsx`

---

## Phase 8 — Geographic Map

- Controls → `DataHubSegmentedControl` + `SELECT_CLASS` + `PrimaryButton`
- Stats → `MetricCard`
- Map shell → `DATAHUB_SHELL` + `DataHubSectionHeader`
- Region detail → `MetricCard` + `StatusPill`
- Region table → `DATAHUB_SHELL`

**File:** `GeographicHeatMap.tsx`

---

## Phase 9 — Component Consolidation

### New shared exports (`dataHubUi.tsx`)

| Component | Purpose |
|-----------|---------|
| `DataHubSegmentedControl` | Time range, chart type, severity filters |
| `PrimaryButton` / `SecondaryButton` | Standard actions with focus ring |
| `DataHubLoadingSpinner` | Unified loading states |
| `DataHubToolbar` / `DataHubFilterBar` | Toolbar layout |
| `DataHubSearchInput` | Search (ready for future inbox search) |
| `formatTimeRangeLabel` / `TIME_RANGE_OPTIONS*` | Shared time labels |
| `severityVariant` / `sentimentVariant` | StatusPill mapping |

### Reused existing
`DATAHUB_SHELL`, `DATAHUB_INNER_LIST`, `MetricCard`, `StatusPill`, `DataHubAlert`, `DataHubEmpty`, `DataHubSectionHeader`, `DataHubSubTabBar`, `DataHubModal`, `DataHubToggle`, `SELECT_CLASS`, `BTN_PRIMARY`

### Files touched (UI only)
- `dataHubUi.tsx`
- `TelegramDataPanel.tsx`
- `CategoryBreakdown.tsx`
- `BreakingNewsMonitor.tsx`
- `GeographicHeatMap.tsx`
- `AgentDetailPanel.tsx`

---

## Phase 10–12 — Consistency, Responsive, A11y

- **Spacing:** `gap-2 md:gap-3` metric grids; `p-4 md:p-5` shells
- **Typography:** `text-[11px]` labels, `text-sm` values (MetricCard)
- **Buttons:** uniform `text-[11px] px-3 py-1.5 rounded-full`
- **Responsive:** `DataHubToolbar` flex-wrap; tab bar horizontal scroll
- **A11y:** `aria-label` on segmented controls; `aria-pressed`; focus-visible rings; `role="status"` on spinner

---

## Phase 13 — Browser QA

**Script:** `backend/scripts/telegram-collector-p6-audit.mjs`  
**Evidence:** `docs/ssot_v3/screenshots/telegram-collector-p6-browser-evidence.json`

| Screenshot | File |
|------------|------|
| Toolbar | `telegram-collector-p6-toolbar.png` |
| Overview | `telegram-collector-p6-overview.png` |
| AI Inbox | `telegram-collector-p6-ai-inbox.png` |
| Categories | `telegram-collector-p6-categories.png` |
| Breaking News | `telegram-collector-p6-breaking-news.png` |
| Geographic Map | `telegram-collector-p6-geographic-map.png` |

**Tab checks (2026-06-28):** All 5 analytics tabs loaded — no Resource not found / Request failed. Segmented control present on each tab.

> **Note:** Production screenshots reflect deployed bundle. After deploy of this commit, re-run audit to capture post-P6 visual evidence on live app.

---

## Phase 14 — No Regression

| Flow | Status |
|------|--------|
| Login / Import / Sync / Health / Accounts / Channels | Unchanged (TelegramPanel not modified in P6) |
| Overview tab | ✅ Loads |
| AI Inbox tab | ✅ Loads |
| Categories tab | ✅ Loads |
| Breaking tab | ✅ Loads |
| Geographic tab | ✅ Loads |
| API contracts | ✅ No changes |
| `npm run build` | ✅ Pass |

---

## Phase 15 — Deliverables

- [x] Design audit (this document)
- [x] Shared components introduced
- [x] Legacy styling replaced in analytics screens
- [x] Browser evidence + screenshots
- [x] Build verification
- [x] UI-only commit scope

**Suggested commit:** `style(datahub): redesign telegram collector to unified design system`

---

## Before / After Summary

| Before | After |
|--------|-------|
| Custom time-range pills per screen | Single `DataHubSegmentedControl` |
| Inline gradient metric divs | `MetricCard` everywhere |
| Ad-hoc refresh buttons | `PrimaryButton` |
| Purple-only sub-tabs | Telegram sky variant sub-tabs |
| Broken dynamic severity borders | Explicit `border-l-red/amber/emerald-500` |
| Custom modal markup | `DataHubModal` |
| Per-component spinners | `DataHubLoadingSpinner` |
| Custom modal markup | `DataHubModal` |

---

## Human QA Repair — i18n, enum labels, AI Inbox, production deploy

### Human QA rejection (initial P6)

Human QA rejected the first P6 pass as **PARTIAL**:

| Issue | Symptom |
|-------|---------|
| Missing i18n | Raw keys on Overview / AI Inbox (`telegram_data_overview_desc`, `processed_messages`, …) |
| AI Inbox | Incomplete redesign; raw `telegram_ai_inbox_desc`; technical agent-feed error |
| Breaking News | Raw enums (`medium_term`, `SANCTIONS_EMBARGO`, `FOREX_CURRENCY`) |
| Geographic Map | Raw region/category enums (`MIDDLE_EAST`, `PRECIOUS_METALS`, …) |
| Evidence | Pre-deploy screenshots — not acceptable for final sign-off |

### Root cause

1. Locale keys added to some files but not all four active locale bundles (`deploy/blue|green/locales/en|fa.json`).
2. Backend enum values rendered directly without a shared label helper.
3. Agent feed endpoint timed out at nginx (30s) → UI showed raw API-unavailable string.
4. Production bundle not rebuilt/re-verified after locale/UI changes.

### Fixes

| Area | Change |
|------|--------|
| **i18n** | Added all missing Telegram Collector keys to 4 locale files; `telegramCollectorI18n.test.ts` scans components |
| **Labels** | New `telegramCollectorLabels.ts` — `formatNewsCategoryLabel`, `formatRegionLabel`, `formatTimeHorizonLabel`, `formatSeverityLabel`, `formatTopicLabel`, `formatAgentKeyLabel`, `humanizeEnum` |
| **Overview** | Removed `\|\|` fallbacks that masked missing keys; metrics use `t()` only |
| **AI Inbox** | Full DataHub shell: `MetricCard` summary, `DataHubSearchInput`, agent grid, detail panel |
| **Agent feed** | Removed `"Agent feed API is not available yet…"`; `DataHubEmpty` with `telegram_agent_feed_not_configured`; backend feed route cached + nginx 180s timeout for `/api/v1/telegram/agents/` |
| **Breaking News** | StatusPill + label helpers for category, region, horizon, assets, agents |
| **Geographic Map** | Region/category labels via helpers in filters, table, detail |
| **Categories** | Replaced static `CATEGORY_LABELS` with `formatNewsCategoryLabel` |

### Production deploy proof

| Check | Result |
|-------|--------|
| `npm run build` | ✅ Pass |
| Bundle hash (post-repair) | `DataHubTab-ChaCRDHu.js` (was `DataHubTab-BREOI89i.js` pre-repair) |
| nginx root | `/home/ubuntu/webapp/TitanGold/dist` |
| Hard-refresh audit | `backend/scripts/telegram-collector-p6-repair-audit.mjs` |

### Browser evidence (post-deploy)

**Script:** `backend/scripts/telegram-collector-p6-repair-audit.mjs`  
**Evidence:** `docs/ssot_v3/screenshots/telegram-collector-p6-repair-browser-evidence.json`  
**Captured:** 2026-06-29T11:08:41Z @ https://titan.zala.ir

| Tab | rawKeys | rawEnums | forbiddenTexts |
|-----|---------|----------|----------------|
| Overview | [] | [] | [] |
| AI Inbox | [] | [] | [] |
| Categories | [] | [] | [] |
| Breaking News | [] | [] | [] |
| Geographic Map | [] | [] | [] |

**Screenshots:**

| Tab | File |
|-----|------|
| Overview | `telegram-collector-p6-repair-overview.png` |
| AI Inbox | `telegram-collector-p6-repair-ai-inbox.png` |
| Categories | `telegram-collector-p6-repair-categories.png` |
| Breaking News | `telegram-collector-p6-repair-breaking-news.png` |
| Geographic Map | `telegram-collector-p6-repair-geographic-map.png` |

All Telegram API calls returned **200** during audit.

### Tests / build

```
vitest: telegramCollectorI18n, telegramCollectorLabels (+ P3/P4/errors) — 36 passed
npm run build — pass
```

### Final verdict

**P6 COMPLETE** — all five tabs pass post-deploy browser verification; no raw i18n keys or Human QA enum strings; AI Inbox redesigned; agent-feed error replaced with designed empty state; production bundle verified.

**Commit:** `fix(datahub): complete telegram collector i18n and design polish`
