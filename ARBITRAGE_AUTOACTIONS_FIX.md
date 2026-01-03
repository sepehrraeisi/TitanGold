# 🔧 Arbitrage Settings - رفع خطای autoActions

## 📅 تاریخ: 2026-01-03

## ❌ خطا
```
Cannot read properties of undefined (reading 'notifyOnOpportunity')
```

## 🔍 علت
Settings Tab نیاز به `autoActions` object دارد:
- `notifyOnOpportunity`
- `simulateRoutes`
- `pauseOnHighLatency`

## ✅ راه‌حل
افزودن `autoActions` به normalized config:

```javascript
autoActions: {
  notifyOnOpportunity: true,   // اطلاع‌رسانی فرصت‌ها
  simulateRoutes: false,        // شبیه‌سازی مسیرها
  pauseOnHighLatency: true      // توقف در تأخیر بالا
}
```

## 🚀 استقرار
- **Commit**: 334ce21
- **Status**: ✅ Deployed
- **Backend**: Restarted

## 🎯 تست
**کش را پاک کنید**: `Ctrl + Shift + R`

**تست**: AI Agents → Arbitrage → Settings → بخش "Auto actions" باید نمایش داده شود

---

**تاریخ**: 2026-01-03  
**وضعیت**: ✅ رفع شده
