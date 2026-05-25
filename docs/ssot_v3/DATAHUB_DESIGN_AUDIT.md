# DataHub — Design Audit Snapshot (2026-05-24)

> مرجع: `DESIGN_SYSTEM_DATAHUB.md` · طلایی: `TelegramPanel.tsx`  
> روش: مقایسه الگوهای typography / spacing / cards / tables / badges / toggles / modals / states در پنل‌های backend-first شده.

## خلاصه اجرایی

| حوزه | وضعیت کلی | شدت |
|------|-----------|-----|
| Typography | مختلط — `text-xs`/`text-sm` درست؛ جاهایی `text-2xl` emoji در SummaryCard | Medium |
| Spacing | `space-y-4` رایج؛ Design System `space-y-6` برای بلوک‌های اصلی کمتر | Low |
| Cards | Sources نسبتاً slate؛ بقیه `bg-card border-border` | High |
| Tables | Logs/Access: `border-border` نه `border-slate-800` | High |
| Badges | `StatusBadge` shared ≠ semantic pill §7 | Medium |
| Toggles | اکثراً checkbox/HTML یا absent؛ نه §12 power toggle | Medium |
| Modals | `bg-card` + `fixed inset-0 bg-black/50` بدون blur/gradient پنل | High |
| Loading | ApiWrapper + SkeletonLoader — ناهماهنگ با Telegram | Medium |
| Empty | `EmptyState` / متن ساده — بدون slate block §13 | Medium |
| Error | Sources alerts نزدیک §11؛ Publisher/Automation از ApiWrapper generic | Low–Medium |

---

## 1. Typography

| Mismatch | Where | Severity |
|----------|-------|----------|
| عنوان `h3 font-semibold` بدون `text-sm md:text-base` یکسان | Categories, Pipeline, Logs, Advanced | Low |
| SummaryCard labels از کامپوننت shared — نه `text-[11px] text-{color}-300/80` | Automation, Publisher, Access | Medium |
| Hardcoded EN در Roles (Admin/Editor…) | `AccessControlPanel.tsx` | High (i18n + design) |
| `text-2xl` emoji icons در متریک | SummaryCard icon slots | Low |

**Planned:** فاز Design-1 — token class constants یا `DataHubSectionHeader` / `DataHubMetricGrid`.

---

## 2. Spacing & layout

| Mismatch | Where | Severity |
|----------|-------|----------|
| `space-y-4` به‌جای `space-y-6` برای sections | Most panels | Low |
| Advanced sub-nav: `border-border` tabs | `AdvancedFeatures.tsx`, Access | Medium |
| Grid metrics `gap-3` OK؛ missing `mb-4` after metric grid in some tabs | Pipeline | Low |

---

## 3. Cards

| Mismatch | Where | Severity |
|----------|-------|----------|
| `bg-card border border-border rounded-lg` shell | Access, Automation, Publisher, Blacklist, Crawlers | **High** |
| Sources list rows: نزدیک spec (`rounded-xl`, slate gradient) | `DataSourcesPanel.tsx` | ✅ Partial pass |
| `bg-secondary/5`, `hover:bg-secondary/10` list items | Access, Automation topics | Medium |

**Planned:** Design-1 (Sources polish) · Design-2 (Categories/Pipeline/Logs) · Design-3 (Advanced.*).

---

## 4. Table styles

| Mismatch | Where | Severity |
|----------|-------|----------|
| `thead border-border` not `border-slate-800` | Logs, Access logs table | **High** |
| Missing `text-[11px] text-muted-foreground` on th |同上 | Medium |
| Missing `overflow-x-auto -mx-3` wrapper | Logs | Low |

**Planned:** Design-2 with Logs panel redesign.

---

## 5. Badges

| Mismatch | Where | Severity |
|----------|-------|----------|
| `StatusBadge` variants ≠ `inline-flex … rounded-full text-[10px] bg-*-500/10` | All advanced + logs | Medium |
| Inline badges in Sources closer to spec | DataSources | ✅ |

**Planned:** `DataHubStatusPill` primitive aligned to §7.

---

## 6. Toggles

| Mismatch | Where | Severity |
|----------|-------|----------|
| Schedule/automation: no §12 toggle component | `AutomationSchedulePanel` | Medium |
| Access `requireAuth` in modal — unknown styling | `AccessControlModal` | Medium |
| Telegram Collector reference implements custom toggles | `TelegramPanel` | ✅ ref |

**Planned:** shared `DataHubToggle` in Design-3.

---

## 7. Modal patterns

| Mismatch | Where | Severity |
|----------|-------|----------|
| `bg-card border-border` panel, `bg-black/50` overlay no blur | CreateSource, AutomationTopic, Publisher, Access | **High** |
| Footer buttons not `text-[11px] bg-slate-700` / emerald confirm | Most modals | Medium |
| Inputs `bg-secondary` not `bg-slate-950/80` | CreateSource, AutomationTopic | Medium |

**Planned:** `DataHubModal` shell — Design-1 modals, then roll Advanced.

---

## 8. Loading / empty / error

| Mismatch | Where | Severity |
|----------|-------|----------|
| ApiWrapper generic overlay | Automation, Publisher, Access | Medium |
| Empty: plain text center vs slate block | DataSources empty OK-ish | Low |
| Pipeline SkeletonLoader — acceptable but not Telegram metric skeleton | Pipeline | Low |
| Error alerts in Sources match §11 partially (`text-sm` vs `text-[11px]`) | Sources | Low |

---

## 9. i18n (cross-cutting)

| Mismatch | Where | Severity |
|----------|-------|----------|
| Hardcoded strings in Access roles, Automation badges | Access, AutomationTopicList | High |
| Mixed `t('key') \|\| 'English fallback'` — OK pattern but keys missing in fa/en files | Several | Medium |

**Planned:** هر Design phase = keys added to i18n bundles.

---

## Coverage Matrix — Design column (to add in SSOT)

| Tab | Backend | Design | Notes |
|-----|---------|--------|-------|
| `dataHub.telegram` | Implemented | **Reference** | TelegramPanel |
| `dataHub.sources` | Implemented | **Done (Design-1)** | `dataHubUi` + `DataSourcesPanel` + `CreateSourceModal` |
| `dataHub.categories` | Implemented | **Done (Design-1)** | `CategoriesPanel` + `CreateCategoryModal` |
| `dataHub.pipeline` | Implemented | **Done (Design-2)** | `PipelinePanel.tsx` |
| `dataHub.logs` | Implemented | **Done (Design-2)** | `LogsPanel.tsx` |
| `dataHub.advanced.telegramPublisher` | Implemented | **Done (Design-3)** | `TelegramPublisher.tsx` |
| `dataHub.advanced.automation` | Implemented | **Done (Design-3)** | `AutomationTopics.tsx` + modals |
| `dataHub.advanced.access` | Implemented | **Done (GAP-022)** | `AccessControlPanel.tsx` |

---

*Audit date: 2026-05-24 · Next action: `advanced.accessControl` per `DATAHUB_DESIGN_WORKFLOW.md`.*
