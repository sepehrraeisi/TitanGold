# DH-TELEGRAM-COLLECTOR-P3 — Functional Verification, Redesign & E2E Validation

Date: 2026-06-28  
Task: `DH-TELEGRAM-COLLECTOR-P3-COMPLETE-FUNCTIONAL-VERIFICATION-REDESIGN-E2E`  
P1 RCA: [`DH-TELEGRAM-COLLECTOR-P1-COMPREHENSIVE-RCA.md`](./DH-TELEGRAM-COLLECTOR-P1-COMPREHENSIVE-RCA.md)  
P2 SSOT: [`DH-TELEGRAM-COLLECTOR-P2-ROUTE-REPAIR-SECURITY-UX-VERIFY.md`](./DH-TELEGRAM-COLLECTOR-P2-ROUTE-REPAIR-SECURITY-UX-VERIFY.md)  
Human QA URL: `https://titan.zala.ir`

---

## 1. Executive Summary

P3 extends P2 (route repair + read-path recovery) into a **production-readiness pass**: functional audit, UI redesign aligned with DataHub design system (Archiving / Automation / Publisher), backend response sanitization, structured diagnostics, React Query hooks, expanded tests, and production browser verification.

**Final verdict (honest):**

### **COLLECTOR READ PATHS VERIFIED + UI REDESIGNED + SECURITY HARDENED**

**Not claimed:** `REAL WORKING` for full write workflows (Login OTP confirm, Import register, Sync Data Sources POST) — these require Telegram OTP / explicit operator permission and were **not** executed in automated runtime.

---

## 2. Phase 0 — Sources Read

| Source | Notes |
|--------|-------|
| P1 RCA | nginx `:3002` vs runtime `:5003` |
| P2 SSOT | Route fixed; accounts sanitized; HTML errors normalized |
| Frontend | `TelegramPanel.tsx`, `useDataHub.ts`, `TelegramLoginWizard.tsx`, `TelegramDataPanel.tsx` |
| Backend | `telegram-collector/dist/index.legacy.js` (all routes) |
| DB | `telegram_accounts`, `telegram_channels`, `telegram_messages`, `telegram_sessions` |
| nginx / pm2 | upstream `:5003`; `telegram-collector` online |
| Integrations | Data Sources sync, Pipeline transfer, Publisher, Automation (shared PostgreSQL) |

---

## 3. Phase 1 — Functional Audit Results

### Verified (runtime, production)

| Workflow | Method | Result |
|----------|--------|--------|
| Health | GET `/health`, `/api/telegram-collector/health` | 200 JSON, ~450–570 ms |
| Session status | GET `/session/status` | 200 JSON, phone masked |
| Accounts list | GET `/accounts` | 200 JSON, 2 accounts, no `session_string`, phone masked |
| Channels list | GET `/collector-channels` | 200 JSON, 45 channels |
| Polling status | GET `/polling/status` | 200 JSON |
| Metrics | GET `/metrics` | 200 JSON |
| Diagnose (UI) | 4-endpoint probe | All OK via nginx |
| Login start validation | POST `/login/start` `{}` | 400 (phone required) — endpoint reachable |
| Data feed tabs | Overview, AI Inbox, Breaking, Geographic | Load, no HTML 404 |
| Data Sources / Pipeline feed | `/api/v1/data-sources/*`, `/api/v1/telegram/*` | 200 with auth |

### Not verified (by policy)

| Workflow | Reason |
|----------|--------|
| Login confirm (OTP) | Requires live Telegram verification code |
| Import / register channels | Write mutation — not executed |
| Sync Data Sources POST | Write mutation — not executed |
| Account logout / disable / primary PATCH | Write mutation — not executed |
| Force sync / channel PATCH | Write mutation — not executed |
| Session rotation POST | Sensitive write — not executed |

---

## 4. Phase 2 — Integration Audit

| Integration | Status |
|-------------|--------|
| Data Sources | Telegram sources visible; sync endpoint exists (not POST-tested) |
| Pipeline | Message stats visible in Telegram Data Panel (39k+ processed) |
| `/api/v1/telegram/*` feed | 200 with auth |
| Publisher | Separate tab; collector health in DataHub health snapshot |
| Automation Routing | No broken references observed in shared health queries |
| Access Control | RBAC write gate added to collector action buttons |

No orphan channel IDs detected in UI (45 collector channels, 44 synced on primary account).

---

## 5. Phase 3 — UI/UX Redesign

### Design system alignment

| Before (P2) | After (P3) |
|-------------|------------|
| Ad-hoc `Card` + dynamic Tailwind (`from-${color}-500`) | `DATAHUB_SHELL`, `MetricCard`, `DataHubSectionHeader` |
| Inline login wizard (both steps visible) | `TelegramLoginWizard` step-based modal |
| Plain red error text | `DataHubAlert` |
| Diagnose as text blob only | `CollectorDiagnoseCards` + structured checks state |
| No RBAC on actions | `useDataHubPermissions` + `dataHubWriteGate` |
| Missing i18n keys | 20+ keys added (en/fa, blue/green) |

### New modules

- `hooks/useTelegramCollector.ts` — React Query for accounts/channels/health/polling
- `telegram/telegramCollectorLabels.ts` — health level, status labels, diagnose formatting
- `telegram/TelegramCollectorMetrics.tsx`
- `telegram/CollectorDiagnoseCards.tsx`

---

## 6. Phase 4/7 — Backend Security Hardening

### `telegram-collector/utils/accountApiSanitizer.js` (expanded)

| Response | Stripped | Added |
|----------|----------|-------|
| Accounts | `session_string`, `api_hash`, `api_id` | `phone_masked`, `has_session`; `phone` replaced with mask |
| Session status | `phone_number` | `phone_masked` |
| Health session block | `phone_number` | `phone_masked` |
| Login start | `phoneCodeHash` | `phone_masked` |
| Login confirm | `session` (full MTProto string) | `phone_masked`, sanitized `account` |
| Logout | raw account row | sanitized account |

### Production proof

```text
GET /api/telegram-collector/accounts
phone: +98***55
session_string: absent
```

Login/cancel now rate-limited (`auth` limiter on cancel).

**Remaining GAP:** Collector HTTP API has no JWT auth layer (internal nginx proxy only). Session rotation POST still unauthenticated — document for P4.

---

## 7. Phase 6 — DevOps

| Check | Result |
|-------|--------|
| pm2 `telegram-collector` | online after restart |
| Port 5003 | listening |
| nginx upstream | `:5003` |
| `telegram-collector-monitor` | default `COLLECTOR_URL` → `:5003` |
| Build | `npm run build` PASS |
| Tests | 19 PASS (`telegramCollectorErrors` + `telegramCollectorP3`) |

---

## 8. Phase 8 — Performance (nginx)

| Endpoint | Latency |
|----------|---------|
| health | ~573 ms |
| session/status | ~450 ms |
| accounts | ~544 ms |
| collector-channels | ~441 ms |
| metrics | ~460 ms |

All collector GET **< 600 ms** through nginx. `/api/v1/telegram/stats/real-time` slower (~22s in auth probe) — separate backend query, not collector route.

---

## 9. Phase 10 — Browser Evidence

| Artifact | Path |
|----------|------|
| Screenshot | [`screenshots/telegram-collector-p3-current.png`](./screenshots/telegram-collector-p3-current.png) |
| JSON evidence | [`screenshots/telegram-collector-p3-browser-evidence.json`](./screenshots/telegram-collector-p3-browser-evidence.json) |
| Audit script | `backend/scripts/telegram-collector-p3-functional-audit.mjs` |

### UI metrics (2026-06-28)

- Collector Status: **Healthy**
- Accounts/channels visible
- No HTML 404 banner
- Login Wizard label present
- Console: unrelated MEXC market 404 noise only

### Tab checks

| Tab | Loaded | Notes |
|-----|--------|-------|
| Overview | ✅ | |
| AI Inbox | ✅ | |
| Categories | ⚠️ | Tab selector timeout in headless run — manual QA recommended |
| Breaking News | ✅ | |
| Geographic Map | ✅ | |

---

## 10. Remaining GAPs (P4+)

1. **Login/Import/Sync E2E** — requires Human QA with Telegram OTP
2. **Collector API authentication** — JWT or mTLS for write endpoints
3. **PORT drift** — `.env PORT=3002` vs pm2 `5003`
4. **`channels/refresh` stub** — returns `{ success: true }` without logic
5. **Categories tab** — verify tab label/i18n in Human QA
6. **Raw i18n keys** — audit flagged possible `collector_*` keys in tab text; review locale loading in Telegram Data Panel subtabs
7. **force-sync schema** — legacy route may have column mismatch (polling path unaffected)

---

## 11. Architecture (unchanged ingestion)

```text
Browser → nginx → telegram-collector:5003 → PostgreSQL
                                      ↓
                              telegram_messages
                                      ↓
                         titan-backend scheduler → collected_data → Pipeline
```

Ingestion not modified in P3.

---

## 12. Final Verdict

### **COLLECTOR READ PATHS VERIFIED + UI REDESIGNED + SECURITY HARDENED**

| Criterion | Met? |
|-----------|------|
| Login E2E | ❌ (OTP not executed) |
| Import | ❌ (write not executed) |
| Sync | ❌ (POST not executed) |
| Accounts/Channels load | ✅ |
| Diagnostics | ✅ |
| Health | ✅ |
| Security masking | ✅ |
| UI design system | ✅ |
| Tests + build | ✅ |

**Do not mark REAL WORKING** until Human QA completes OTP login, import, and sync workflows.
