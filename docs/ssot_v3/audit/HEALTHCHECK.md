## HEALTHCHECK – Runtime Verification (SSOT v3.0)

> **Rule**: نتیجه‌ها باید evidence داشته باشند (Path/Method + File+Line برای تعریف route، و در صورت امکان نتیجه تست runtime).

### Targets (Phase 1)

Mandatory:

- [x] `/api/v1/artemis/health`
- [x] `/api/v1/trading-engine/status`
- [x] `/api/v1/ai-agents`
- [x] `/api/v1/topic-routing`

Discovered during Phase 1 (Training / Analytics):

- [x] `/api/v1/training/sessions`
- [x] `/api/v1/artemis/logs` (AI decisions + system logs)
- [x] `/api/v1/artemis/learning` (learning events)
- [x] `/api/v1/artemis/orchestration` (agent tasks view)

---

### Verification Table

| Endpoint | Method | Auth | Expected | Runtime Result | Evidence (File+Line) |
|---|---:|---:|---|---|---|
| `/health` | GET | No | API health JSON (DB/Redis non-blocking) | ✅ 200 – `status=healthy`, `database=connected` | `backend/server.js:L190-L250` |
| `/api/v1/artemis/health` | GET | Yes | Providers health summary | ✅ 200 – `ready=true`, `activeInstances=3` | `backend/routes/artemis.js:L33-L79` |
| `/api/v1/trading-engine/status` | GET | Yes | Engine status JSON | ✅ 200 – `isRunning=false`, `mode=demo` | `backend/routes/trading-engine.js:L8-L52` |
| `/api/v1/ai-agents` | GET | Yes | Agent list | ✅ 200 – `agents=15` | `backend/routes/ai-agents.js:L1646-L1699` |
| `/api/v1/topic-routing` | GET | Yes | Routing rules list | ✅ 200 – `rules=4` | `backend/routes/topic-routing.js:L14-L28` |
| `/api/v1/training/sessions` | GET | Yes | Latest 50 sessions | ✅ 200 – `sessions=0` (empty array) | `backend/routes/training.js:L7-L16` |
| `/api/v1/telegram/health` | GET | No | Telegram pipeline DB health | ✅ 200 – `status=healthy`, `totalMessages≈279k` | `backend/routes/telegram.js:L20-L46` |
| `/api/v1/artemis/logs` | GET | Yes | AI logs JSON (systemLogs + decisions) | ✅ 200 – `systemLogs=0`, `decisions=1` | `backend/routes/artemis.js:L510-L550` |
| `/api/v1/artemis/learning` | GET | Yes | Learning events JSON | ✅ 200 – `improvements=0`, `mistakes=0` | `backend/routes/artemis.js:L630-L713` |
| `/api/v1/artemis/orchestration` | GET | Yes | Agent tasks / resource allocation JSON | ✅ 200 – `activeAgents=15`, `agentTasks=0` | `backend/routes/artemis.js:L752-L848` |

---

### Demo Steps (Phase 1)

> بعد از آماده شدن ENV و اجرای backend، این بخش با steps قابل تکرار پر می‌شود (یا اسکرین رکورد).

- [x] Start backend (dev)
- [x] Call endpoints (curl) + capture status/summary
- [ ] Confirm UI shows real data for at least one AI Center tab using these endpoints (Phase 1 demo target: AI Manager overview + DataHub Telegram health)

#### Runtime verification notes (this run)

- **Backend run config (dev)**:
  - `PORT=5051`
  - DB: `localhost:5433` / `titangold_db`
  - Auth for protected endpoints: `Authorization: Bearer <JWT>` (JWT با `JWT_SECRET=devsecret` ساخته شد؛ session لازم نبود)
- **Known issues discovered during Phase 1 verification**:
  - Artemis health response validation: **Fixed** (schema weight باید float قبول کند).
  - Artemis logs endpoint: **Fixed** (ستون‌های `ai_decisions.input/output` وجود نداشتند؛ به `input_data/output_data` map شد).

