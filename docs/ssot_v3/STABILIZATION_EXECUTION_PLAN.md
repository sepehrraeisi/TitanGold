# STABILIZATION EXECUTION PLAN

Status: Planning only (no implementation in this phase)  
Branch status baseline: `Ready except final browser smoke — blocked by approved test environment`

## Goal

Convert the completed audit into small, low-risk, reviewable, rollback-friendly execution phases for stabilization and UX consistency.

## Guardrails

- No feature expansion during stabilization.
- No smoke reruns in this phase.
- No env/CORS/restart/migration/deploy changes.
- Docs and planning only.

---

## Phase S1 — Unified Tabs / Header System

Scope:
- AICenter tabs
- AIManager tabs
- DataHub tabs
- Advanced tabs
- Internal tabs only when touched in same file

### Planned Work Items

| File | Current Status | Target Component/Pattern | Risk | Test/Demo | i18n Touch |
|---|---|---|---|---|---|
| `components/AICenter.tsx` | Legacy | Shared tab primitive (`pill` variant) with unified spacing/active tokens | Medium | Visual parity demo: tabs render/active/keyboard nav | Likely yes (labels already translated, verify no inline fallback) |
| `components/ai/AIManager/index.tsx` | Legacy | Shared tab primitive, same behavior as AICenter/DataHub | Medium | AIManager tab switching demo + responsive wrap | Likely yes |
| `components/ai/AIManager/tabs/DataHubTab.tsx` | Redesigned | Keep as design baseline; migrate to shared primitive without style drift | Low-Medium | Snapshot diff of tab shell before/after | No or minimal |
| `components/ai/AIManager/tabs/DataHub/AdvancedFeatures.tsx` | Redesigned | Align with shared primitive API (same tokens) | Low-Medium | Advanced tab bar interaction demo | No or minimal |
| `components/ai/AIManager/tabs/DataHub/advanced/AutoDiscoveryConfig.tsx` | Legacy | Replace underline-style internal tabs with pill internal tabs | Medium | Internal subtab interaction demo | Possible (label keys validation) |
| `components/ai/AIManager/tabs/DataHub/TelegramDataPanel.tsx` | Mixed | Normalize internal tab row to shared primitive | Medium | Telegram internal tab navigation demo | Possible |
| `components/ai/AIManager/tabs/DataHub/advanced/TelegramPublisher.tsx` | Legacy/Mixed | Move internal tabs to shared primitive | Medium | Publisher tab state visual + accessibility checks | Possible |
| `components/ai/AIManager/tabs/DataHub/advanced/BlacklistWhitelist.tsx` | Redesigned | Keep as compliant reference for internal tabs | Low | Regression screenshot check | No |

Notes:
- Internal tabs are touched only in files already part of S1 changes.
- Implementation remains split into small reviewable PR chunks (AICenter/AIManager first, then internal tab sets).

---

## Phase S2 — Unified Error / Empty / Loading States

Scope:
- AICenter shell
- AIManager shell
- DataHub container
- DataHub panels
- Advanced panels
- Telegram panels

### State Standard (target)

| State | Target UX |
|---|---|
| loading | Skeleton/spinner with consistent shell |
| empty | Empty-state card with actionable hint |
| 401 | Auth-required state |
| 403 | Permission-denied state |
| 404 | Resource-unavailable state |
| 500 | Retryable server error state |
| offline | Connection issue state |
| partial | Degraded mode banner/card |

### Planned Mapping by Surface

| Surface | Current Behavior | Target UX | Status Code Mapping | Proposed Helper/Component | Risk | Test/Demo |
|---|---|---|---|---|---|---|
| `AICenter` shell | Generic load error + loading; limited code-aware mapping | Standard shell states (`loading/empty/auth/error`) | 401/403/404/500 mapped to unified keys | Shared `ShellStateCard` + centralized error formatter | Medium | Force API failures and verify mapped states |
| `AIManager` shell | Raw/generic messages may leak | Replace with consistent state cards | Full mapping 401/403/404/500/offline | `ShellStateCard` + `formatApiErrorForUi` bridge | Medium-High | Simulate unauthorized and backend fail cases |
| `DataHubTab` container | Better than others but not fully standardized | Keep skeleton/error shell as canonical | Complete mapping and consistent retry behavior | `DataHubAlert` + status mapping adapter | Medium | Existing DataHub demos + negative-state checks |
| `DataHub` panels (`Sources/Categories/Pipeline/Logs`) | Mixed handling, some raw message passthrough | Uniform panel-state wrappers | Ensure all response classes map to state model | `PanelStateBoundary` wrapper | Medium | Per-panel failure/empty/loading matrix |
| Advanced panels | Mostly improved via i18n/error sanitizer but inconsistent in places | Unified wrapper pattern + no raw text | 401/403/404/500/offline consistently translated | `PanelStateBoundary` + `formatApiErrorForUi` | Medium | Advanced subtab error-path demos |
| Telegram panels (`TelegramPanel`, `TelegramDataPanel`) | Highest inconsistency (raw loading/error strings) | Full normalization first in this domain | Strict mapping (including 404 and offline) | Telegram-specific adapters using shared boundary | High | Dedicated Telegram smoke-like UI checks in controlled env |

---

## Phase S3 — Mock / Local State Removal

Source: `docs/ssot_v3/MOCK_AUDIT.md`

Rule:
- Any surface still using mock/local state while SSOT says "Implemented" must be either fixed or SSOT status corrected.

### Planned Removal Matrix

| File / Function | Replacement API | Blocker or Non-Blocker | Priority | Must finish before current PR merge? |
|---|---|---|---|---|
| `hooks/useDataHubState.ts` / `useDataHubQuery` (`fetchDataHubState`) | Backend-first per panel hooks (`sources/categories/pipeline/logs/health/stats`) | Blocker for strict backend-first claim | P0 | **Yes** if still powering user-visible summary/core shell |
| `services/api.ts` / `fetchDataHubState` defaults (`cacheHitRate/hitRate`) | `/api/v1/data-sources/stats`, `/api/v1/data-sources/health` | Blocker if exposed to UI | P0 | **Yes** (or SSOT must downgrade status) |
| `services/api.ts` legacy crawler CRUD | `dataHubCrawlersApi` + `useDataHubCrawlers` | Non-blocker if unreachable from current UI path; blocker if active | P1 | v3.1 unless active in current UI |
| `services/api.ts` `runAutoDiscovery` mock/random path | `dataHubDiscoveryApi` + `useDataHubDiscovery` | Blocker when used by current UI actions | P1 | v3.1 unless user-visible now |
| `services/api.ts` `calculateSourcePriorities` mock factors | `dataHubPrioritizationApi` + `useDataHubPrioritization` | Non-blocker if legacy not used in active path | P1 | v3.1 |
| `services/api.ts` access control local path | `accessControlApi` + `useAccessControl` | Blocker if mixed truth in current Access UI | P1 | Prefer before merge if active |
| `services/api.ts` telegram publisher local path | `telegramPublishersApi` + `useTelegramPublishers` | Medium blocker (integrity/history mismatch risk) | P1 | v3.1 unless currently active path |
| `services/api.ts` automation local queue/dispatch | `datahubAutomationApi` + `useDatahubAutomation` | Medium-High risk; likely non-blocker for this PR if not active path | P2 | v3.1 |
| `hooks/useDataHubState.ts` / `useAgentsQuery` synthetic metrics | Dedicated metrics endpoint or explicit N/A | Non-blocker (presentation integrity) | P2 | v3.1 |
| `services/api.ts` `fetchAIAgents` seeded fallback | Keep backend source; explicit degraded fallback | Medium blocker for data integrity narratives | P2 | v3.1 |
| `services/api.ts` training/analytics broad local fallback | Keep backend-first with explicit degraded mode | Non-blocker for DataHub merge scope | P3 | v3.1 |
| Artemis fallback defaults (`useArtemisState`) | Keep fallback but label degraded/auth-required | Non-blocker for DataHub scope | P3 | v3.1 |

Decision rule for SSOT:
- If a listed item remains active in user-visible "Implemented" flow, either:
  1) move it to backend-first in current scope, or
  2) change SSOT status to Partial + add explicit GAP.

---

## Phase S4 — Deep-Linking Proposal (Planning Only)

Implementation target: v3.1 unless a tiny low-risk patch is explicitly approved.

### URL Schema (proposed)

- `view=ai`
- `aiTab=manager|agents|training|analytics|config|topic_routing`
- `managerTab=overview|decision_engine|...|data_hub`
- `dhTab=sources|categories|pipeline|health|logs|advanced|telegram`
- `dhAdvTab=crawlers|discovery|prioritization|access|blacklist|telegram|automation|archive`
- optional: `dhSubTab=<internal-subtab>`
- optional version key: `nav=v2`

### Backward Compatibility

- Keep current `?view=ai` behavior.
- Unknown params must fallback safely and canonicalize via `replaceState`.
- URL state precedence over local defaults.

### Affected Files (expected)

- `utils/urlSync.ts`
- `components/Dashboard.tsx`
- `components/AICenter.tsx`
- `components/ai/AIManager/index.tsx`
- `components/ai/AIManager/tabs/DataHub/hooks/useDataHub.ts`
- `hooks/useAdvancedFeatures.ts`
- internal tab components where `dhSubTab` is added

### Rollout Order

1. Add parser/serializer/validator and canonicalization.
2. Wire AICenter (`aiTab`).
3. Wire AIManager (`managerTab`).
4. Wire DataHub main tabs (`dhTab`).
5. Wire Advanced tabs (`dhAdvTab`).
6. Add selective internal subtab deep-links (`dhSubTab`) only for high-value cases.

### Risk

- Medium: URL-state drift if canonicalization is incomplete.
- Medium: Back/forward regressions.
- Low-Medium: Existing links break if fallback logic is weak.

### Test Plan (planning)

- Deep-link open tests for each level.
- Back/forward navigation matrix tests.
- Refresh persistence checks.
- Invalid query param resilience tests.

---

## Phase S5 — Final Browser Smoke Environment Plan

Objective:
- Run final smoke without production environment changes.

### Preconditions

- Approved frontend origin already allowed by backend CORS.
- Valid test user/token approved and available.
- No CORS loosening in production.
- No seed/write without explicit approval.

### Smoke URL and Path

- Entry URL: approved origin + `/?view=ai`
- Navigation: AI Center -> Manager -> Data Hub

### Tabs/Subtabs to verify

- Main tabs: `Sources`, `Categories`, `Pipeline`, `Health`, `Logs`, `Advanced`, `Telegram`
- Advanced subtabs: `Web Crawlers`, `Auto Discovery`, `Smart Prioritization`, `Access Control`, `Safety Filtering`, `Telegram Publisher`, `Automation`, `Archiving`

### Pass/Fail Criteria

Pass:
- DataHub opens and navigation works.
- No raw text: `Not Found`, `Resource not found`, `undefined`, `Undefined`, `NaN`.
- No fake cache KPI (`75.0%`) when backend metric absent; expected fallback is `N/A`.
- Failures (if any) shown via normalized empty/error states, not raw backend messages.

Fail:
- Any raw forbidden string visible.
- Any critical tab blocked by loading deadlock.
- Any user-visible KPI sourced from mock/static fallback in implemented scope.

---

## Final Phase Table

| Phase | Priority | Can ship in current PR? | Needs separate PR? | Risk | Owner note |
| ----- | -------- | ----------------------- | ------------------ | ---- | ---------- |
| S1 — Unified Tabs/Header | P1 | Partially (small, isolated tab shells) | Yes (full unification) | Medium | Start with AICenter + AIManager shells; keep DataHub visuals stable |
| S2 — Unified State UX | P1 | Partially (shell-level adapters) | Yes (full panel normalization) | Medium-High | Telegram surfaces first for inconsistency reduction |
| S3 — Mock/Local Removal | P0/P1/P2 | Only blocker items tied to implemented claims | Yes (broad cleanup to v3.1) | High | Enforce SSOT truth: fix or mark Partial+GAP |
| S4 — Deep-Linking | P2 | Usually no (planning in this PR) | Yes (v3.1) | Medium | Roll out in layers with strict canonicalization tests |
| S5 — Final Smoke Env | P0 (release gate) | Yes (execution once env approved) | No (if env already approved) | Medium | Requires approved origin + valid test credential/token |

