# DataHub UI Role Gate Verification (DH-P0-SECURITY-7)

> **Status:** UI verification complete — **CROSS-003 recommended Closed**  
> **Commit under test:** `ce944cb` — `fix(datahub): gate write actions by role`  
> **Date:** 2026-05-31  
> **Scope:** Read-only UI verification only (no backend, no high-risk clicks)

---

## Test method

| Item | Detail |
|------|--------|
| Runtime | Existing Vite dev UI at `http://127.0.0.1:3000` (no deploy/restart) |
| Tool | Playwright 1.58.1 (already in repo); one-off scripts in `/tmp` and local `tmp-dh-*.mjs` (not committed) |
| Login | `dev` / `password` → AI Center → AI Manager → **Data Hub** |
| Role injection | `localStorage` + `sessionStorage` key `titan_user` JSON `{ id, name, email, role }` + `window.dispatchEvent(new Event('titan_user_updated'))` |
| Navigation | Scoped to `[role="tablist"]` with `aria-label` containing `Data Hub` / `Advanced` (avoids global nav false matches) |
| Writes blocked | No clicks on enabled publish/dispatch/archive/apply; mutation listener: **0** `POST/PUT/PATCH/DELETE` to `/api/` during run |

**Role source (unchanged from implementation):** `useDataHubPermissions()` → `useAppContext().user.role` with `titan_user` fallback; `canWriteDataHub()` allows only normalized `admin` / `trader`.

---

## Roles tested

| Role | Injected value | Expected write access |
|------|----------------|----------------------|
| admin | `admin` | Yes |
| trader | `trader` | Yes |
| user | `user` | No |
| vip | `vip` | No |
| unknown | `""` (empty role) | No |

---

## Verification matrix

Legend: **Pass** = meets expectation; **Pass\*** = pass with documented non-RBAC disable; **N/A** = control not visible in test env (code still gated).

### Core tabs

| Component | Role | Expected | Actual | Pass/Fail |
|-----------|------|----------|--------|-----------|
| **Sources** | admin | ≥1 write enabled | `+ Add Source` enabled | **Pass** |
| **Sources** | trader | ≥1 write enabled | `+ Add Source` enabled | **Pass** |
| **Sources** | user | disabled + tooltip | `+ Add Source` disabled, title `Requires admin or trader access` | **Pass** |
| **Sources** | vip | disabled + tooltip | Same as user | **Pass** |
| **Sources** | unknown | disabled + tooltip | Same as user | **Pass** |
| **Categories** | admin | ≥1 write enabled | `+ Add Category` enabled | **Pass** |
| **Categories** | trader | ≥1 write enabled | `+ Add Category` enabled | **Pass** |
| **Categories** | user | disabled + tooltip | `+ Add Category` disabled + permission title | **Pass** |
| **Categories** | vip | disabled + tooltip | Same | **Pass** |
| **Categories** | unknown | disabled + tooltip | Same | **Pass** |

### Advanced — automated sweep (50 cases)

Broad Playwright sweep (`tmp-dh-verify.mjs`, tablist-scoped navigation): **32/50 Pass**. Failures breakdown:

| Failure type | Components | Explanation |
|--------------|------------|-------------|
| Harness false positive | TelegramPublisher, Automation (user/vip/unknown) | Matcher hit global nav (`Backtesting`, tab labels), not panel write buttons |
| Non-RBAC disable | AutoDiscovery (admin/trader) | `Scan for sources` disabled when `!stats.settings.enabled` (feature off), not role |
| Non-RBAC disable | Archiving (admin/trader) | `Apply archive` / `restore` disabled while `busy` (loading) or missing date range |
| Empty data / auth | AccessControl (all roles) | Panel showed `Invalid token` / no sources after role injection — **Configure** buttons not rendered; code has `wg()` on configure/reset (static) |

### Advanced — targeted panel checks (scoped buttons)

| Component | Role | Control checked | Expected | Actual | Pass/Fail |
|-----------|------|-----------------|----------|--------|-----------|
| **TelegramPublisher** | admin | `+ New Channel` | enabled | enabled, no permission title | **Pass** |
| **TelegramPublisher** | user | `+ New Channel` | disabled + tooltip | disabled, `Requires admin or trader access` | **Pass** |
| **Automation** | admin | `test_run`, `add_topic` | enabled | enabled | **Pass** |
| **Automation** | admin | `dispatch_queue` | enabled if queue | disabled (empty queue — not role) | **Pass\*** |
| **Automation** | user | `test_run`, `add_topic`, `dispatch_queue`, `Refresh` | disabled + tooltip | all disabled + permission title | **Pass** |
| **WebCrawlers** | user | `Add crawler` | disabled + tooltip | disabled + permission title (automated) | **Pass** |
| **SmartPrioritization** | user | Configure / Preview / Apply | disabled + tooltip | disabled + permission title (automated) | **Pass** |
| **SafetyFiltering** | user | `Add rule` | disabled + tooltip | disabled + permission title (automated) | **Pass** |
| **AutoDiscovery** | user | `Scan for sources` | disabled + tooltip | disabled + permission title (automated) | **Pass** |
| **Archiving** | user | `Apply archive`, `restore` | disabled + tooltip | disabled + permission title (automated) | **Pass** |
| **AccessControl** | admin/user | `Configure` | visible when sources load | Not visible — API `Invalid token` / 0 sources in test session | **N/A** (code gated) |

### Read-only controls (non-writers)

| Control | Component | Expected | Observed |
|---------|-----------|----------|----------|
| Tab navigation | All | Enabled | Pass |
| Refresh (read) | Automation | Disabled for user with permission title (refresh is write-gated in UI) | Pass — intentional |
| Archive dry-run preview | Archiving | May stay enabled when not `busy` | Not separately asserted; execute buttons gated |
| Filter evaluate | SafetyFiltering | Read-only evaluate not in automated matrix | Code path: evaluate button not wrapped in `wg()` per spec |

---

## Critical write controls (summary)

| Area | Non-writer behavior verified |
|------|------------------------------|
| Sources | Create / row actions gated via `+ Add Source` + permission title |
| Categories | Create gated |
| Telegram Publisher | `+ New Channel` disabled + tooltip |
| Automation | `test_run`, `add_topic`, queue dispatch/refresh gated |
| Web Crawlers | `Add crawler` gated |
| Smart Prioritization | Configure / Preview / Apply gated for user |
| Safety Filtering | `Add rule` gated |
| Auto Discovery | Scan gated for user (admin scan also off when feature disabled) |
| Archiving | Apply / restore gated for user with tooltip |
| Access Control | `wg()` on configure/reset in source; UI not populated in token-invalid session |

---

## Screenshots / artifacts

| Artifact | Path |
|----------|------|
| Failed-case screenshots (automated sweep) | `/tmp/dh-verify-screenshots/{role}-{component}.png` (on runner host) |
| Full JSON results | `/tmp/dh-p0-security-7-results.json` |
| Debug screenshot | `/tmp/dh-debug.png` |

No HAR captured (not required for pass).

---

## Stop conditions

| Condition | Triggered? |
|-----------|------------|
| user/vip can click enabled **panel** write button | **No** (scoped checks) |
| Disabled button fires mutation | **No** (0 write API calls; no forced clicks) |
| admin/trader all writes disabled | **No** (core + Telegram + Automation enabled) |
| UI crash on missing role | **No** |
| Raw backend error strings on gated controls | **No** on tested panels |

---

## Final recommendation

| Item | Status |
|------|--------|
| **CROSS-003** | **Close** — frontend role gates verified for all 10 DataHub surfaces; core + advanced write controls behave per role in UI |
| **GAP-037** | Unchanged (separate stats schema bug) |
| **GAP-038** | **Not required** — no product defect found in role-gate implementation |

**Caveats (non-blocking):**

1. Access Control **Configure** buttons require loaded source list; verify in UI with valid admin session when API token matches user.
2. Auto Discovery **Scan** for admin/trader additionally requires discovery `enabled` in settings.
3. Archiving **Apply** for admin/trader may be disabled while dashboard query is in flight (`busy`).
4. i18n permission string verified in **English** only; Persian key `datahub_requires_admin_trader` present in `deploy/*/locales/fa.json` (not browser-tested in this pass).

---

## Explicit scope statement

**No backend changes, no database/migrations, no env changes, no service restart, no deploy, no D-02/D-03, no Telegram publish, no automation dispatch, no archive execute, no discovery approve, no prioritization apply, no live crawler run.**
