# Engine Runbook - TitanGold Always-on Runtime

تاریخ: 2025-12-24  
هدف: راهنمای کامل برای راه‌اندازی، مدیریت و عیب‌یابی Engine Worker

---

## 1. Overview

Engine Worker یک always-on runtime است که چرخه کامل زیر را به صورت مداوم اجرا می‌کند:

```
DataHub Ingest → 15 AI Agents → Artemis Decision → Telegram Publish
```

**ویژگی‌ها**:
- ✅ Exponential backoff در صورت خطا
- ✅ Heartbeat mechanism برای monitoring
- ✅ Safe shutdown (graceful)
- ✅ کنترل از طریق env vars
- ✅ No new dependencies (فقط از کدهای موجود استفاده می‌کند)

---

## 2. متغیرهای محیطی مورد نیاز

### 2.1 Engine Control (الزامی)

```bash
# Enable/disable engine
ENGINE_ENABLED=true

# Tick interval (milliseconds) - فاصله بین هر cycle
ENGINE_TICK_INTERVAL_MS=60000  # Default: 1 minute

# Maximum backoff (milliseconds) - حداکثر backoff در صورت خطا
ENGINE_MAX_BACKOFF_MS=300000   # Default: 5 minutes
```

### 2.2 Database (الزامی)

```bash
DB_HOST=localhost
DB_PORT=5433
DB_NAME=titangold_db
DB_USER=postgres
DB_PASSWORD=your_password
```

### 2.3 Telegram (اختیاری - برای publishing)

```bash
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

**نکته**: اگر Telegram تنظیم نشده باشد، engine همچنان کار می‌کند اما publishing skip می‌شود.

### 2.4 External AI Providers (برای Artemis Decision)

**حداقل یک provider باید تنظیم شود**:

```bash
# Gemini (internal - از ai.js)
GEMINI_API_KEY=your_key

# Claude/Anthropic
ANTHROPIC_API_KEY=your_key
# یا multi-key:
ANTHROPIC_API_KEYS=key1,key2,key3

# OpenAI
OPENAI_API_KEY=your_key
# یا multi-key:
OPENAI_API_KEYS=key1,key2,key3

# DeepSeek
DEEPSEEK_API_KEY=your_key
# یا multi-key:
DEEPSEEK_API_KEYS=key1,key2,key3

# OpenRouter
OPENROUTER_API_KEY=your_key
# یا multi-key:
OPENROUTER_API_KEYS=key1,key2,key3
OPENROUTER_MODEL=openai/gpt-4o-mini  # اختیاری
OPENROUTER_HTTP_REFERER=https://titangold.com  # اختیاری
OPENROUTER_X_TITLE=TitanGold AI  # اختیاری
```

**نکته**: اگر هیچ provider تنظیم نشده باشد، `getMixtureDecision` `null` برمی‌گرداند و Telegram publishing skip می‌شود.

---

## 3. نصب و راه‌اندازی

### 3.1 Manual Start (Development)

```bash
# 1. تنظیم env vars در .env
cd backend
cp .env.example .env
# ویرایش .env و اضافه کردن ENGINE_ENABLED=true

# 2. راه‌اندازی engine worker
node workers/engineWorker.js
```

**خروجی مورد انتظار**:
```
🚀 Engine Worker starting...
   Tick interval: 60000ms
   Max backoff: 300000ms

🔄 Engine cycle #1 starting...
📊 Step 1: Refreshing DataHub...
   ✅ DataHub refresh completed (X sources)
🤖 Step 2: Coordinating AI agents...
   ✅ Agents coordinated: 15/15 succeeded
🧠 Step 3: Getting Artemis decision...
   ✅ Decision: BUY, Confidence: 85.5%
📱 Step 4: Publishing to Telegram...
   ✅ Published to Telegram
✅ Full cycle completed
✅ Cycle #1 completed in 45230ms
```

### 3.2 Integrated Start (با API Server)

Engine Worker به صورت خودکار با API server شروع می‌شود اگر `ENGINE_ENABLED=true`:

```bash
cd backend
node server.js
```

**خروجی مورد انتظار**:
```
🚀 TitanGold Backend API
...
✅ Engine Worker started
```

---

## 4. Systemd Service (Production)

### 4.1 نصب Service Files

```bash
# کپی کردن service files
sudo cp docs/deployment/titan-api.service /etc/systemd/system/
sudo cp docs/deployment/titan-engine.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload
```

### 4.2 تنظیمات

**ویرایش `/opt/titangold/.env`** (یا مسیر env file شما):
```bash
ENGINE_ENABLED=true
ENGINE_TICK_INTERVAL_MS=60000
ENGINE_MAX_BACKOFF_MS=300000
# ... سایر env vars
```

**تغییر مسیرها در service files**:
- `WorkingDirectory`: مسیر `backend` directory
- `EnvironmentFile`: مسیر `.env` file
- `User`/`Group`: user مناسب (مثلاً `titangold`)

### 4.3 شروع Services

```bash
# Start API server
sudo systemctl start titan-api
sudo systemctl enable titan-api  # Auto-start on boot

# Start Engine worker
sudo systemctl start titan-engine
sudo systemctl enable titan-engine  # Auto-start on boot
```

### 4.4 بررسی وضعیت

```bash
# Status
sudo systemctl status titan-api
sudo systemctl status titan-engine

# Logs
sudo journalctl -u titan-api -f
sudo journalctl -u titan-engine -f

# Logs (last 100 lines)
sudo journalctl -u titan-engine -n 100
```

---

## 5. Health Check

### 5.1 API Health Endpoint

```bash
curl http://localhost:5001/health
```

**Response**:
```json
{
  "status": "healthy",
  "database": "connected",
  "engine": {
    "enabled": true,
    "isRunning": true,
    "lastSuccessfulCycle": "2025-12-24T10:30:00.000Z",
    "lastError": null,
    "cycleCount": 150,
    "heartbeatFresh": true
  },
  "uptime": 3600
}
```

**نکات**:
- `heartbeatFresh`: باید `true` باشد (heartbeat < 2 دقیقه)
- `lastError`: اگر `null` نباشد، آخرین خطا را نشان می‌دهد
- `cycleCount`: تعداد cycleهای موفق

### 5.2 Heartbeat File

```bash
cat backend/logs/engine-heartbeat.json
```

**محتوا**:
```json
{
  "timestamp": "2025-12-24T10:30:00.000Z",
  "lastSuccessfulCycle": "2025-12-24T10:30:00.000Z",
  "lastError": null,
  "cycleCount": 150,
  "isRunning": true
}
```

---

## 6. مدیریت و کنترل

### 6.1 Stop Engine

**Manual**:
```bash
# اگر به صورت standalone اجرا شده:
Ctrl+C

# اگر با API server اجرا شده:
# Engine با API server stop می‌شود
```

**Systemd**:
```bash
sudo systemctl stop titan-engine
```

### 6.2 Restart Engine

```bash
sudo systemctl restart titan-engine
```

### 6.3 Disable Engine (بدون stop کردن)

```bash
# ویرایش .env
ENGINE_ENABLED=false

# Restart
sudo systemctl restart titan-engine
# یا restart API server
```

**نکته**: اگر `ENGINE_ENABLED=false` باشد، engine worker شروع نمی‌شود و خطایی نمی‌دهد (safe exit).

---

## 7. Log Inspection

### 7.1 Console Logs (Development)

Engine worker لاگ‌های زیر را چاپ می‌کند:

```
🔄 Engine cycle #N starting...
📊 Step 1: Refreshing DataHub...
🤖 Step 2: Coordinating AI agents...
🧠 Step 3: Getting Artemis decision...
📱 Step 4: Publishing to Telegram...
✅ Cycle #N completed in Xms
```

### 7.2 Systemd Logs (Production)

```bash
# Real-time logs
sudo journalctl -u titan-engine -f

# Last 100 lines
sudo journalctl -u titan-engine -n 100

# Logs since today
sudo journalctl -u titan-engine --since today

# Logs with timestamps
sudo journalctl -u titan-engine -o short-precise
```

### 7.3 Error Logs

```bash
# فقط خطاها
sudo journalctl -u titan-engine -p err

# خطاها و warnings
sudo journalctl -u titan-engine -p warning
```

---

## 8. عیب‌یابی (Troubleshooting)

### 8.1 Engine شروع نمی‌شود

**علت 1**: `ENGINE_ENABLED=false`
```bash
# بررسی .env
grep ENGINE_ENABLED .env
# باید ENGINE_ENABLED=true باشد
```

**علت 2**: Database connection failed
```bash
# بررسی database
psql -h localhost -p 5433 -U postgres -d titangold_db
# باید connect شود
```

**علت 3**: Missing dependencies
```bash
# بررسی node_modules
cd backend
npm install
```

### 8.2 Engine در loading گیر می‌کند

**بررسی**:
```bash
# بررسی logs
sudo journalctl -u titan-engine -n 50

# بررسی heartbeat
cat backend/logs/engine-heartbeat.json
# اگر timestamp قدیمی است (> 2 دقیقه)، engine ممکن است hang شده باشد
```

**راه‌حل**:
```bash
# Restart engine
sudo systemctl restart titan-engine
```

### 8.3 Backoff زیاد (cycleها fail می‌شوند)

**بررسی**:
```bash
# بررسی logs برای خطاها
sudo journalctl -u titan-engine -p err -n 20
```

**علل رایج**:
- Database connection lost
- AI provider API keys invalid
- Network issues

**راه‌حل**:
```bash
# بررسی env vars
cat .env | grep -E "(API_KEY|DB_)"

# بررسی network
curl https://api.openai.com/v1/models  # Test OpenAI
curl https://api.anthropic.com  # Test Claude

# Restart engine
sudo systemctl restart titan-engine
```

### 8.4 Telegram publishing fail می‌شود

**بررسی**:
```bash
# بررسی env vars
grep TELEGRAM .env

# Test Telegram manually
node -e "
const { telegramService } = require('./backend/services/telegram.js');
telegramService.sendMessage('Test message').then(() => console.log('OK')).catch(e => console.error(e));
"
```

**نکته**: اگر Telegram fail شود، engine cycle ادامه می‌یابد (Telegram failure نباید engine را stop کند).

---

## 9. Smoke Test Checklist

### 9.1 Pre-flight Checks

- [ ] `ENGINE_ENABLED=true` در `.env`
- [ ] Database در دسترس است
- [ ] حداقل یک AI provider key تنظیم شده
- [ ] `backend/logs/` directory وجود دارد

### 9.2 Start Test

- [ ] Engine worker شروع می‌شود (no crash)
- [ ] Console logs نشان می‌دهد cycleها در حال اجرا هستند
- [ ] Heartbeat file ایجاد می‌شود

### 9.3 Runtime Test

- [ ] Cycleها به صورت مداوم اجرا می‌شوند
- [ ] `/health` endpoint `engine.isRunning: true` نشان می‌دهد
- [ ] Heartbeat fresh است (< 2 دقیقه)

### 9.4 Failure Test

- [ ] Simulate provider failure (invalid API key)
- [ ] Engine باید backoff اعمال کند
- [ ] Engine نباید crash کند
- [ ] بعد از backoff، cycle دوباره شروع می‌شود

### 9.5 Shutdown Test

- [ ] `SIGTERM` graceful shutdown
- [ ] Heartbeat `isRunning: false` می‌شود
- [ ] No unhandled promise rejections

---

## 10. Rollback Steps

اگر مشکلی پیش آمد:

### 10.1 Disable Engine

```bash
# ویرایش .env
ENGINE_ENABLED=false

# Restart
sudo systemctl restart titan-api
# یا
sudo systemctl restart titan-engine
```

### 10.2 Stop Engine Service

```bash
sudo systemctl stop titan-engine
sudo systemctl disable titan-engine
```

### 10.3 Remove Engine Integration

```bash
# Revert server.js changes (اگر نیاز باشد)
git checkout backend/server.js
```

---

## 11. Performance Tuning

### 11.1 Tick Interval

**کاهش interval** (cycleهای بیشتر):
```bash
ENGINE_TICK_INTERVAL_MS=30000  # 30 seconds
```

**افزایش interval** (کاهش load):
```bash
ENGINE_TICK_INTERVAL_MS=120000  # 2 minutes
```

### 11.2 Backoff

**کاهش max backoff** (retry سریع‌تر):
```bash
ENGINE_MAX_BACKOFF_MS=60000  # 1 minute
```

**افزایش max backoff** (کاهش pressure در صورت خطا):
```bash
ENGINE_MAX_BACKOFF_MS=600000  # 10 minutes
```

---

## 12. Monitoring Recommendations

### 12.1 Health Check Monitoring

```bash
# Cron job برای health check (هر 1 دقیقه)
*/1 * * * * curl -f http://localhost:5001/health || echo "Engine unhealthy" | mail -s "Engine Alert" admin@example.com
```

### 12.2 Log Monitoring

```bash
# Monitor errors
journalctl -u titan-engine -p err -f | while read line; do
  echo "$line" | mail -s "Engine Error" admin@example.com
done
```

### 12.3 Heartbeat Monitoring

```bash
# Check heartbeat freshness (script)
#!/bin/bash
HEARTBEAT_FILE="/opt/titangold/backend/logs/engine-heartbeat.json"
if [ -f "$HEARTBEAT_FILE" ]; then
  TIMESTAMP=$(jq -r '.timestamp' "$HEARTBEAT_FILE")
  AGE=$(( $(date +%s) - $(date -d "$TIMESTAMP" +%s) ))
  if [ $AGE -gt 120 ]; then
    echo "Engine heartbeat stale (${AGE}s old)" | mail -s "Engine Alert" admin@example.com
  fi
fi
```

---

## 13. فایل‌های مرتبط

- `backend/workers/engineWorker.js` - Engine worker implementation
- `backend/server.js` - Integration point
- `backend/services/artemisOrchestrator.js` - Artemis decision logic
- `backend/services/telegram.js` - Telegram publishing
- `docs/deployment/titan-engine.service` - Systemd service template
- `docs/reports/ENGINE_INVENTORY.md` - Inventory of existing code

---

## 14. خلاصه تغییرات

### فایل‌های ایجاد شده:
- `backend/workers/engineWorker.js` - Engine worker
- `docs/deployment/titan-api.service` - API systemd template
- `docs/deployment/titan-engine.service` - Engine systemd template
- `docs/reports/ENGINE_INVENTORY.md` - Inventory
- `docs/reports/ENGINE_RUNBOOK.md` - This file

### فایل‌های تغییر یافته:
- `backend/server.js` - Integration با engine worker + health endpoint extension

### Env Vars جدید:
- `ENGINE_ENABLED` - Enable/disable engine
- `ENGINE_TICK_INTERVAL_MS` - Cycle interval
- `ENGINE_MAX_BACKOFF_MS` - Max backoff

---

**پایان Runbook**

