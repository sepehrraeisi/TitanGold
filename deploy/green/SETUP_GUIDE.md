# راهنمای نصب و راه‌اندازی Trading Engine و Scheduler

## 📋 فهرست مطالب

1. [نیازمندی‌ها](#نیازمندی‌ها)
2. [نصب Database](#نصب-database)
3. [پیکربندی Backend](#پیکربندی-backend)
4. [راه‌اندازی سرویس‌ها](#راه‌اندازی-سرویس‌ها)
5. [استفاده از UI](#استفاده-از-ui)
6. [عیب‌یابی](#عیب‌یابی)

---

## نیازمندی‌ها

### سیستم

- Node.js >= 18.x
- PostgreSQL >= 14
- PM2 (برای مدیریت process)

### Dependencies نصب شده

```bash
# Backend dependencies
cd backend
npm install nodemailer  # برای Email Service
# سایر dependencies از قبل نصب هستند
```

---

## نصب Database

### مرحله 1: اجرای Migration اول - Scheduler Config

```bash
cd /path/to/TitanGold

# اجرای migration با psql
psql -h localhost -p 5433 -U postgres -d titangold_db \
  -f database/migrations/001_add_scheduler_config.sql
```

**خروجی مورد انتظار:**

```
CREATE TABLE
INSERT 0 1
```

### مرحله 2: اجرای Migration دوم - Trading Engine Tables

```bash
psql -h localhost -p 5433 -U postgres -d titangold_db \
  -f database/migrations/002_add_trading_engine_tables.sql
```

**خروجی مورد انتظار:**

```
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE INDEX
...
INSERT 0 1
```

### مرحله 3: بررسی جداول ساخته شده

```bash
psql -h localhost -p 5433 -U postgres -d titangold_db -c "\dt" | grep -E "scheduler_config|trading_engine_config|trading_opportunities|trading_stats"
```

**باید این جداول را ببینید:**

- `scheduler_config` - تنظیمات Scheduler
- `trading_engine_config` - تنظیمات Trading Engine
- `trading_opportunities` - صف فرصت‌های معاملاتی
- `trading_stats` - آمار روزانه معاملات

---

## پیکربندی Backend

### مرحله 1: بررسی فایل‌های موجود

```bash
# بررسی وجود engine files
ls -lah backend/engine/
# باید ببینید:
# - scheduler.js
# - tradingEngine.js

# بررسی وجود route files
ls -lah backend/routes/
# باید ببینید:
# - email.js
# - scheduler.js
# - trading-engine.js
```

### مرحله 2: بررسی server.js

باید این خطوط در `backend/server.js` وجود داشته باشند:

```javascript
// Import engine services
import { scheduler } from './engine/scheduler.js';
import { tradingEngine } from './engine/tradingEngine.js';

// Import new routes
import emailRoutes from './routes/email.js';
import schedulerRoutes from './routes/scheduler.js';
import tradingEngineRoutes from './routes/trading-engine.js';

// Register routes
app.use('/api/email', emailRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/trading-engine', tradingEngineRoutes);

// Auto-start scheduler (در قسمت startup)
scheduler.start();
tradingEngine.start();
```

### مرحله 3: اصلاح مشکل Import (اگر لازم است)

اگر خطای `Unknown file extension ".ts"` دریافت کردید:

```bash
# ویرایش backend/engine/scheduler.js
# حذف این خط:
# import * as api from '../../services/api.ts';

# فقط این خط باید باقی بماند:
import { query } from '../database/db.js';
```

**نکته:** این مشکل باید از قبل در کد اصلاح شده باشد.

---

## راه‌اندازی سرویس‌ها

### مرحله 1: ریستارت Backend با PM2

```bash
cd /path/to/TitanGold

# حذف instance قدیمی
pm2 delete titan-backend

# راه‌اندازی مجدد از directory صحیح
cd backend
pm2 start server.js --name titan-backend -i 2

# ذخیره تنظیمات PM2
pm2 save
```

### مرحله 2: بررسی وضعیت سرویس‌ها

```bash
# لیست سرویس‌های PM2
pm2 list

# بررسی لاگ‌ها
pm2 logs titan-backend --lines 50

# باید این پیام‌ها را ببینید:
# ✅ 24/7 Scheduler Service Started
# ✅ All schedulers initialized
# ✅ Trading Engine initialized
```

### مرحله 3: تست Health Backend

```bash
curl http://localhost:5001/health
# خروجی:
# {"status":"healthy","timestamp":"...","database":"connected","uptime":...}
```

**⚠️ توجه:** پورت backend به‌صورت پیش‌فرض `5001` است (نه `5002`).

---

## استفاده از UI

### 1. Trading Engine

**مسیر:** `Trades` → `Professional Autopilot`

**قابلیت‌ها:**

- 🎛️ **Dashboard:** نمایش وضعیت Engine
- 📊 **Statistics:** Total Profit, Win Rate, Active Trades, Queue Size
- 🔴 **Controls:** Start/Stop, Emergency Stop
- ⚙️ **Settings:** پیکربندی scanners و risk limits
- 📋 **Active Trades Table:** معاملات فعال با P&L real-time
- 📥 **Opportunities Queue:** فرصت‌های معاملاتی با اولویت

**ویژگی‌های Trading Engine:**

- ✅ Event-Driven Architecture
- ✅ 4 Scanner: Arbitrage (2s), Price Movement (5s), Volume Spike (10s), Pattern (30s)
- ✅ Priority Queue: CRITICAL → HIGH → MEDIUM → LOW
- ✅ Concurrent Trading: حداکثر 20 معامله همزمان
- ✅ Risk Management:
  - Max Position Size: 10% portfolio
  - Daily Loss Limit: 5%
  - Max Drawdown: 15%
  - Min Confidence: 75%
- ✅ Integration با Artemis Decision Engine
- ✅ Integration با 15 AI Agent
- ✅ Auto-Exit: Take Profit (+5%), Stop Loss (-3%)
- ✅ Demo Mode & Live Mode

### 2. Scheduler (24/7 Automation)

**مسیر:** `AI Center` → `Artemis Settings` → تب `"⏰ 24/7 Scheduler"`

**بخش‌های قابل پیکربندی:**

#### 🤖 Agent Scheduler

- **Interval:** هر 5 دقیقه (پیش‌فرض)
- **عملکرد:** اجرای خودکار 15 AI Agent
- **Enable/Disable:** قابل تنظیم
- **Agents:** انتخاب agents خاص یا همه

#### 📊 Data Hub Scheduler

- **Interval:** هر 2 دقیقه (پیش‌فرض)
- **عملکرد:** Auto-refresh همه data sources
- **Options:**
  - Auto Refresh: ✅
  - Auto Normalize: ✅

#### 🎓 Training Scheduler

- **Interval:** هر 30 دقیقه (پیش‌فرض)
- **عملکرد:** زمان‌بندی خودکار training sessions
- **Options:**
  - Auto Schedule: قابل فعال‌سازی

#### 📈 Analytics Scheduler

- **Interval:** هر 10 دقیقه (پیش‌فرض)
- **عملکرد:** به‌روزرسانی خودکار آمار و analytics

#### 🧠 Artemis Scheduler

- **Interval:** هر 1 دقیقه (پیش‌فرض)
- **عملکرد:** تصمیم‌گیری خودکار Artemis
- **Options:**
  - Auto Decisions: ✅

**نکته:** Scheduler به‌صورت خودکار با start شدن Backend شروع می‌شود.

### 3. Email Configuration

**مسیر:** `Settings` → `Email Configuration`

**فیلدهای مورد نیاز:**

- **Provider:** Gmail, Outlook, Yahoo, Custom
- **Host:** smtp.gmail.com
- **Port:** 587 (TLS) یا 465 (SSL)
- **Username:** your-email@gmail.com
- **Password:** app password (برای Gmail)
- **From Name:** نام فرستنده
- **Test Connection:** دکمه تست اتصال SMTP

---

## API Endpoints

### ⚠️ Authentication مورد نیاز

همه endpoints نیاز به JWT Token دارند که باید در header ارسال شود:

```bash
Authorization: Bearer <your-jwt-token>
```

### Scheduler APIs

```bash
# دریافت وضعیت Scheduler
GET /api/scheduler/status

# شروع Scheduler
POST /api/scheduler/start

# توقف Scheduler
POST /api/scheduler/stop

# به‌روزرسانی تنظیمات یک section خاص
PUT /api/scheduler/config/:section
# مثال: PUT /api/scheduler/config/agents
Body: {
  "enabled": true,
  "interval": 300000
}

# دریافت تنظیمات فعلی
GET /api/scheduler/config
```

**نکته:** برای update config، باید `section` را در URL مشخص کنید: `agents`, `dataHub`, `training`, `analytics`, یا `artemis`.

### Trading Engine APIs

```bash
# دریافت وضعیت Trading Engine
GET /api/trading-engine/status

# شروع Trading Engine
POST /api/trading-engine/start

# توقف Trading Engine
POST /api/trading-engine/stop

# دریافت معاملات فعال
GET /api/trading-engine/trades/active

# دریافت فرصت‌های معاملاتی
GET /api/trading-engine/opportunities

# به‌روزرسانی تنظیمات
PUT /api/trading-engine/config
Body: {
  "maxPositions": 20,
  "mode": "demo",
  "riskLimits": {
    "maxPositionSize": 0.1,
    "maxDailyLoss": 0.05
  }
}

# Emergency Stop (بستن فوری همه معاملات)
POST /api/trading-engine/emergency-stop
Body: {
  "reason": "manual stop"
}
```

### Email APIs

```bash
# تست اتصال SMTP
POST /api/email/test
Body: {
  "host": "smtp.gmail.com",
  "port": 587,
  "secure": false,
  "auth": {
    "user": "your-email@gmail.com",
    "password": "your-app-password"
  },
  "from": "your-email@gmail.com",
  "fromName": "TitanGold",
  "provider": "gmail"
}
```

---

## عیب‌یابی

### مشکل 1: Routes کار نمی‌کنند (404 Error)

**علت:** Backend از directory اشتباه start شده است یا Vite proxy تنظیم نشده است.

**حل:**

```bash
# بررسی Vite proxy
# در vite.config.ts باید این proxy rule وجود داشته باشد:
'/api': {
  target: 'http://localhost:5001',
  changeOrigin: true,
  secure: false
}

# ریستارت Backend
pm2 delete titan-backend
cd /path/to/TitanGold/backend
pm2 start server.js --name titan-backend -i 2
pm2 save

# ریستارت Frontend
# Ctrl+C در terminal frontend
npm run dev
```

### مشکل 2: خطای "Unknown file extension .ts"

**علت:** `scheduler.js` دارد frontend service را import می‌کند.

**حل:**

```bash
# ویرایش backend/engine/scheduler.js
# حذف این خط:
# import * as api from '../../services/api.ts';

# فقط این خط باید باقی بماند:
import { query } from '../database/db.js';
```

**نکته:** این مشکل باید از قبل در کد اصلاح شده باشد.

### مشکل 3: Database Migration خطا می‌دهد

**علت:** جدول `trades` قبلی با schema متفاوت وجود دارد.

**حل:**

```bash
# Drop و recreate جدول trading_opportunities
psql -h localhost -p 5433 -U postgres -d titangold_db << 'EOF'
DROP TABLE IF EXISTS trading_opportunities CASCADE;
CREATE TABLE trading_opportunities (
    id VARCHAR(255) PRIMARY KEY,
    symbol VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    side VARCHAR(10) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    confidence DECIMAL(5, 2) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    opportunity_data JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    trade_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);
EOF
```

### مشکل 4: Scheduler start نمی‌شود

**بررسی لاگ‌ها:**

```bash
pm2 logs titan-backend | grep -i scheduler
```

**اگر هیچ پیامی نیست:**

- بررسی کنید که `scheduler.start()` در `server.js` فراخوانی می‌شود
- بررسی کنید که import صحیح است
- بررسی کنید که database migration اجرا شده است

### مشکل 5: Trading Engine opportunities تشخیص نمی‌دهد

**بررسی:**

1. آیا صرافی (MEXC) پیکربندی شده؟
2. آیا API keys صحیح هستند؟
3. آیا scanners در config فعال هستند؟

```bash
# بررسی config
psql -h localhost -p 5433 -U postgres -d titangold_db \
  -c "SELECT config FROM trading_engine_config WHERE id = 1;"
```

### مشکل 6: Frontend نمی‌تواند به Backend متصل شود

**بررسی:**

1. آیا Vite proxy تنظیم شده است؟
2. آیا Backend روی پورت 5001 در حال اجرا است؟
3. آیا CORS در backend فعال است؟

```bash
# تست اتصال
curl http://localhost:5001/health

# بررسی Vite config
cat vite.config.ts | grep -A 5 "proxy"
```

---

## بررسی نهایی سیستم

### Checklist نصب موفق:

```bash
# 1. بررسی جداول Database
psql -h localhost -p 5433 -U postgres -d titangold_db -c "\dt" | \
  grep -E "scheduler_config|trading_engine_config|trading_opportunities|trading_stats"
# باید 4 جدول را ببینید

# 2. بررسی وضعیت Backend
curl -s http://localhost:5001/health | jq '.status'
# باید "healthy" برگرداند

# 3. بررسی PM2
pm2 list | grep titan-backend
# باید 2 instance online ببینید

# 4. بررسی لاگ‌های Scheduler
pm2 logs titan-backend --lines 100 | grep -i "scheduler"
# باید "Scheduler Service Started" ببینید

# 5. بررسی Frontend
curl -s http://localhost:3000 | head -1
# باید HTML برگرداند (نه error)

# 6. بررسی Vite Proxy
# در browser console، Network tab را باز کنید
# درخواست‌های /api/scheduler/status باید به localhost:5001 proxy شوند
```

---

## نکات مهم

### 🔒 امنیت

- همه API endpoints نیاز به Authentication دارند
- برای تست باید در سیستم Login کنید
- JWT token به‌صورت خودکار در frontend مدیریت می‌شود
- Routes `/start` و `/stop` نیاز به نقش `admin` یا `trader` دارند

### 🚀 Performance

- Trading Engine scanners به‌صورت همزمان اجرا می‌شوند
- Scheduler با intervals قابل تنظیم کار می‌کند
- Risk limits جلوی معاملات خطرناک را می‌گیرد

### 💾 Backup

- همیشه قبل از migrations از database backup بگیرید
- تنظیمات scheduler و trading engine در database ذخیره می‌شوند
- PM2 config را با `pm2 save` ذخیره کنید

### 📊 Monitoring

```bash
# مانیتور real-time
pm2 monit

# لاگ‌های مستمر
pm2 logs titan-backend --lines 100

# وضعیت سرویس‌ها
pm2 list
```

---

## منابع بیشتر

- **Telegram API Setup:** `TELEGRAM_API_SETUP_GUIDE.md`
- **Database Setup:** `DATABASE_SETUP.md`
- **Deployment Guide:** `DEPLOYMENT_NEW_SERVER.md`
- **GitHub Repository:** https://github.com/sepehrraeisi/TitanGold

---

## نسخه‌ها

- **Version 1.0.2** - Trading Engine & Scheduler اضافه شد
- **Date:** 2025-01-30
- **Author:** TitanGold Development Team

---

**🎉 تبریک! سیستم شما آماده است!**

برای شروع:

1. صفحه را Refresh کنید
2. Login کنید
3. به `Trades > Professional Autopilot` بروید
4. Trading Engine را Start کنید
5. به `AI Center > Artemis Settings` بروید
6. تب `⏰ 24/7 Scheduler` را باز کنید
7. Scheduler را پیکربندی کنید

**موفق باشید!** 🚀

