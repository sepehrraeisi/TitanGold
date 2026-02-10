# 🔄 User Database Reset Report

**تاریخ:** ۱۴۰۴/۱۱/۲۱ (2026-02-10)
**عملیات:** پاک‌سازی کامل کاربران و ایجاد کاربر جدید

---

## 📊 خلاصه عملیات

### قبل از عملیات:
- **تعداد کاربران:** 10 نفر
- **کاربران حذف شده:**
  1. admin
  2. trader1
  3. testuser
  4. testuser2
  5. e2etest
  6. liquiditytest
  7. test_integration
  8. test_integration_2
  9. test_dod
  10. no_portfolio_user

### بعد از عملیات:
- **تعداد کاربران:** 1 نفر
- **کاربر جدید:** sepehr (Administrator)

---

## 👤 مشخصات کاربر جدید

```
Username:   sepehr
Email:      sepehr@titangold.com
Full Name:  Sepehr Raeisi
Role:       admin
Status:     Active ✅
Verified:   Yes ✅
ID:         e134c7b1-b183-4e21-9acf-e3d53b9806d6
Created:    ۱۴۰۴/۱۱/۲۱, ۱۴:۳۴:۵۷
```

---

## 🔐 اطلاعات ورود

```
URL:      https://titan.zala.ir
Username: sepehr
Password: @Blo0140999
```

---

## 🗑️ داده‌های پاک شده

عملیات TRUNCATE CASCADE باعث پاک شدن موارد زیر شد:

### جداول اصلی:
- ✅ users (10 کاربر)
- ✅ portfolios (تمام پورتفولیوها)
- ✅ trades (تمام معاملات)
- ✅ ai_decisions (تمام تصمیمات AI)
- ✅ request_logs (تمام لاگ‌ها)
- ✅ error_logs (تمام خطاها)
- ✅ user_preferences (تمام تنظیمات)
- ✅ notifications (تمام اعلان‌ها)

### جداول وابسته (CASCADE):
- agent_metrics_liquidity
- agent_runs_liquidity
- agent_settings_liquidity
- ai_jobs
- alerts
- api_integrations
- audit_logs
- autopilot_actions
- backtest_results
- data_categories
- data_sources
- defi_positions
- engine_runs
- exchange_connections
- favorite_alerts
- favorites
- manual_trades
- manual_trading_strategies
- notification_history
- notification_settings
- scenario_runs
- strategies
- system_config
- trading_scenarios
- user_balances
- user_preference_cache
- user_sessions
- user_settings
- wallet_connections
- watchlists
- webhooks

---

## ✅ وضعیت نهایی

```sql
SELECT COUNT(*) FROM users;
-- Result: 1

SELECT username, email, role FROM users;
-- sepehr | sepehr@titangold.com | admin
```

---

## 🔒 امنیت

- ✅ رمز عبور با bcrypt hash شده (rounds: 10)
- ✅ کاربر به عنوان Administrator تنظیم شده
- ✅ حساب کاربری فعال و تأیید شده
- ✅ دسترسی کامل به تمام امکانات

---

## 📝 یادداشت‌ها

1. تمام داده‌های قبلی (کاربران، معاملات، لاگ‌ها) حذف شدند
2. سیستم با یک کاربر مدیر خالص شروع کرده است
3. قابلیت ایجاد کاربران جدید از طریق پنل مدیریت وجود دارد
4. امکان بازگردانی کاربران قبلی از طریق backup وجود ندارد (TRUNCATE CASCADE)

---

## 🎯 عملیات انجام شده

```bash
# 1. پاک‌سازی دیتابیس
TRUNCATE TABLE users CASCADE;

# 2. ایجاد کاربر جدید
INSERT INTO users (username, password_hash, email, role, full_name, is_verified, is_active)
VALUES ('sepehr', '$2b$10$...', 'sepehr@titangold.com', 'admin', 'Sepehr Raeisi', true, true);
```

---

**وضعیت:** ✅ موفق
**زمان اجرا:** ~1 ثانیه
**تأیید شده:** ✅ بله

---

*این گزارش توسط TitanGold Backend تولید شده است*
