# راهنمای تنظیم MEXC API Keys

## ⚠️ توجه مهم

خطای `MEXC API Key ❌ Connection failed: Failed to fetch` به این دلیل است که:
- شما هنوز **MEXC API Keys** را در سیستم وارد نکرده‌اید
- این خطا **ربطی به HTTPS یا Domain تغییر ندارد**
- این خطا **طبیعی** است تا زمانی که API Keys را وارد کنید

## 🔑 مراحل دریافت MEXC API Keys

### 1️⃣ ورود به MEXC
1. برو به: https://www.mexc.com/
2. Login کن به حساب کاربری‌ات
3. برو به: **Account** → **API Management**

### 2️⃣ ساخت API Key
1. کلیک کن روی: **Create API Key**
2. انتخاب کن:
   - ✅ **Read**: برای خواندن اطلاعات
   - ✅ **Trade**: برای معامله (اختیاری)
   - ❌ **Withdraw**: بهتر است غیرفعال باشد
3. تایید کن با 2FA (Google Authenticator یا SMS)
4. **API Key** و **Secret Key** را کپی کن و **جایی امن ذخیره کن**

⚠️ **هشدار**: Secret Key فقط یک بار نمایش داده می‌شود!

### 3️⃣ وارد کردن در TitanGold

#### روش 1: از طریق UI (توصیه می‌شود)
1. Login کن به: https://titan.zala.ir/
2. برو به: **Settings** → **Connections** → **Exchange API Keys**
3. Select کن: **MEXC**
4. وارد کن:
   - **API Key**: کلید API که دریافت کردی
   - **Secret Key**: کلید Secret که دریافت کردی
5. کلیک کن: **Test Connection**
6. اگر موفق بود، کلیک کن: **Save**

#### روش 2: از طریق Database (برای توسعه‌دهندگان)
```sql
-- وارد شدن به Database
psql -U postgres -d titangold_db -p 5433

-- اضافه کردن MEXC API Key
INSERT INTO exchange_connections (
    user_id,
    exchange,
    api_key,
    api_secret,
    is_active
) VALUES (
    'YOUR_USER_ID',  -- ID کاربر (مثلاً از جدول users)
    'MEXC',
    'YOUR_API_KEY',
    'YOUR_SECRET_KEY',
    true
);
```

## 🧪 تست Connection

بعد از وارد کردن API Keys:
1. برو به صفحه **Connections**
2. باید ببینی: **MEXC ✅ Connected**
3. خطای `MEXC_NOT_CONFIGURED` دیگر نمایش داده نمی‌شود

## 📋 Troubleshooting

### مشکل: "Invalid API Key"
```
✅ چک کن: API Key و Secret درست کپی شده‌اند (بدون فاصله اضافی)
✅ چک کن: API Key در MEXC هنوز فعال است
✅ چک کن: IP Whitelist در MEXC تنظیم نشده (یا IP server را اضافه کن)
```

### مشکل: "Permission Denied"
```
✅ چک کن: API Key دسترسی Read دارد
✅ چک کن: اگر می‌خواهی trade کنی، دسترسی Trade فعال باشد
```

### مشکل: "Connection Failed"
```
✅ چک کن: Backend online است (pm2 status titan-backend)
✅ چک کن: Database online است
✅ چک کن: Network connection به MEXC API
```

## 🔒 امنیت

### ✅ توصیه‌های امنیتی:
1. **Never share** API Keys با کسی
2. **IP Whitelist**: فقط IP server خودت را اضافه کن
3. **Withdraw Permission**: غیرفعال باشد
4. **Regular Rotation**: هر چند ماه یک بار API Key را تغییر بده
5. **Monitor Usage**: مرتباً تراکنش‌ها را چک کن

### ⚠️ اگر API Key لو رفت:
1. فوراً برو به MEXC → API Management
2. Delete کن API Key قدیمی را
3. یک API Key جدید بساز
4. در TitanGold به‌روز کن

## 📚 مستندات MEXC

- **API Docs**: https://mexcdevelop.github.io/apidocs/
- **API Management**: https://www.mexc.com/user/openapi
- **Support**: https://www.mexc.com/support

---

**نتیجه**: بعد از وارد کردن MEXC API Keys، خطا برطرف می‌شود و می‌تونی از قابلیت‌های Trading استفاده کنی! 🚀
