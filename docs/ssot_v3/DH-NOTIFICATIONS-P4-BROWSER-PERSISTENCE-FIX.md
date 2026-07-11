# DH-NOTIFICATIONS-P4-BROWSER-CHANNEL-PERSISTENCE-FIX

Status: **REAL WORKING** (Browser channel persistence)
Date: 2026-06-27
Scope: Settings → Notifications → Channels → Browser card persistence across tab switch and refresh.

## Verdict

Browser notification enabled state now persists correctly:

- Backend `browser_enabled` is saved via `PUT /api/v1/notifications/preferences`.
- UI badge reflects `Notification.permission === "granted"` **AND** `browser_enabled === true`.
- State survives tab switch within Notifications (Channels ↔ Preferences ↔ History).
- State survives full page refresh.
- Frontend tests, backend tests, build, runtime browser verification, screenshots, and network evidence all pass.

Notifications P4 verdict: **REAL WORKING**.

## Phase 1 — Root Cause Analysis

### Human QA symptom

Clicking **Enable Browser Notifications** showed success (`Browser notifications enabled locally`) and badge **enabled**, but after tab switch or refresh the Browser card returned to **disabled**.

### Answers to audit questions

| # | Question | Answer |
|---|----------|--------|
| 1 | Where is browser enabled/disabled computed? | Frontend: `isBrowserChannelEnabled()` in `NotificationsSettings.tsx` (lines 67–68, 390). Backend channels: `getNotificationChannels()` in `notificationService.js` (lines 310–328). |
| 2 | Is it based only on `Notification.permission`? | **Before fix:** partially — UI updated local `preferences.browser_enabled` from permission only. **After fix:** effective status requires both permission **and** saved preference. |
| 3 | Is it saved to backend preferences? | **Before fix:** No. **After fix:** Yes — `PUT /api/v1/notifications/preferences` with `browser_enabled`. |
| 4 | Is it saved to localStorage only? | No. Never was the intended design; pre-fix was React `useState` only. |
| 5 | Why tab switch reset? | Settings sidebar remounts `NotificationsSettings`; initial `loadPreferences()` returned `browser_enabled: false` from backend because nothing was persisted. |
| 6 | Why refresh reset? | Same — remount + backend still had `browser_enabled: false`. |
| 7 | Are Telegram and Email UI-only? | **Telegram:** No — backend-backed via Telegram Publisher (`getNotificationChannels`). **Email:** Static `coming_soon` — no fake enable. |
| 8 | Are Preferences and History backend-backed? | Yes — unchanged from P3; `GET /preferences`, `PUT /preferences`, `GET /history` all hit backend. |

### Exact root cause

Pre-P4 `enableBrowserNotifications()` only updated React state and showed a misleading local-only message. It never called the notification preferences API.

Legacy buggy pattern (deploy copies still show this):

```173:182:deploy/green/components/settings/NotificationsSettings.tsx
  const enableBrowserNotifications = async () => {
    // ...
    const permission = await Notification.requestPermission();
    const enabled = permission === 'granted';
    setPreferences(prev => ({ ...prev, browser_enabled: enabled }));
    setStatusMessage(enabled ? 'Browser notifications enabled locally.' : 'Browser permission was not granted.');
  };
```

Backend schema and endpoints already existed:

- Column: `notification_preferences.browser_enabled` (`043_notifications_unified_center.sql`)
- Routes: `GET/PUT /api/v1/notifications/preferences`, `GET /api/v1/notifications/channels`

The bug was **frontend-only** — missing persistence call on enable.

## Phase 2 — Product decision (implemented)

**Effective Browser channel status:**

```
enabled  = Notification.permission === "granted" AND browser_enabled === true
disabled = permission !== "granted" OR browser_enabled !== true
```

**Sources of truth:**

- Browser permission: `window.Notification.permission`
- User preference: `notification_preferences.browser_enabled` (API exposes nested `browser.enabled`)

## Phase 3 — Backend persistence

No migration required. Uses existing `browser_enabled` column.

### Enriched preference shape

```json
{
  "browser_enabled": true,
  "browser": {
    "enabled": true,
    "updated_at": "2026-06-27T11:58:37.817Z"
  }
}
```

### Key backend changes

| File | Change |
|------|--------|
| `backend/services/notificationService.js:76–98` | `buildBrowserPreferenceView`, `withBrowserPreferenceView`, `normalizePreferenceInput` — accepts `browser.enabled` or `browser_enabled` |
| `backend/services/notificationService.js:60–74` | `mapPreferencesRow` returns nested `browser` view |
| `backend/services/notificationService.js:310–328` | `getNotificationChannels` returns persisted `browser.enabled` status |

Endpoints verified:

- `GET /api/v1/notifications/preferences` → returns `browser` + `browser_enabled`
- `PUT /api/v1/notifications/preferences` → persists `browser_enabled`
- `GET /api/v1/notifications/channels` → `browser.status` reflects stored preference

## Phase 4 — Frontend fix

| File | Change |
|------|--------|
| `components/settings/NotificationsSettings.tsx:353–388` | `persistBrowserPreference()` calls `updateNotificationPreferences({ browser_enabled })` then refetches channels |
| `components/settings/NotificationsSettings.tsx:360–388` | `enableBrowserNotifications()` requests permission, persists true/false, shows correct messages |
| `components/settings/NotificationsSettings.tsx:67–68,390` | `isBrowserChannelEnabled()` combines permission + preference |
| `services/api.ts` | `UnifiedNotificationPreferences.browser` type added |

### Enable flow

1. Unsupported → message, no API call
2. `requestPermission()` → `granted` → `PUT browser_enabled: true` → success: **"Browser notifications enabled on this device."**
3. `denied` → `PUT browser_enabled: false` → denial message
4. `default` → no enable, no PUT

### Load flow

On mount: `fetchNotificationPreferences()` + `Notification.permission` → badge computed via `isBrowserChannelEnabled()`.

## Phase 5 — UI text fix

| Before | After |
|--------|-------|
| `Browser notifications enabled locally.` | `Browser notifications enabled on this device.` |

Misleading "local" wording removed. Backend persistence is the primary path.

## Phase 6 — Other channel cards

| Channel | Persistence | Verdict |
|---------|-------------|---------|
| Telegram | Backend Telegram Publisher config survives refresh | **PASS** |
| Browser | Backend `browser_enabled` + browser permission survives tab switch and refresh | **PASS** |
| Email | Static `coming_soon`, disabled button, no fake enable | **PASS** |
| Preferences tab | Backend GET/PUT | **PASS** (unchanged P3) |
| History tab | Backend GET | **PASS** (unchanged P3) |

## Phase 7 — Tests

### Frontend

```bash
npm run test:run -- src/__tests__/NotificationsSettings.test.tsx
```

13 tests passed, including:

- `requestPermission` invoked on enable click
- `PUT` with `browser_enabled: true` when granted
- Badge stays enabled after remount when backend + permission agree
- Denied permission persists `false` and stays disabled
- Tab switch does not reset enabled badge
- No fake enabled without granted permission

### Backend

```bash
cd backend && npm test -- --runInBand __tests__/unit/notificationService.test.js __tests__/unit/notificationRoutes.test.js
```

16 tests passed, including browser preference GET/PUT and channels status.

### Build

```bash
npm run build
```

Exit 0.

## Phase 8 — Runtime browser verification

Test sequence executed on `http://localhost:3000` with authenticated session:

1. Open Settings → Notifications → Channels — Browser **disabled** (permission granted, preference false)
2. Click Enable Browser Notifications — badge **enabled**, success message shown
3. Switch to Preferences → back to Channels — badge **enabled**
4. Refresh page — badge **enabled**
5. Active channels metric: **2/3** after enable (Telegram configured + Browser enabled)

### Screenshots

| Step | File |
|------|------|
| Before enable | `docs/ssot_v3/screenshots/notifications-p4-browser-before.png` |
| After enable | `docs/ssot_v3/screenshots/notifications-p4-browser-after-enable.png` |
| After tab switch | `docs/ssot_v3/screenshots/notifications-p4-browser-after-tab-switch.png` |
| After refresh | `docs/ssot_v3/screenshots/notifications-p4-browser-after-refresh.png` |

### Network evidence

See `docs/ssot_v3/notifications-p4-browser-report.json`.

All notification endpoints returned **200**:

- `PUT /api/v1/notifications/preferences` — `browser_enabled: true`
- `GET /api/v1/notifications/preferences` — `browser.enabled: true`
- `GET /api/v1/notifications/channels` — `browser.status: "enabled"`

No notification-specific console errors during verification.

## Phase 9 — Design system compliance

Verified against `DESIGN_SYSTEM_DATAHUB.md`:

| Requirement | Status |
|-------------|--------|
| Status badge updates (emerald enabled / slate disabled / amber coming soon) | PASS |
| Button loading state (`Enabling...`) during async enable | PASS |
| Success message compact, non-dominant green banner | PASS |
| No raw error / Not Found in Channels tab | PASS |
| Dark theme cards, `border-white/5`, gradient panels preserved from P3 redesign | PASS |
| No UI-only fake state for Browser enable | PASS |

Layout from P3 redesign unchanged — only persistence logic and messaging updated.

## Phase 10 — Final verdict

**REAL WORKING** for Browser notification channel persistence:

- [x] Persists after tab switch
- [x] Persists after refresh
- [x] Backend preference saved
- [x] Tests pass (frontend + backend)
- [x] Build passes
- [x] Screenshots captured
- [x] Network evidence captured
- [x] No notification console errors

## Files changed (P4)

- `components/settings/NotificationsSettings.tsx`
- `backend/services/notificationService.js`
- `services/api.ts`
- `src/__tests__/NotificationsSettings.test.tsx`
- `backend/__tests__/unit/notificationService.test.js`
- `backend/__tests__/unit/notificationRoutes.test.js`
- `docs/ssot_v3/DH-NOTIFICATIONS-P4-BROWSER-PERSISTENCE-FIX.md`
- `docs/ssot_v3/notifications-p4-browser-report.json`
- `docs/ssot_v3/screenshots/notifications-p4-browser-*.png`
