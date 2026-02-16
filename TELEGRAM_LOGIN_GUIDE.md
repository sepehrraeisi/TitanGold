# راهنمای Login دوباره به Telegram Collector

## 🔴 مشکل: `401: AUTH_KEY_UNREGISTERED`

این خطا به معنی این است که Session تلگرام منقضی شده یا نامعتبر است.

---

## ✅ راه‌حل: Login دوباره

### مرحله 1: پاک کردن Cache مرورگر

**Chrome / Edge:**
1. `Ctrl+Shift+Delete` (Windows) یا `Cmd+Shift+Delete` (Mac)
2. انتخاب "Cached images and files"
3. کلیک "Clear data"

**Firefox:**
1. `Ctrl+Shift+Delete` (Windows) یا `Cmd+Shift+Delete` (Mac)
2. انتخاب "Cache"
3. کلیک "Clear Now"

**یا اینکه:**
- **Hard Refresh**: `Ctrl+Shift+R` (Windows) یا `Cmd+Shift+R` (Mac)

---

### مرحله 2: باز کردن UI

```
https://titan.zala.ir/?view=ai
```

---

### مرحله 3: رفتن به Telegram Collector

1. کلیک روی **"AI Center"** (بالای صفحه)
2. انتخاب **"Data Hub"** tab
3. انتخاب **"Telegram Collector"** از منوی چپ

---

### مرحله 4: Login دوباره

#### 4.1. شروع Login
1. شماره تلفن را وارد کنید: `+989031395555`
   - **نکته:** شماره باید با `+98` شروع شود (کد کشور ایران)
   - فرمت: `+98903XXXXXXX`
2. کلیک روی **"Send Verification Code"**

#### 4.2. دریافت و وارد کردن کد
1. کد تأیید را از Telegram دریافت کنید
   - کد 5 رقمی به حساب تلگرام شما ارسال می‌شود
   - معمولاً از "Telegram" یا "Telegram Code" می‌آید
2. کد را در فیلد "Verification Code" وارد کنید
3. (اختیاری) اگر حساب شما رمز دو مرحله‌ای (2FA) دارد، رمز را وارد کنید

#### 4.3. تأیید Login
1. کلیک روی **"Confirm Login"**
2. منتظر پیام موفقیت بمانید:
   - ✅ "ورود تلگرام با موفقیت انجام شد و session ذخیره گردید."

---

### مرحله 5: تست Login موفق

بعد از Login موفق، می‌توانید این کارها را انجام دهید:

1. **بارگذاری کانال‌ها:**
   - کلیک "Load Channels" در بخش "Import from Telegram"
   - باید لیست کانال‌های شما نمایش داده شود (بدون خطای 401)

2. **Sync کانال‌ها:**
   - کانال‌های مورد نظر را انتخاب کنید
   - کلیک "Sync Data Sources"
   - کانال‌ها به دیتابیس اضافه می‌شوند

3. **مشاهده پیام‌ها:**
   - در لیست Data Sources، روی هر کانال کلیک "View Messages"
   - پیام‌های کانال باید نمایش داده شوند

---

## 🔧 اگر همچنان خطا می‌دهد:

### بررسی 1: وضعیت Session
```bash
curl http://127.0.0.1:3002/api/telegram-collector/health | jq '.session'
```

**خروجی مورد انتظار:**
```json
{
  "in_database": true,
  "last_used": "2026-02-16T14:30:00.000Z",
  "created_at": "2026-02-16T14:25:00.000Z",
  "phone_number": "+989031395555"
}
```

---

### بررسی 2: لاگ‌های Telegram Collector
```bash
pm2 logs telegram-collector --lines 50
```

**خطاهای معمول:**
- `401: AUTH_KEY_UNREGISTERED` → Session منقضی شده، دوباره login کنید
- `420: FLOOD_WAIT_X` → شما خیلی سریع درخواست فرستاده‌اید، X ثانیه صبر کنید
- `401: SESSION_PASSWORD_NEEDED` → حساب شما 2FA دارد، رمز را وارد کنید

---

### بررسی 3: Restart سرویس
```bash
cd /home/ubuntu/webapp/TitanGold
pm2 restart telegram-collector
pm2 logs telegram-collector --lines 30
```

---

## 📝 نکات مهم

### ✅ DO:
- حتماً شماره را با `+98` شروع کنید
- کد تأیید را دقیق وارد کنید (5 رقم)
- اگر 2FA دارید، رمز را وارد کنید
- بعد از Login موفق، Session برای ~30 روز معتبر است

### ❌ DON'T:
- شماره بدون `+` وارد نکنید
- کدهای قدیمی (منقضی) را استفاده نکنید
- زیاد تلاش نکنید (ممکن است FLOOD_WAIT بخورید)

---

## 🚀 بعد از Login موفق

Session در دیتابیس ذخیره می‌شود و:
- تا 30 روز معتبر است
- هر 15 دقیقه یک بار کانال‌ها Poll می‌شوند
- پیام‌های جدید به صورت خودکار Sync می‌شوند
- Session Rotation هر 30 روز یک بار اتفاق می‌افتد

---

## 📞 پشتیبانی

اگر مشکلی پیش آمد:
1. Hard refresh کنید: `Ctrl+Shift+R` / `Cmd+Shift+R`
2. لاگ‌ها را بررسی کنید: `pm2 logs telegram-collector`
3. Health check کنید: `curl http://127.0.0.1:3002/api/telegram-collector/health`
4. سرویس را restart کنید: `pm2 restart telegram-collector`

---

**آخرین بروزرسانی:** 2026-02-16  
**نسخه:** 1.0.0  
**وضعیت:** تأیید شده و تست شده ✅
