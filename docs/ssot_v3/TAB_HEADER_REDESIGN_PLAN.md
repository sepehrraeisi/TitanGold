# Phase UX-1 — Tab/Header Redesign Plan

> **Status:** Audit + implementation plan (no code yet)  
> **Date:** 2026-05-29  
> **Design reference:** [`DESIGN_SYSTEM_DATAHUB.md`](../../DESIGN_SYSTEM_DATAHUB.md)  
> **Related:** [`DATAHUB_SETTINGS_DEPENDENCY_AUDIT.md`](./DATAHUB_SETTINGS_DEPENDENCY_AUDIT.md), [`DATAHUB_DESIGN_BACKLOG.md`](./DATAHUB_DESIGN_BACKLOG.md)

---

## Problem statement

DataHub **panel content** has been redesigned to the slate/glass design system (`DATAHUB_SHELL`, pills, metrics, tables). **Tab bars and section headers** remain **inconsistent**:

| Layer | Current state |
|-------|---------------|
| AI Center / AI Manager | App-theme underline tabs (`border-b-2`, `bg-card`, `border-border`) |
| DataHub main + Advanced | New pill strip (slate container) — **inline duplicated** |
| Internal DataHub panels | Mixed: pill strip, underline, or text-only tabs |

Users perceive a **legacy shell around modern panels**. Goal: one coherent tab/header language without re-redesigning panel bodies.

---

## Design reference (from DESIGN_SYSTEM_DATAHUB.md)

The design system does not define a dedicated “Tabs” section, but these rules apply:

| Rule | Source | Application to tabs |
|------|--------|---------------------|
| Dark slate glass | §2.1, §5 | Tab **container**: `bg-slate-950/70 border border-white/5 rounded-xl` |
| Primary actions | §6.1 | Active tab (default): `bg-purple-600/20 border-purple-500/60 text-purple-300` |
| Telegram accent | §2.3 | Telegram-related active: `bg-sky-500/15 border-sky-500/60 text-sky-300` |
| Evaluate / warning accent | §2.3 | Special actions (e.g. evaluate): `bg-amber-500/15 border-amber-500/60 text-amber-300` |
| Inactive chip | §6 + panels | `bg-slate-900/60 border-white/5 text-muted-foreground` |
| Typography | §3 | Tab label: `text-xs font-medium`; section title: `text-sm md:text-base font-semibold` |
| Responsive | §14 | `overflow-x-auto no-scrollbar`, `whitespace-nowrap`, `gap-2` |
| Section header | §3–§4 | Title + `text-[11px] text-muted-foreground` subtitle; `flex-col md:flex-row` |

**Reference implementation:** pill strip already in `DataHubTab.tsx` and `AdvancedFeatures.tsx`; **underline sub-tabs** acceptable **inside** `DATAHUB_SHELL` for dense secondary navigation (Publisher channels/history/templates).

---

## Proposed shared patterns

### Component names (to add in `dataHubUi.tsx`)

| Component | Role | When to use |
|-----------|------|-------------|
| **`DataHubTabStrip`** | Pill/chip horizontal nav in slate container | Primary navigation: DataHub main tabs, Advanced subtabs, Safety Filtering modes |
| **`DataHubSubTabBar`** | Underline bar inside a shell (no outer pill container) | Secondary navigation within a panel: Publisher tabs, Telegram analytics, Discovery views |
| **`DataHubSectionHeader`** | Title + optional description + optional actions slot | Top of each major panel (partially exists inline today) |

Optional **v3.1** (outside DataHub):

| Component | Role |
|-----------|------|
| **`AppTabBar`** | Unified underline/glass hybrid for `AICenter.tsx` + `AIManager/index.tsx` |

### Tailwind class contracts

#### `DataHubTabStrip` — container

```
border border-white/5 bg-slate-950/70 rounded-xl p-2 overflow-x-auto no-scrollbar
```

#### `DataHubTabStrip` — item base (inactive)

```
px-3 py-1.5 rounded-full text-xs font-medium border border-white/5
bg-slate-900/60 text-muted-foreground
hover:bg-slate-900/90 hover:text-foreground transition-colors whitespace-nowrap
disabled:opacity-50 disabled:cursor-not-allowed
```

#### `DataHubTabStrip` — item active variants

| Variant | Classes |
|---------|---------|
| `default` | `bg-purple-600/20 border-purple-500/60 text-purple-300` |
| `telegram` | `bg-sky-500/15 border-sky-500/60 text-sky-300` |
| `warning` | `bg-amber-500/15 border-amber-500/60 text-amber-300` |

#### `DataHubSubTabBar` — container

```
flex gap-2 md:gap-4 border-b border-white/10 overflow-x-auto no-scrollbar
```

#### `DataHubSubTabBar` — item

```
pb-2 text-[11px] font-semibold whitespace-nowrap border-b-2 transition-colors
/* active */   border-purple-500 text-purple-300
/* inactive */ border-transparent text-muted-foreground hover:text-foreground
/* telegram active */ border-sky-500 text-sky-300
```

#### `DataHubSectionHeader`

```
flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4 md:mb-5
/* title */    text-sm md:text-base font-semibold text-foreground
/* subtitle */ text-[11px] text-muted-foreground mt-1 max-w-xl
```

### State rules

| State | Behavior |
|-------|----------|
| **Active** | Apply variant classes; `aria-selected="true"`; optional `role="tab"` |
| **Inactive** | Base chip/sub-tab classes only |
| **Hover** | Foreground brighten; no layout shift |
| **Disabled** | `opacity-50 cursor-not-allowed`; no `onClick` |
| **Loading** | Strip remains visible; active tab shows subtle pulse or skeleton chip (`animate-pulse bg-slate-800/50`) — do not hide nav during panel load |
| **Keyboard** | Left/Right arrows between tabs when focused (v3.1 a11y polish) |

### Responsive behavior

- **Mobile:** horizontal scroll on strip; no wrap (except Safety Filtering where `flex-wrap` is acceptable for 4 tabs).
- **Tablet+:** same strip; optional `md:gap-3` on sub-tab bar.
- **Icons:** leading emoji/icon preserved for Telegram/Automation; `inline-flex items-center gap-1.5`.
- **Sticky headers:** SmartPrioritization / Archiving use `sticky top-0` toolbars — keep separate from tab strip; do not merge.

### RTL / Farsi considerations

- Use **logical spacing** in new code: prefer `gap-2` over `space-x-*`; avoid hard-coded `ml-*` on tab labels.
- Scroll direction: `overflow-x-auto` works in RTL; test Farsi labels do not clip (Persian strings are often longer — allow scroll, avoid `truncate` on tab labels).
- Chevron/arrow hints (if added later): use `rtl:rotate-180` or mirror icons.
- Section headers: Farsi subtitles in `deploy/blue/locales/fa.json` should be verified for line-wrap (`leading-relaxed` on hints).
- **Do not** mirror pill order for RTL unless app-wide RTL tab order is standardized (v3.1).

---

## Surface audit matrix

| Surface | File | Current style | Target style | Risk | Priority |
|---------|------|---------------|--------------|------|----------|
| **AI Center tabs** | `components/AICenter.tsx` | App card + `border-b-2` underline; `border-purple-500` active; `space-x-6` | **v3.1:** `AppTabBar` — slate glass nav inside card, keep underline OR migrate to pill strip matching DataHub | Medium — affects entire AI section shell | **P3 (v3.1)** |
| **AI Center header** | `components/AICenter.tsx` | `text-2xl font-bold` + `text-muted-foreground` desc in `bg-card` | Align typography to §3; optional slate gradient card | Low | P3 |
| **AI Manager tabs** | `components/ai/AIManager/index.tsx` | Same underline pattern as AICenter (11 tabs, crowded) | **v3.1:** `AppTabBar`; consider scroll affordance + compact `text-xs` on mobile | Medium — 11 tabs overflow on mobile | **P3 (v3.1)** |
| **AI Manager header** | `components/ai/AIManager/index.tsx` | `text-2xl` + status/mode badges (mixed green/purple/gray) | Badge colors → design system semantic pills (§7); header typography §3 | Low | P3 |
| **DataHub main tabs** | `components/ai/AIManager/tabs/DataHubTab.tsx` | Pill strip in slate box; telegram sky variant; **inline duplicated** | `DataHubTabStrip` shared component | Low — pattern already correct | **P1 (v3.0)** |
| **DataHub summary header** | `DataHubTab.tsx` → `DataHubSummaryCards` | Wrapped in legacy `Card` (`bg-card border-border`) | Keep Card wrapper in v3.0 OR wrap metrics in `DATAHUB_SHELL` (v3.1 visual pass) | Low | P2 |
| **Advanced subtabs** | `components/ai/AIManager/tabs/DataHub/AdvancedFeatures.tsx` | Same pill strip as DataHub main; 8 buttons inline | `DataHubTabStrip` + `variant` prop per tab | Low | **P1 (v3.0)** |
| **Advanced hint banner** | `AdvancedFeatures.tsx` | Sky gradient hint (OK per design system) | No change | None | — |
| **Telegram Collector** | `TelegramPanel.tsx` | No tab strip; section headers inside shell | No tab work; reference for headers | None | — |
| **Telegram Data analytics** | `TelegramDataPanel.tsx` | Legacy underline `border-b border-border`; `rounded-t-lg border-b-2`; hardcoded EN labels with emoji | `DataHubSubTabBar` inside shell; i18n keys for tab labels | Medium — nested under DataHub telegram view | **P1 (v3.0)** |
| **Telegram Publisher** | `advanced/TelegramPublisher.tsx` | `DataHubSectionHeader` pattern + underline `tabClass` inside `DATAHUB_SHELL` | `DataHubSubTabBar`; sky variant on channels tab optional | Low | **P1 (v3.0)** |
| **Safety Filtering** | `advanced/BlacklistWhitelist.tsx` | Pill strip (matches); evaluate = amber variant | `DataHubTabStrip` with `variant="warning"` for evaluate | Low | **P1 (v3.0)** |
| **Auto Discovery** | `advanced/AutoDiscoveryConfig.tsx` | Text-only tabs, `border-b border-white/10`, no active border | `DataHubSubTabBar` | Low | **P1 (v3.0)** |
| **Smart Prioritization** | `advanced/SmartPrioritization.tsx` | Sticky action toolbar, no tab strip | No tab strip needed | None | — |
| **Access Control** | `advanced/AccessControlPanel.tsx` | Search + table, no tabs | No change | None | — |
| **Web Crawlers** | `advanced/WebCrawlerConfig.tsx` | No internal tabs | No change | None | — |
| **Automation Routing** | `advanced/AutomationTopics.tsx` | Section layout (topics / queue / schedule); no tab bar | Optional v3.1: `DataHubSubTabBar` if sections feel crowded | Low | P2 |
| **Archiving** | `advanced/Archiving.tsx` | Sticky toolbar, tables | No tab strip | None | — |
| **Pipeline Health Overview** | `PipelineHealthOverview.tsx` | Footer card in Advanced | No tabs | None | — |
| **Skeleton loading** | `DataHubTab.tsx` | Tab skeleton uses `border-b border-border` | Update skeleton to match pill strip shape | Low | P2 |

---

## Implementation phases

### v3.0 (this PR series — DataHub scope only)

**Goal:** Extract duplicated tab logic; align all DataHub-internal navigation to design system.

| Step | Task | Files | Effort |
|------|------|-------|--------|
| 1 | Add `DataHubTabStrip`, `DataHubSubTabBar`, `DataHubSectionHeader` to `dataHubUi.tsx` | `dataHubUi.tsx` | S |
| 2 | Replace inline strips in `DataHubTab.tsx`, `AdvancedFeatures.tsx` | 2 files | S |
| 3 | Migrate `BlacklistWhitelist.tsx` pill strip | 1 file | S |
| 4 | Migrate `TelegramPublisher.tsx` sub-tabs | 1 file | S |
| 5 | Migrate `AutoDiscoveryConfig.tsx` sub-tabs | 1 file | S |
| 6 | Migrate `TelegramDataPanel.tsx` sub-tabs + i18n tab labels | 1 file + locales | M |
| 7 | Update `DataHubTab` loading skeleton to pill shape | 1 file | S |
| 8 | Add unit/visual check: tab strip renders in RTL (manual) | — | S |

**Out of v3.0 scope:** `AICenter.tsx`, `AIManager/index.tsx` shell redesign.

### v3.1 (follow-up)

| Task | Rationale |
|------|-----------|
| `AppTabBar` for AI Center + AI Manager | Broader blast radius; 17+ tabs combined |
| Replace `Card` wrapper in DataHubTab with `DATAHUB_SHELL` for summary row | Visual consistency at DataHub root |
| AutomationTopics optional sub-tab bar | UX improvement only |
| Keyboard roving tabindex + `role="tablist"` | a11y |
| GAP-007 chunk split — lazy tab labels bar if needed | Performance |

---

## `DataHubTabStrip` API (proposed)

```tsx
type DataHubTabVariant = 'default' | 'telegram' | 'warning';

type DataHubTabItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: DataHubTabVariant; // active-state variant override
  disabled?: boolean;
};

<DataHubTabStrip
  items={items}
  activeId={activeView}
  onChange={(id) => setActiveView(id)}
  ariaLabel={t('data_hub_navigation')}
/>
```

**Default active variant:** `default` (purple). Pass `variant: 'telegram'` on telegram tab items at call site (already done manually today).

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Regression on mobile scroll | Keep `overflow-x-auto no-scrollbar`; test 7 DataHub + 8 Advanced tabs |
| Telegram tab color inconsistency | Centralize `telegram` variant in one component |
| Breaking `activeView` / `activeFeature` state | Props-only refactor; no routing changes |
| AICenter/Manager feel unchanged after DataHub work | Document expectation; v3.1 addresses shell |
| i18n length overflow in FA | No `truncate` on tabs; scroll container |

---

## Acceptance criteria (UX-1 implementation)

- [ ] Single `DataHubTabStrip` used by DataHub main + Advanced + BlacklistWhitelist
- [ ] Single `DataHubSubTabBar` used by Publisher, Discovery, TelegramDataPanel
- [ ] No duplicate inline pill class strings in those files
- [ ] Telegram active tabs use sky variant via prop, not copy-paste
- [ ] `npm run build` passes
- [ ] No backend / API changes
- [ ] Visual spot-check: DataHub main → Advanced → Publisher → Telegram analytics path

---

## File index

| Path | Role |
|------|------|
| `DESIGN_SYSTEM_DATAHUB.md` | Color, typography, responsive rules |
| `components/ai/AIManager/tabs/DataHub/dataHubUi.tsx` | Target home for shared tab components |
| `components/AICenter.tsx` | App-level tabs (v3.1) |
| `components/ai/AIManager/index.tsx` | Manager-level tabs (v3.1) |
| `components/ai/AIManager/tabs/DataHubTab.tsx` | DataHub primary tabs (v3.0) |
| `components/ai/AIManager/tabs/DataHub/AdvancedFeatures.tsx` | Advanced primary tabs (v3.0) |

---

## Suggested commit sequence (when implementing)

1. `refactor(datahub): add DataHubTabStrip and SubTabBar primitives`
2. `refactor(datahub): adopt tab strip in main and advanced navigation`
3. `refactor(datahub): unify internal panel sub-tabs`
4. `i18n(datahub): localize TelegramDataPanel tab labels` (if step 6 included)

Docs-only commit for this plan: `docs(datahub): add tab header redesign plan`
