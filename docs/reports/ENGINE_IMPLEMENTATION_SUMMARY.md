# Engine Implementation Summary

تاریخ: 2025-12-24  
هدف: خلاصه تغییرات و validation steps

---

## خلاصه تغییرات

### فایل‌های ایجاد شده

#### 1. `backend/workers/engineWorker.js` (NEW)
- **مسئولیت**: Always-on runtime worker که چرخه کامل را orchestrate می‌کند
- **تغییرات**: فایل جدید
- **Reason**: نیاز به unified engine cycle (DataHub → Agents → Artemis → Telegram)
- **Risk**: Low - فقط در صورت `ENGINE_ENABLED=true` اجرا می‌شود
- **Validation**:
  - `ENGINE_ENABLED=false` → safe exit (no crash)
  - `ENGINE_ENABLED=true` → engine شروع می‌شود و cycleها اجرا می‌شوند
  - Heartbeat file در `backend/logs/engine-heartbeat.json` ایجاد می‌شود

#### 2. `docs/reports/ENGINE_INVENTORY.md` (NEW)
- **مسئولیت**: Inventory از کدهای موجود مرتبط با engine
- **تغییرات**: فایل جدید
- **Reason**: مستندسازی وضعیت فعلی و gaps
- **Risk**: None (فقط documentation)
- **Validation**: N/A

#### 3. `docs/reports/ENGINE_RUNBOOK.md` (NEW)
- **مسئولیت**: راهنمای کامل برای راه‌اندازی و مدیریت engine
- **تغییرات**: فایل جدید
- **Reason**: نیاز به documentation برای production deployment
- **Risk**: None (فقط documentation)
- **Validation**: N/A

#### 4. `docs/deployment/titan-api.service` (NEW)
- **مسئولیت**: Systemd service template برای API server
- **تغییرات**: فایل جدید
- **Reason**: نیاز به systemd service برای production
- **Risk**: None (فقط template، نصب نمی‌شود)
- **Validation**: N/A

#### 5. `docs/deployment/titan-engine.service` (NEW)
- **مسئولیت**: Systemd service template برای engine worker
- **تغییرات**: فایل جدید
- **Reason**: نیاز به systemd service برای production
- **Risk**: None (فقط template، نصب نمی‌شود)
- **Validation**: N/A

---

### فایل‌های تغییر یافته

#### 1. `backend/server.js`
- **تغییرات**:
  - خط 217-235: اضافه شدن conditional start برای engine worker
  - خط 239-252: اضافه شدن graceful shutdown برای engine worker
  - خط 112-132: Extension برای `/health` endpoint با engine heartbeat
- **Reason**: 
  - Integration engine worker با API server
  - Health check برای monitoring
- **Risk**: Low - فقط در صورت `ENGINE_ENABLED=true` اجرا می‌شود
- **Validation**:
  - `ENGINE_ENABLED=false` → API server بدون engine شروع می‌شود (no regression)
  - `ENGINE_ENABLED=true` → engine worker شروع می‌شود
  - `/health` endpoint engine status را نشان می‌دهد

---

## Env Vars جدید

### Engine Control
- `ENGINE_ENABLED` (boolean): Enable/disable engine
- `ENGINE_TICK_INTERVAL_MS` (number): Interval بین cycleها (default: 60000)
- `ENGINE_MAX_BACKOFF_MS` (number): Max backoff در صورت خطا (default: 300000)

**نکته**: اگر این env vars تنظیم نشده باشند، engine worker شروع نمی‌شود (safe).

---

## Behavior Changes

### قبل از تغییرات:
- Schedulerهای موجود جداگانه کار می‌کردند
- Artemis scheduler فقط placeholder بود
- هیچ unified cycle وجود نداشت

### بعد از تغییرات:
- Engine worker چرخه کامل را orchestrate می‌کند:
  1. DataHub refresh
  2. 15 AI agents coordination
  3. Artemis decision (با external providers)
  4. Telegram publishing
- Exponential backoff در صورت خطا
- Heartbeat mechanism برای monitoring
- Health endpoint شامل engine status

---

## Validation Steps

### 1. Safe When Disabled

```bash
# Test 1: ENGINE_ENABLED=false
export ENGINE_ENABLED=false
node backend/server.js
# Expected: API server starts, engine worker does NOT start, no errors
```

### 2. Engine Starts When Enabled

```bash
# Test 2: ENGINE_ENABLED=true
export ENGINE_ENABLED=true
export ENGINE_TICK_INTERVAL_MS=10000  # 10 seconds for testing
node backend/workers/engineWorker.js
# Expected: Engine starts, cycles run, heartbeat file created
```

### 3. Health Endpoint

```bash
# Test 3: Health check
curl http://localhost:5001/health
# Expected: JSON response with engine status
```

### 4. Heartbeat Freshness

```bash
# Test 4: Check heartbeat
cat backend/logs/engine-heartbeat.json
# Expected: timestamp < 2 minutes old if engine is running
```

### 5. Backoff on Failure

```bash
# Test 5: Simulate failure (invalid API key)
export OPENAI_API_KEY=invalid
export ENGINE_ENABLED=true
node backend/workers/engineWorker.js
# Expected: Engine applies backoff, doesn't crash, retries after backoff
```

### 6. No Regression (API Server)

```bash
# Test 6: API server without engine
export ENGINE_ENABLED=false
node backend/server.js
# Expected: API server works normally, all endpoints functional
```

---

## Manual Validation Checklist

- [ ] `ENGINE_ENABLED=false` → safe exit (no crash)
- [ ] `ENGINE_ENABLED=true` → engine starts
- [ ] Cycleها به صورت مداوم اجرا می‌شوند
- [ ] Heartbeat file ایجاد می‌شود
- [ ] `/health` endpoint engine status نشان می‌دهد
- [ ] Backoff در صورت خطا اعمال می‌شود
- [ ] API server بدون engine کار می‌کند (no regression)
- [ ] Graceful shutdown کار می‌کند

---

## Rollback Plan

اگر مشکلی پیش آمد:

1. **Disable Engine**:
   ```bash
   export ENGINE_ENABLED=false
   # Restart API server
   ```

2. **Revert Changes**:
   ```bash
   git checkout backend/server.js
   ```

3. **Remove Engine Worker**:
   ```bash
   rm backend/workers/engineWorker.js
   ```

---

## فایل‌های مرتبط

- `backend/workers/engineWorker.js` - Engine worker implementation
- `backend/server.js` - Integration point
- `docs/reports/ENGINE_INVENTORY.md` - Inventory
- `docs/reports/ENGINE_RUNBOOK.md` - Runbook
- `docs/deployment/titan-engine.service` - Systemd template

---

**پایان Summary**

