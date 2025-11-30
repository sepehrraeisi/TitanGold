# TitanGold - AI-Powered Trading Platform

## 🚀 Overview

TitanGold is an advanced AI-powered trading platform featuring:
- **15 AI Agents** for market analysis and decision making
- **24/7 Trading Engine** with automated execution
- **Intelligent Scheduler** for continuous operation
- **Telegram Data Collector** (500+ channels)
- **Artemis Decision Engine** for coordinated trading decisions

## 📚 Quick Start Guides

### Essential Documentation

1. **[Trading Engine & Scheduler Setup](TRADING_ENGINE_SCHEDULER_SETUP.md)** ⭐ **NEW**
   - Complete installation guide for Trading Engine
   - 24/7 Scheduler configuration
   - Email service setup
   - Database migrations
   - Troubleshooting

2. **[Telegram Collector Setup](TELEGRAM_API_SETUP_GUIDE.md)**
   - API Credentials setup
   - MTProto configuration
   - Channel management
   - Real-time data collection

3. **[Database Setup](DATABASE_SETUP.md)**
   - PostgreSQL configuration
   - Schema creation
   - Migrations

4. **[Deployment Guide](DEPLOYMENT_NEW_SERVER.md)**
   - Server setup
   - PM2 configuration
   - Production deployment

## 🎯 Features

### 🤖 Trading Engine (v1.0.2)
- **Event-Driven Architecture** for real-time opportunity detection
- **4 Intelligent Scanners:**
  - Arbitrage Scanner (2s interval)
  - Price Movement Scanner (5s interval)
  - Volume Spike Scanner (10s interval)
  - Pattern Recognition Scanner (30s interval)
- **Priority Queue System:** CRITICAL → HIGH → MEDIUM → LOW
- **Concurrent Trading:** Up to 20 simultaneous trades
- **Risk Management:**
  - Max Position Size: 10% portfolio
  - Daily Loss Limit: 5%
  - Max Drawdown: 15%
  - Min Confidence: 75%
- **Integration:** Artemis Decision Engine + 15 AI Agents
- **Modes:** Demo & Live trading
- **Emergency Stop:** Instant close all positions

### ⏰ 24/7 Scheduler
- **Agent Scheduler:** Auto-run 15 AI agents (5 min interval)
- **Data Hub Scheduler:** Auto-refresh data sources (2 min interval)
- **Training Scheduler:** Auto-schedule training sessions (30 min interval)
- **Analytics Scheduler:** Auto-update statistics (10 min interval)
- **Artemis Scheduler:** Auto-decision making (1 min interval)
- **Database-Backed Configuration:** Persistent settings
- **Flexible Control:** Enable/Disable per component

### 📊 AI Agents (15 Total)
1. Technical Analysis Agent
2. Risk Management Agent
3. Sentiment Analysis Agent
4. Pattern Recognition Agent
5. Price Prediction Agent
6. Arbitrage Detection Agent
7. Portfolio Allocation Agent
8. Liquidity Analysis Agent
9. Trend Detection Agent
10. Optimization Agent
11. Order Management Agent
12. Fundamental Analysis Agent
13. Market Intelligence Agent
14. Volume Analysis Agent
15. Timing Analysis Agent

### 📡 Telegram Collector
- **Real-Time Data:** 62+ active channels
- **MTProto Integration:** Full Telegram API access
- **Session Management:** Persistent authentication
- **Message Processing:** All media types supported
- **Scalable:** 500+ channels capacity

### 📧 Email Service
- **SMTP Support:** Gmail, Outlook, Yahoo, Custom
- **Notifications:** Trading alerts, reports
- **Test Connection:** Pre-configured validation

## 🛠️ Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Backend:** Node.js + Express
- **Database:** PostgreSQL 14+
- **Process Manager:** PM2
- **Telegram:** GramJS (MTProto)
- **AI Integration:** Multiple LLM providers

## 📦 Installation

### Prerequisites
- Node.js >= 18.x
- PostgreSQL >= 14
- PM2 installed globally

### Quick Install

```bash
# Clone repository
git clone https://github.com/sepehrraeisi/TitanGold.git
cd TitanGold

# Install dependencies
npm install
cd backend && npm install

# Run database migrations
psql -h localhost -p 5433 -U postgres -d titangold_db \
  -f database/migrations/001_add_scheduler_config.sql
psql -h localhost -p 5433 -U postgres -d titangold_db \
  -f database/migrations/002_add_trading_engine_tables.sql

# Start backend with PM2
cd backend
pm2 start server.js --name titan-backend -i 2

# Start frontend (development)
cd ..
npm run dev

# Or build for production
npm run build
```

## 🚀 Usage

### Access the Platform
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5002

### Trading Engine
1. Navigate to: `Trades` → `Professional Autopilot`
2. Configure settings (risk limits, scanners)
3. Click "Start Trading Engine"
4. Monitor dashboard for opportunities and active trades

### Scheduler Configuration
1. Navigate to: `AI Center` → `Artemis Settings` → `24/7 Scheduler` tab
2. Enable/Disable components
3. Adjust intervals as needed
4. Scheduler auto-starts with backend

### Telegram Collector
1. Navigate to: `AI Center` → `Data Hub` → `Telegram Collector`
2. Enter phone number and verify
3. View tracked channels (62+ active)
4. Real-time message collection

## 📖 API Documentation

### Authentication Required
All API endpoints require JWT token in header:
```
Authorization: Bearer <your-jwt-token>
```

### Key Endpoints

#### Trading Engine
- `GET /api/trading-engine/status` - Get engine status
- `POST /api/trading-engine/start` - Start engine
- `POST /api/trading-engine/stop` - Stop engine
- `GET /api/trading-engine/trades/active` - Get active trades
- `POST /api/trading-engine/emergency-stop` - Emergency stop

#### Scheduler
- `GET /api/scheduler/status` - Get scheduler status
- `POST /api/scheduler/start` - Start scheduler
- `POST /api/scheduler/stop` - Stop scheduler
- `PUT /api/scheduler/config` - Update configuration

#### Telegram Collector
- `GET /api/telegram-collector/health` - Health check
- `GET /api/telegram-collector/channels` - Get tracked channels
- `POST /api/telegram-collector/login/start` - Start login process

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```env
PORT=5002
DB_HOST=localhost
DB_PORT=5433
DB_NAME=titangold_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
```

**Telegram Collector (.env)**
```env
PORT=3002
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_PHONE_NUMBER=+989384556010
TELEGRAM_SESSION_STRING=auto_generated_after_login
```

## 🐛 Troubleshooting

See detailed troubleshooting in:
- [TRADING_ENGINE_SCHEDULER_SETUP.md](TRADING_ENGINE_SCHEDULER_SETUP.md#عیب‌یابی)
- [TELEGRAM_API_SETUP_GUIDE.md](TELEGRAM_API_SETUP_GUIDE.md)

Common issues:
1. **Routes not working (404):** Backend started from wrong directory
2. **Scheduler not starting:** Check `scheduler.js` imports
3. **Database migration errors:** Check PostgreSQL connection
4. **Telegram login fails:** Verify API credentials from my.telegram.org

## 📊 System Status

### Current Version: 1.0.2
- ✅ Trading Engine: Operational
- ✅ 24/7 Scheduler: Active
- ✅ 15 AI Agents: Integrated
- ✅ Telegram Collector: 62 channels
- ✅ Database: PostgreSQL connected
- ✅ Email Service: Configured

## 🤝 Contributing

This is a private project. For access or questions, contact the development team.

## 📝 License

Proprietary - All rights reserved

## 🔗 Links

- **Repository:** https://github.com/sepehrraeisi/TitanGold
- **Issues:** Contact development team
- **Documentation:** See `*.md` files in root directory

## 📅 Recent Updates

### v1.0.2 (2025-11-30)
- ✨ Added Trading Engine with 4 scanners
- ✨ Added 24/7 Scheduler for automation
- ✨ Added Email service integration
- ✨ Database migrations for new features
- 🐛 Fixed scheduler.js frontend import issue
- 📝 Complete documentation added

### v1.0.1 (2025-11-26)
- ✨ Telegram Collector with MTProto
- ✨ 62+ active channels
- 🐛 Session persistence fixes
- 🐛 Mock channels removed

---

**Made with ❤️ by TitanGold Team**

For detailed setup instructions, see:
- **[TRADING_ENGINE_SCHEDULER_SETUP.md](TRADING_ENGINE_SCHEDULER_SETUP.md)** ⭐
- **[TELEGRAM_API_SETUP_GUIDE.md](TELEGRAM_API_SETUP_GUIDE.md)**
