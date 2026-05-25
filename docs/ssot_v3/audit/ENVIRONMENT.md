## ENVIRONMENT – Baseline Audit (SSOT v3.0)

> **Rule**: در این سند فقط واقعیت‌های مشاهده‌شده/استخراج‌شده از کد یا runtime نوشته می‌شود؛ **بدون حدس**.

### Runtime Versions (Observed)

- **Node.js**: v20.19.5
- **npm**: 10.8.2
- **yarn**: 1.22.22
- **PostgreSQL client (psql)**: 14.20 (Ubuntu)

### Package Manager

- **Frontend**: `package.json` (Vite).  
  Evidence: `package.json` (scripts: `dev/build/preview`).
- **Backend**: `backend/package.json` (Express, Postgres, node-pg-migrate wrapper).  
  Evidence: `backend/package.json` (scripts: `start/dev/migrate`).

### How to start Backend

Source: `backend/package.json` scripts.

- **Dev**: `npm run dev` (در مسیر `backend/`)
- **Prod**: `npm run start` (در مسیر `backend/`)

Notes:

- Backend روی `PORT` (پیش‌فرض 5001) listen می‌کند.  
  Source: `backend/server.js` (PORT from `process.env.PORT`).
- Backend در خود پروسه می‌تواند برخی background services را init کند (Redis, MessageQueue, WebSocket, GraphQL, Autopilot worker، و Engine worker اگر `ENGINE_ENABLED=true`).  
  Source: `backend/server.js`.
- در deployment production، PM2 ecosystem وجود دارد و **engine worker جدا** با نام `titan-engine-worker` تعریف شده است.  
  Evidence: `backend/ecosystem.config.json` (apps: `titan-backend`, `titan-engine-worker`).

### Process Supervision & Restart (PM2)

- **Start / Restart stack در production (API + Engine/Workers)**:
  - `pm2 start backend/ecosystem.config.json` (اولین‌بار، برای ایجاد apps `titan-backend` و `titan-engine-worker`).
  - `pm2 restart titan-backend titan-engine-worker` بعد از هر deploy backend (routes جدید، تغییرات Artemis/Training/Analytics و ...).
- **Behavior after reboot**:
  - PM2 با تنظیمات ecosystem (`autorestart: true`, `min_uptime`, `max_restarts`) فرآیندها را بعد از crash/reboot بالا نگه می‌دارد، به شرط این‌که خود PM2 به‌عنوان سرویس systemd (یا معادل آن) کانفیگ شده باشد.
- **Monitoring**:
  - `pm2 list` برای مشاهده وضعیت `titan-backend`, `titan-engine-worker` و سایر پروسه‌ها.
  - لاگ‌ها: `~/.pm2/logs/titan-backend-*.log`, `~/.pm2/logs/titan-engine-*.log`.

### How to start Workers

**داخل backend server (in-process):**

- Engine worker (اختیاری): با `ENGINE_ENABLED=true`
- Autopilot worker: در startup (interval: 5 دقیقه)
- Favorites alert monitor: در startup (interval: 10 ثانیه)

Source: `backend/server.js`.

**Runtime-external (Production / PM2):**

- `titan-engine-worker`:
  - entrypoint: `backend/workers/engineWorkerLeader.js`
  - env gates: `ENGINE_MODE`, `AUTOPILOT_ENABLED`, `SCHEDULER_ENABLED`, `TRADING_ENGINE_ENABLED`, `IDLE_MODE_ENABLED`, `IDLE_CHECK_INTERVAL_MS`
  - env_file: `backend/.env` (runtime-external; محتوا در این سند فقط به صورت نام کلیدها ثبت می‌شود)
  
Evidence: `backend/ecosystem.config.json`.

### How to start Frontend

Source: `package.json` scripts.

- **Dev**: `npm run dev`
- **Build**: `npm run build`
- **Preview**: `npm run preview`

### Database

- **Driver**: `pg`
- **Migrations (Single Source of Truth)**:
  - دایرکتوری رسمی migrations: `backend/database/migrations` (استفاده از `node-pg-migrate`).
  - اسکریپت‌های اصلی:
    - `npm run migrate` → wrapper روی `database/migrate.js` (مسیر رسمی برای up).
    - `npm run migrate:up` / `npm run migrate:down` / `npm run migrate:status` / `npm run migrate:redo`.
  - دایرکتوری `backend/migrations` فقط به‌عنوان **Legacy/Archive** نگه‌داری می‌شود و در مسیر رسمی migrate/CI استفاده نمی‌شود (جزئیات در `backend/migrations/README_legacy.md`).

Source: `backend/package.json`, `backend/database/migrate.js`, `backend/migrations/README_legacy.md`.

### Bootstrap from Empty Database (Greenfield)

برای راه‌اندازی یک دیتابیس خالی dev/test که تمام ماژول‌های AI را هم داشته باشد:

1. **ساخت DB خالی** (مثال محلی):
   - `createdb -h localhost -p 5433 -U postgres titangold_ai_bootstrap_test`
2. **اجرای chain کامل migrations روی همین DB**:
   - تنظیم `DATABASE_URL` به DB جدید (مثلاً `postgresql://postgres@localhost:5433/titangold_ai_bootstrap_test`).
   - اجرای: `cd backend && DATABASE_URL=... npm run migrate`  
   - این دستور `000_init_ai_schema.sql` و تمام migrationهای بعدی را روی DB خالی اعمال می‌کند و جداول هسته‌ای اپ + AI را ایجاد می‌کند.
3. **نکته**:
   - بعضی migrationها (مثلاً `add_2fa_backup_codes`) به جداول core مثل `users` وابسته‌اند؛ chain کامل node-pg-migrate روی یک DB خالی باید روی همـان اسکیما‌ی اپلیکیشن استاندارد اجرا شود (یعنی همان جایی که `users` و بقیه جداول اصلی ساخته می‌شوند)، نه روی یک DB که فقط `000_init_ai_schema.sql` به‌تنهایی اجرا شده باشد.

### Migration verification — DataHub automation (2026-05-24)

**علت fail قبلی:** `012_add_ab_testing.sql` — `REFERENCES ai_decisions(id)` بعد از `006_partition_ai_decisions.sql` نامعتبر است (PK پارتیشن‌شده = `(id, created_at)`).

**Fix:** `decision_id UUID` بدون FK در `experiment_metrics`؛ ایندکس/کامنت soft-reference.

**Fix جانبی:** `query_performance_optimization.sql` — ایندکس/ANALYZE روی `request_logs`/`error_logs` فقط اگر جدول وجود داشته باشد (greenfield با `database/schema.sql`).

**نتیجه روی dev DB (`titangold_db`):**

```bash
cd backend && npm run migrate
# → Migrations complete! (شامل 012_add_ab_testing, 025, 026, 027)
```

جداول automation:

```sql
\dt datahub_automation*
-- datahub_automation_topics, _queue, _schedule, _executions
```

**Demo واقعی (DB + service layer):**

```bash
cd backend && node scripts/verify_automation_demo.js
```

خروجی تأیید‌شده: create topic → queue refresh (added≥1) → fail item → retry → dry-run dispatch → execution history.

**Greenfield کامل (`schema.sql` + migrate):** هنوز migrationهای legacy قدیمی‌تر (مثلاً `004_add_autopilot_system`) ممکن است به ستون‌هایی وابسته باشند که در `database/schema.sql` نیستند؛ مسیر رسمی verify برای automation: **migrate روی DB dev موجود** + اسکریپت demo بالا.

### Migration verification — DataHub filter rules (GAP-024 · 2026-05-25)

| Field | Value |
|-------|--------|
| Migration file | `backend/database/migrations/028_create_datahub_filter_rules.sql` |
| Table | `datahub_filter_rules` |
| Environment | **dev** — `titangold_db` on `127.0.0.1:5433` (same host as automation proof) |
| Command | `cd backend && npm run migrate` |
| Result | **PASS** — log includes `MIGRATION 028_create_datahub_filter_rules (UP)` and `Migrations complete!` |

Verify table:

```sql
\dt datahub_filter_rules
SELECT COUNT(*) FROM datahub_filter_rules WHERE deleted_at IS NULL;
```

Runtime demos: `docs/ssot_v3/DataHub_DEMOS.md` § `dataHub.advanced.blacklist` (ingestion 403, batch `blocked`, evaluate-only publishing).

### Migration verification — DataHub crawlers (GAP-026 · 2026-05-25)

| Field | Value |
|-------|--------|
| Migration file | `backend/database/migrations/029_create_datahub_crawlers.sql` |
| Tables | `datahub_crawlers`, `datahub_crawler_runs` |
| Environment | **dev** — `titangold_db` @ `127.0.0.1:5433` |
| Command | `cd backend && npm run migrate` |
| Result | **PASS** — `029_create_datahub_crawlers (UP)` |

Optional env: `CRAWLER_RENDER_JS_ENABLED=true` to allow Playwright `render_js` crawls (default off in production).

### Migration verification — DataHub discovery (GAP-028 · 2026-05-25)

| Field | Value |
|-------|--------|
| Migration | `030_create_datahub_discovery.sql` |
| Tables | `datahub_discovery_settings`, `datahub_discovery_rules`, `datahub_discovery_scans`, `datahub_discovery_suggestions` |
| DB | dev `titangold_db` @ `127.0.0.1:5433` |
| Command | `cd backend && npm run migrate` → **PASS** |

### Environment Proof — `dataHub.advanced.automation` (2026-05-24)

> **Scope:** dev DB on application server (`ubuntu` host) — **not production.**  
> Repo path on server: `/home/ubuntu/webapp/TitanGold`.  
> هیچ secret/token/password در این بخش ثبت نمی‌شود.

#### Host / toolchain

| Field | Value |
|-------|--------|
| `hostname` | `ubuntu` |
| `pwd` (repo root) | `/home/ubuntu/webapp/TitanGold` |
| `git` branch | `feat/gap-008-sources-backend-wiring` |
| `git` commit (short) | `caeef9d` |
| `node -v` | `v20.18.2` |
| `npm -v` | `10.8.2` |
| `NODE_ENV` (backend `.env`) | `development` |

#### Database identity (no credentials)

| Field | Value |
|-------|--------|
| Environment label | **dev** — `titangold_db` on local Postgres instance |
| `current_database()` | `titangold_db` |
| `current_user` | `postgres` |
| `inet_server_addr()` | `127.0.0.1` |
| `inet_server_port()` | `5433` |
| Connection pattern | `localhost:5433` (trust auth on dev host; not a remote prod cluster) |

```sql
-- Captured via psql -h localhost -p 5433 -U postgres -d titangold_db
SELECT current_database(), current_user, inet_server_addr(), inet_server_port();
-- titangold_db | postgres | 127.0.0.1/32 | 5433
```

#### Migration status (automation-related)

| Migration | Applied (`run_on`) |
|-----------|-------------------|
| `012_add_ab_testing` | 2026-05-24 15:27:01 UTC |
| `025_create_telegram_publishers` | 2026-05-24 15:27:01 UTC |
| `026_create_datahub_automation_topics` | 2026-05-24 15:27:01 UTC |
| `027_create_datahub_automation_queue` | 2026-05-24 15:27:01 UTC |

Latest migration in chain (reference): `20260216_add_priority_error_tracking` @ 2026-05-24 15:27:03 UTC.

`npm run migrate` on this host/DB: **complete** (no pending 025–027).

#### Demo script summary (`backend/scripts/verify_automation_demo.js`)

Run: `cd /home/ubuntu/webapp/TitanGold/backend && node scripts/verify_automation_demo.js`

| Step | Result |
|------|--------|
| Automation tables present | 4 (`topics`, `queue`, `schedule`, `executions`) |
| Create topic | OK |
| Queue refresh | `added: 5`, `pending: 6` |
| Fail queue item | OK |
| Retry failed execution | OK |
| Manual dispatch (dry-run) | `processed: 1` |
| Execution history | 7 rows; latest `sent` (dry-run) |
| Cleanup | demo topic deleted |

**SSOT:** با این proof، `dataHub.advanced.automation` = **Implemented** (final on dev server DB).


### Required ENV keys (Names only)

این لیست از روی `.env.example`ها، `ecosystem.config.json` و جست‌وجوی `process.env.*` در backend استخراج شده است (مقادیر عمداً حذف شده‌اند).

#### Core

- `NODE_ENV`
- `PORT`

#### DB (Postgres)

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DATABASE_URL`

#### DB Pool / Observability

- `DB_POOL_MAX`
- `DB_POOL_MIN`
- `DB_POOL_IDLE_TIMEOUT`
- `DB_POOL_CONNECTION_TIMEOUT`
- `DB_POOL_MAX_LIFETIME`
- `DB_POOL_LEAK_THRESHOLD`
- `DB_POOL_METRICS_INTERVAL`
- `SLOW_QUERY_THRESHOLD_MS`

#### Auth / Security

- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `REFRESH_TOKEN_EXPIRES_IN`
- `ENCRYPTION_KEY`
- `MASTER_KEY`

#### CORS / Rate limit

- `CORS_ALLOWED_ORIGINS`
- `CORS_ORIGIN`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`
- `RATE_LIMIT_MAX`

#### Redis / MQ

- `REDIS_URL`
- `REDIS_PASSWORD`
- `RABBITMQ_URL`

#### AI Providers / Orchestration

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `AI_MAX_CONCURRENCY`
- `AI_TIMEOUT_MS`
- `ORCH_TIMEOUT_MS`
- `ORCH_MAX_CONCURRENCY`

#### External Data APIs (Fundamental / Sentiment / News)

- `ALPHA_VANTAGE_API_KEY`
- `GLASSNODE_API_KEY`
- `NEWSAPI_KEY`
- `NEWS_API_KEY`
- `CRYPTOPANIC_API_KEY`
- `TWITTER_API_KEY`
- `TWITTER_BEARER_TOKEN`

#### Telegram

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_READ_MODE` (اختیاری؛ پیش‌فرض: در production برابر `auth-role` و در dev/test برابر `dev-open` است. مقادیر مجاز: `auth-role`, `internal`, `dev-open`.)
- `INTERNAL_TRUSTED_IPS` (اختیاری؛ لیست IPهای مجاز برای حالت `internal`، جداشده با کاما)
- `INTERNAL_TELEGRAM_SECRET` (اختیاری؛ shared secret برای هدر داخلی در حالت `internal`)

#### Engine / Workers / Schedulers

- `ENGINE_ENABLED`
- `ENGINE_TICK_INTERVAL_MS`
- `ENGINE_MAX_BACKOFF_MS`
- `ENGINE_USER_ID`
- `ENGINE_MODE`
- `AUTOPILOT_ENABLED`
- `SCHEDULER_ENABLED`
- `TRADING_ENGINE_ENABLED`
- `IDLE_MODE_ENABLED`
- `IDLE_CHECK_INTERVAL_MS`
- `TRADING_MODE`
- `DATAHUB_FETCH_INTERVAL_MS`
- `TELEGRAM_PIPELINE_INTERVAL_MS`

#### Docs / Build metadata

- `SWAGGER_SERVER_URL`
- `GIT_SHA`

#### SSL / Proxy

- `DB_SSL`
- `DB_SSL_REJECT_UNAUTHORIZED`
- `BEHIND_HTTPS_PROXY`
- `EXTERNAL_API_SSL_VERIFY`

