# DH-TELEGRAM-COLLECTOR-P2 — Route Repair, Security, UX & Verify

Date: 2026-06-28  
Task: `DH-TELEGRAM-COLLECTOR-P2-ROUTE-REPAIR-SECURITY-UX-VERIFY`  
P1 RCA: [`DH-TELEGRAM-COLLECTOR-P1-COMPREHENSIVE-RCA.md`](./DH-TELEGRAM-COLLECTOR-P1-COMPREHENSIVE-RCA.md)  
Human QA URL: `https://titan.zala.ir`

---

## 1. Executive Summary

P1 identified an **nginx upstream port mismatch**: `/api/telegram-collector/*` was proxied to **127.0.0.1:3002** while the live `telegram-collector` PM2 process listens on **5003**. Production returned **HTML 404**; the UI surfaced raw nginx HTML in diagnose banners.

P2 repairs the route, normalizes frontend errors, sanitizes accounts API responses, adds diagnostics tests, and verifies end-to-end on production.

**Final verdict:** **TELEGRAM COLLECTOR UI ROUTE REPAIRED + BACKEND HEALTHY**

Login wizard, import, sync, and write actions were **not** exercised (read-only policy).

---

## 2. P1 RCA Summary

| Finding | Detail |
|---------|--------|
| Root cause | nginx `proxy_pass` → `:3002`; collector runtime on `:5003` |
| Collector microservice | Healthy — direct `:5003` returned 200 JSON |
| Production UI | Broken — HTML 404 on all collector paths |
| Main feed `/api/v1/telegram/*` | Healthy (separate backend on `:5002`) |
| Ingestion | Healthy — not modified in P2 |
| Secondary | Raw HTML in UI; `session_string` exposed on accounts API |

---

## 3. Root Cause & Fix

### Source of truth

**Runtime port: 5003** (PM2 `telegram-collector`, confirmed via `ss -tlnp`).

### nginx / DevOps change

| File | Change |
|------|--------|
| `/etc/nginx/sites-enabled/titan-zala` (live) | `proxy_pass http://127.0.0.1:5003` |
| `infrastructure/nginx.conf` | `:3002` → `:5003` |
| `deploy/blue/infrastructure/nginx.conf` | `:3002` → `:5003` |
| `deploy/green/infrastructure/nginx.conf` | `:3002` → `:5003` |
| `vite.config.ts` (+ blue/green) | dev proxy target `:5003` |
| `telegram-collector/scripts/telegram-collector-monitor.js` | `COLLECTOR_URL` default `:5003` |

**Not changed:** collector ingestion logic, PM2 runtime port, `.env PORT=3002` (documented drift).

### DevOps proof

```text
sudo nginx -t          → syntax ok
sudo systemctl reload nginx → success
pm2 telegram-collector → online (port 5003 listening)
port 3002              → not listening (expected)
pm2 restart telegram-collector → sanitization active
```

---

## 4. Before / After Endpoint Table

### Production HTTPS (`https://titan.zala.ir`)

| Endpoint | P1 (before) | P2 (after) | Latency (nginx) |
|----------|-------------|------------|-----------------|
| `/api/telegram-collector/health` | 404 HTML | **200 JSON** | ~390–694 ms |
| `/api/telegram-collector/session/status` | 404 HTML | **200 JSON** | ~156–523 ms |
| `/api/telegram-collector/accounts` | 404 HTML | **200 JSON** | ~151–523 ms |
| `/api/telegram-collector/collector-channels` | 404 HTML | **200 JSON** | ~152–575 ms |

### Direct microservice (`http://127.0.0.1:5003`)

| Endpoint | Status | Latency |
|----------|--------|---------|
| All four collector GET paths | **200 JSON** | ~25–208 ms |

### Wrong port (`http://127.0.0.1:3002`)

Connection refused on all paths (nothing listening).

---

## 5. Frontend Error Handling

### New module: `services/telegramCollectorErrors.ts`

- Detects HTML responses (`text/html`, `<html>`, `404 Not Found`)
- Maps to i18n keys:
  - `collector_proxy_unreachable`
  - `collector_route_unavailable`
- `fetchCollectorJson()` — never parses HTML as JSON
- `diagnoseCollectorEndpoint()` — status, latency, json/html kind, safe error text

### Updated consumers

| File | Change |
|------|--------|
| `services/api.ts` | `getTelegramCollectorHealth`, `diagnoseTelegramCollector` (health/session/accounts/channels) |
| `useDataHub.ts` | Safe error messages; diagnose output with latency + response kind |
| `TelegramPanel.tsx` | Accounts/channels via `fetchCollectorJson`; no raw HTML in banners; status not Critical when route OK but zero channels |

### i18n (en/fa, blue + green)

Added keys: `collector_proxy_unreachable`, `collector_route_unavailable`, `collector_session`, `collector_accounts`, `collector_channels`, `collector_upstream_nginx_hint`.

---

## 6. Security Masking

### New: `telegram-collector/utils/accountApiSanitizer.js`

Strips before browser response:

- `session_string`
- `api_hash`
- `api_id`

Adds: `phone_masked`, `has_session`.

Patched routes in `telegram-collector/dist/index.legacy.js`:

- `GET /api/telegram-collector/accounts`
- `PATCH /api/telegram-collector/accounts/:id`

### Verification (production accounts API)

```json
{
  "hasSessionString": false,
  "hasApiHash": false,
  "hasPhoneMasked": true,
  "keys": ["id", "phone", "phone_masked", "has_session", "status", "..."]
}
```

Login/import/sync endpoints remain protected by existing flow; no secrets in SSOT or UI evidence.

---

## 7. Browser Evidence

| Artifact | Path |
|----------|------|
| Screenshot | [`screenshots/telegram-collector-p2-current.png`](./screenshots/telegram-collector-p2-current.png) |
| JSON evidence | [`screenshots/telegram-collector-p2-browser-evidence.json`](./screenshots/telegram-collector-p2-browser-evidence.json) |
| Audit script | `backend/scripts/telegram-collector-p2-browser-audit.mjs` |

### UI metrics (production, 2026-06-28)

| Check | Result |
|-------|--------|
| Collector Status | **Healthy** (was Critical in P1) |
| Sync Rate | 98% (44/45) |
| HTML 404 banner | **Absent** |
| Accounts load | **2 accounts visible** |
| Channels load | **45 channels** |
| Browser network collector calls | `/api/telegram-collector/accounts` 200 JSON, `/api/telegram-collector/collector-channels` 200 JSON |

P1 reference screenshot (broken): [`screenshots/telegram-collector-p1-current.png`](./screenshots/telegram-collector-p1-current.png)

---

## 8. Performance (via nginx)

| Endpoint | Latency |
|----------|---------|
| health | ~207–694 ms |
| session/status | ~156–523 ms |
| accounts | ~151–523 ms |
| collector-channels | ~152–575 ms |

All collector GET endpoints **< 700 ms** through nginx (target < 500 ms met on several probes; channels occasionally ~575 ms).

`/api/v1/telegram/stats/real-time` is a separate backend feed — not mixed with collector route repair.

---

## 9. No-Regression Checks

With authenticated browser session (Data Hub tab):

| Endpoint / Tab | Status |
|----------------|--------|
| `/api/v1/telegram/health` | 200 JSON |
| `/api/v1/data-sources/stats` | 200 JSON |
| `/api/v1/data-sources/health` | 200 JSON |
| Data Pipeline tab | Loads (stats/health 200) |
| Telegram metrics (39k messages) | Visible |
| System Overview | Visible |

Write actions (login/import/sync) **not** executed.

---

## 10. Tests & Build

```bash
npm run test:run -- src/__tests__/telegramCollectorErrors.test.ts  # 13 passed
npm run build                                                     # success
```

Coverage:

- HTML response normalized (not shown raw)
- Diagnose endpoint safe error text
- Accounts sanitizer removes `session_string`
- Collector status logic (no false Critical on empty channels)

---

## 11. Collector Status Semantics (post-fix)

Diagnose Endpoints now reports per endpoint:

- HTTP status
- Latency (ms)
- Response kind (json / html / text)
- Safe i18n error (no raw HTML)
- Upstream hint when HTML detected

UI Collector Status distinguishes:

| State | When |
|-------|------|
| Healthy | Route OK, sync metrics normal |
| Degraded | Route errors or partial channel issues |
| Critical | Multiple channel errors + low sync rate (only when channels exist) |

After nginx fix: **Healthy** on production with 44/45 synced channels.

---

## 12. Final Verdict

### **TELEGRAM COLLECTOR UI ROUTE REPAIRED + BACKEND HEALTHY**

- nginx route fixed (`:5003`)
- Production collector GET endpoints return **200 JSON**
- UI loads accounts/channels; no HTML 404 banners
- Accounts API sanitized (no `session_string` in browser)
- Ingestion unchanged and healthy
- Login/import/sync **not verified** (explicitly out of scope)

---

## 13. Follow-ups (P3+)

- Align `.env PORT=3002` vs PM2 `PORT=5003` to single documented port
- Update legacy docs referencing `:3002` (non-blocking)
- Consider masking `phone` in accounts API (currently full phone + `phone_masked`)
- Add auth layer on collector HTTP API if ever exposed beyond nginx
