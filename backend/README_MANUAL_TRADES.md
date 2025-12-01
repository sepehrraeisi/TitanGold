# Manual Trades Backend Setup

## Database Schema

برای راه‌اندازی Manual Trades، ابتدا باید database schema را اجرا کنید:

```bash
# Connect to PostgreSQL
psql -U postgres -d titangold_db

# Run the schema file
\i backend/scripts/init_manual_trades.sql
```

یا می‌توانید مستقیماً از Node.js اجرا کنید:

```bash
cd backend
node -e "const { query } = require('./database/db.js'); const fs = require('fs'); const sql = fs.readFileSync('./scripts/init_manual_trades.sql', 'utf8'); query(sql).then(() => console.log('Schema created')).catch(console.error);"
```

## API Endpoints

### GET /api/manual-trades/page-data
دریافت تمام داده‌های صفحه Manual Trades شامل:
- Stats (آمارها)
- Chart data (داده‌های نمودار)
- Quick trade config (تنظیمات معامله سریع)
- Recommendations (توصیه‌های AI)
- Sentiment (احساسات بازار)
- Strategies (استراتژی‌ها)
- Portfolio (پرتفوی)
- Performance (عملکرد)
- Recent trades (معاملات اخیر)

**Authentication**: Required (Bearer token)

### POST /api/manual-trades/execute
اجرای معامله سریع

**Request Body**:
```json
{
  "side": "buy" | "sell",
  "amountPercent": 25,
  "stopLossPercent": 2,
  "takeProfitPercent": 5,
  "pair": "BTC/USDT"
}
```

**Response**: ManualTradingPageData (updated)

**Authentication**: Required (Admin or Trader role)

### POST /api/manual-trades/strategies/:strategyId/toggle
فعال/غیرفعال کردن استراتژی

**Response**: ManualTradingPageData (updated)

**Authentication**: Required (Admin or Trader role)

### GET /api/manual-trades/recent
دریافت معاملات اخیر

**Query Parameters**:
- `limit` (optional, default: 20)

**Response**: Array of ManualTradingRecentTrade

**Authentication**: Required

### GET /api/manual-trades/price/:pair
دریافت قیمت فعلی یک pair

**Response**:
```json
{
  "pair": "BTC/USDT",
  "price": 45000.50,
  "change24h": 2.5,
  "volume": 1234567.89,
  "timestamp": 1234567890
}
```

**Authentication**: Required

### GET /api/manual-trades/balance
دریافت موجودی کاربر

**Response**:
```json
{
  "USDT": 10000,
  "BTC": 0.5,
  "ETH": 10
}
```

**Authentication**: Required

## Trading Modes

سیستم از دو حالت پشتیبانی می‌کند:

### Demo Mode (پیش‌فرض)
- معاملات در virtual wallet اجرا می‌شوند
- موجودی اولیه: 10,000 USDT
- PnL به صورت شبیه‌سازی شده محاسبه می‌شود

### Live Mode
- معاملات واقعی از طریق MEXC exchange اجرا می‌شوند
- نیاز به API keys معتبر MEXC دارد
- موجودی واقعی از exchange خوانده می‌شود

برای تغییر mode، متغیر محیطی `TRADING_MODE` را تنظیم کنید:
```bash
export TRADING_MODE=live  # or 'demo'
```

## Features

✅ Real-time price updates از MEXC
✅ Chart data (OHLCV) از MEXC
✅ Balance management (Demo mode)
✅ Trade execution (Demo & Live)
✅ Strategy management
✅ Performance tracking
✅ Portfolio distribution
✅ Recent trades history

## Error Handling

تمام API endpoints دارای error handling کامل هستند:
- Validation errors (400)
- Authentication errors (401)
- Authorization errors (403)
- Server errors (500)

در صورت خطا، frontend به صورت خودکار به mock data fallback می‌کند.

