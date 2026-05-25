# DataHub — Design Backlog (post backend-first)

> Backend status از SSOT v3.0؛ Design status از مقایسه با `DESIGN_SYSTEM_DATAHUB.md`.  
> Severity: **High** = کاربر واضح «قدیمی» می‌بیند · **Medium** = ناسازگاری جزئی · **Low** = polish

## Phases (status)

| Phase | Scope | Status |
|-------|--------|--------|
| **Design-0** | Shared `dataHubUi.tsx` | **Done** |
| **Design-1** | sources, categories, modals | **Done** |
| **Design-2** | pipeline, logs | **Done** |
| **Design-3** | advanced.telegramPublisher, advanced.automation | **Done** |
| **Design-4** | i18n sweep (remaining advanced subtabs) | Open |

---

## Core tabs — Design: Done

| Tab | Backend | Design | Notes |
|-----|---------|--------|-------|
| `dataHub.sources` | Implemented | **Done** | Design-1 + **Sources i18n fallback cleanup** (`CreateSourceModal` — no `t() \|\| '…'`) |
| `dataHub.categories` | Implemented | **Done** | Design-1 |
| `dataHub.pipeline` | Implemented | **Done** | Design-2 — no stale Open rows |
| `dataHub.logs` | Implemented | **Done** | Design-2 — no stale Open rows |

### `dataHub.sources` — item checklist (all Done)

| # | Item | Status |
|---|------|--------|
| S1–S4 | Shell, modal §10, alerts, i18n panels | **Done** |
| — | CreateSourceModal i18n cleanup | **Done** |

### `dataHub.categories` — item checklist (all Done)

| # | Item | Status |
|---|------|--------|
| C1–C5 | Shell, filters, modal, cards, inline loading | **Done** |

### `dataHub.pipeline` — item checklist (all Done)

| # | Item | Status |
|---|------|--------|
| P1–P4 | Metrics, snapshot select, tables, `DATAHUB_SHELL` | **Done** |

### `dataHub.logs` — item checklist (all Done)

| # | Item | Status |
|---|------|--------|
| L1–L4 | Slate table, filters, pills, telegram UX | **Done** |

---

## `dataHub.advanced.*`

### `advanced.telegramPublisher` — Backend: Implemented · **Design: Done** (Design-3)

| # | Mismatch | Phase | Status |
|---|----------|-------|--------|
| TP1 | Root slate shell | Design-3 | **Done** |
| TP2 | Metrics/actions vs spec | Design-3 | **Done** |
| TP3 | Create channel → `DataHubModal` §10 | Design-3 | **Done** |
| TP4 | History slate blocks §13 | Design-3 | **Done** |

### `advanced.automation` — Backend: Implemented · **Design: Done** (Design-3)

| # | Mismatch | Phase | Status |
|---|----------|-------|--------|
| A1 | Root slate shell | Design-3 | **Done** |
| A2 | Topic list slate cards | Design-3 | **Done** |
| A3 | Topic/queue modals §10 | Design-3 | **Done** |
| A4 | Schedule `DataHubToggle` §12 | Design-3 | **Done** |
| A5 | Queue table + outline actions | Design-3 | **Done** |

### `advanced.access` — **Design: Done** (GAP-022)

| # | Status |
|---|--------|
| AC1–AC5 | **Done** — `AccessControlPanel.tsx` + API |

### `advanced.blacklist` · `crawlers` · `discovery` · `prioritization` · `archiving`

| Subtab | Backend | Design | Phase |
|--------|---------|--------|-------|
| blacklist | **Implemented · Design: Done** | GAP-024 closed | Backend-first `datahub_filter_rules` |
| crawlers | Partial | Not started | Post Design-3 |
| discovery | Partial | Not started | Post Design-3 |
| prioritization | Partial | Not started | Post Design-3 |
| archiving | Partial | Not started | Post Design-3 |

---

## GAP cross-reference (design)

| GAP | Title | Status |
|-----|-------|--------|
| GAP-007 | Frontend chunk size >500KB (DataHubTab bundle) | **Open** v3.1 — build passes; not a Design blocker |
| GAP-021 | Core tabs design pass | **Closed** (Design-1/2) |
| GAP-022 | Access Control + design | **Closed** |
| GAP-023 | Advanced subtabs design | **Partial** — **Done:** publisher, automation, access, blacklist · **Pending:** crawlers, discovery, prioritization, archiving |
| GAP-024 | Blacklist backend-first + design | **Closed** — see `BLACKLIST_WHITELIST_API_CONTRACT.md` |
| GAP-026 | Crawlers backend-first + design | **Open** — draft `CRAWLERS_API_CONTRACT.md` (awaiting approval) |

---

## SSOT rule (enforced)

- **Implemented · Design: Done** = backend wired + full UI pass per `DESIGN_SYSTEM_DATAHUB.md` + i18n + `DataHub_DEMOS.md` visual steps + `npm run build` pass.
