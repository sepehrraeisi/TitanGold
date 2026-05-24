# DataHub — Design Backlog (post backend-first)

> Backend status از SSOT v3.0؛ Design status از مقایسه با `DESIGN_SYSTEM_DATAHUB.md`.  
> Severity: **High** = کاربر واضح «قدیمی» می‌بیند · **Medium** = ناسازگاری جزئی · **Low** = polish

## Phases

| Phase | Scope | Target |
|-------|--------|--------|
| **Design-0** | Shared primitives | `DataHubModal`, `DataHubMetricGrid`, `DataHubStatusPill`, `DataHubToggle`, section shell |
| **Design-1** | Core tabs + modals | sources, categories, create/edit modals |
| **Design-2** | Pipeline + logs | pipeline metrics/history table, logs table/filters |
| **Design-3** | Advanced (per subtab) | هر subtab با همان workflow subsection |
| **Design-4** | i18n sweep | en/fa keys برای تمام DataHub |

---

## `dataHub.sources` — Backend: Implemented

| # | Mismatch | Severity | Phase |
|---|----------|----------|-------|
| S1 | Modals (`CreateSourceModal`) هنوز `bg-card` / `bg-secondary` inputs | High | Design-1 |
| S2 | Error banners `text-sm` — spec `text-[11px]` §11 | Low | Design-1 |
| S3 | Outer wrapper از `Card` parent در DataHubTab — verify slate shell | Medium | Design-1 |
| S4 | i18n: برخی دکمه‌ها فقط fallback EN | Medium | Design-4 |

**Note:** لیست source rows و دکمه‌های `rounded-full purple` نسبتاً هم‌راستا — **Partial design pass**.

---

## `dataHub.categories` — Backend: Implemented

| # | Mismatch | Severity | Phase |
|---|----------|----------|-------|
| C1 | Shell `Card` + `border-border` not slate glass | High | Design-1 |
| C2 | فیلتر inputs `bg-background border-border` | High | Design-1 |
| C3 | `CreateCategoryModal` modal pattern قدیمی | High | Design-1 |
| C4 | Category cards/list not `bg-slate-900/60 border-white/5` | Medium | Design-1 |
| C5 | ApiWrapper loading overlay | Medium | Design-1 |

---

## `dataHub.pipeline` — Backend: Implemented

| # | Mismatch | Severity | Phase |
|---|----------|----------|-------|
| P1 | Metric blocks not gradient mini-cards §2.4 | High | Design-2 |
| P2 | History/snapshot selector generic styling | Medium | Design-2 |
| P3 | Normalized data table not §9 slate borders | High | Design-2 |
| P4 | `Card` wrapper dependency | Medium | Design-2 |

---

## `dataHub.logs` — Backend: Implemented

| # | Mismatch | Severity | Phase |
|---|----------|----------|-------|
| L1 | Table thead `border-border` | High | Design-2 |
| L2 | Filters/selects not `bg-slate-900 border-slate-700` | High | Design-2 |
| L3 | Status cells not semantic pills §7 | Medium | Design-2 |
| L4 | Telegram error UX — OK logic; visual not spec | Low | Design-2 |

---

## `dataHub.advanced.*`

### `advanced.telegramPublisher` — Backend: Implemented

| # | Mismatch | Severity | Phase |
|---|----------|----------|-------|
| TP1 | Root `bg-card border-border` | High | Design-3 |
| TP2 | `SummaryCard` / `ActionButton` / `StatusBadge` vs spec | High | Design-3 |
| TP3 | Inline create form not modal shell §10 | Medium | Design-3 |
| TP4 | History list not slate item blocks §13 | Medium | Design-3 |

### `advanced.automation` — Backend: Implemented

| # | Mismatch | Severity | Phase |
|---|----------|----------|-------|
| A1 | Root `bg-card` shell | High | Design-3 |
| A2 | `AutomationTopicList` uses `bg-secondary/5`, `topic.name` layout | Medium | Design-3 |
| A3 | `AutomationTopicModal` / `QueuePreviewModal` old modal | High | Design-3 |
| A4 | Schedule panel toggle not §12 | Medium | Design-3 |
| A5 | Queue manager `ActionButton` stack | Medium | Design-3 |

### `advanced.access` — Backend: Partial → **next workflow**

| # | Mismatch | Severity | Phase |
|---|----------|----------|-------|
| AC1 | IndexedDB + placeholder tabs (roles/keys/ip) | High | **GAP-022 wiring** |
| AC2 | `bg-card`, fake metrics (API keys=12) | High | **this PR + design** |
| AC3 | Bug: `filteredSources` typo `query =>` | High | fix in wiring |
| AC4 | Table/modals not spec | High | design in same PR |
| AC5 | No `GET` list-all ACL API | Medium | **GAP-022** |

### `advanced.blacklist` · `crawlers` · `discovery` · `prioritization` · `archiving`

| Subtab | Backend | Design debt | Phase |
|--------|---------|-------------|-------|
| blacklist | Partial / IndexedDB | High — `bg-card`, lists | Design-3 |
| crawlers | Partial | High | Design-3 |
| discovery | Partial | High | Design-3 |
| prioritization | Partial | High | Design-3 |
| archiving | Partial | High | Design-3 |

---

## GAP cross-reference (design)

| GAP | Title | Phase |
|-----|-------|-------|
| GAP-021 | DataHub Design Pass — core tabs (sources→logs) | Design-1–2 |
| GAP-022 | Access Control backend-first + UI (permissions scope) | **Now** |
| GAP-023 | DataHub Design Pass — advanced subtabs (post access) | Design-3 |

---

## SSOT rule (enforced)

تا Design column = **Done** برای یک tab:

- SSOT Status ≤ **Implemented (backend)** یا **Partial**
- پس از Design Done → **Implemented** نهایی

`dataHub.advanced.automation` = Implemented (backend) · Design = **Not started** (see backlog A1–A5).
