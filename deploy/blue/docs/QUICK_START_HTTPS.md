# 🚀 راه‌اندازی سریع HTTPS - TitanGold

## ⚡ وضعیت فعلی

```
✅ Server: Online
✅ Backend: Running (Port 5002)
✅ Frontend: Built (Production)
✅ Nginx: Configured
✅ SSL: Installed (Cloudflare Origin)
⏳ DNS: Waiting for setup
```

---

## 🎯 چه کاری باید انجام دهید؟

### تنها 1 کار: افزودن DNS Record

#### در Cloudflare Dashboard:

```
1. بروید به: Cloudflare.com → Login → زala.ir → DNS
2. کلیک کنید: "Add record"
3. وارد کنید:
   
   ┌─────────────────────────────────────┐
   │ Type:        A                      │
   │ Name:        titan                  │
   │ IPv4:        188.40.209.82          │
   │ Proxy:       ☁️ Proxied (ON)        │
   │ TTL:         Auto                   │
   └─────────────────────────────────────┘

4. کلیک کنید: "Save"
5. صبر کنید: 5-60 دقیقه
```

---

## 🌐 آدرس‌های دسترسی

### الان (با IP):
```
Frontend:   https://188.40.209.82/
Backend:    https://188.40.209.82/api/
WebSocket:  wss://188.40.209.82/ws/favorites

⚠️ نکته: مرورگر هشدار SSL می‌دهد (طبیعی است)
         روی "Advanced" → "Proceed" کلیک کنید
```

### بعد از DNS (بدون هشدار):
```
Frontend:   https://titan.zala.ir/
Backend:    https://titan.zala.ir/api/
WebSocket:  wss://titan.zala.ir/ws/favorites

✅ بدون هشدار SSL
✅ امنیت کامل
✅ آماده برای Production
```

---

## 🔐 لاگین تست

```
Username: testuser2
Password: Test123456
```

---

## 📊 چک کردن وضعیت

### تست Backend:
```bash
curl -k https://188.40.209.82/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser2","password":"Test123456"}'
```

### تست DNS:
```bash
nslookup titan.zala.ir
# باید نشان دهد: 188.40.209.82
```

### تست HTTPS:
```bash
curl -I https://titan.zala.ir/
# باید نشان دهد: HTTP/2 200
```

---

## ⚙️ تنظیمات Cloudflare (اختیاری اما توصیه می‌شود)

```
1. بروید به: SSL/TLS → Overview
   ✅ انتخاب کنید: Full (strict)

2. بروید به: SSL/TLS → Edge Certificates
   ✅ Always Use HTTPS: ON
   ✅ TLS 1.3: ON
   ✅ Automatic HTTPS Rewrites: ON
   ✅ Minimum TLS Version: TLS 1.2
```

---

## 🆘 مشکل دارید؟

### مشکل: titan.zala.ir باز نمی‌شود
```
→ DNS record را چک کنید
→ 15 دقیقه صبر کنید
→ nslookup titan.zala.ir را اجرا کنید
```

### مشکل: Login کار نمی‌کند
```
→ از https:// استفاده کنید (نه http://)
→ Console browser را چک کنید (F12)
→ Backend logs: pm2 logs titan-backend
```

### مشکل: هشدار SSL
```
→ اگر از IP استفاده می‌کنید: طبیعی است
→ اگر از titan.zala.ir استفاده می‌کنید:
  - DNS را چک کنید
  - SSL mode را Full (strict) کنید
```

---

## 📝 Checklist

- [ ] DNS record اضافه شد
- [ ] 15 دقیقه انتظار کشیدم
- [ ] `nslookup titan.zala.ir` جواب می‌دهد
- [ ] SSL Mode روی Full (strict) است
- [ ] `https://titan.zala.ir/` باز می‌شود
- [ ] Login کار می‌کند

---

## 🎉 همه چیز آماده است!

```
✅ Server: Configured
✅ SSL: Installed
✅ Backend: Online
✅ Frontend: Built
✅ Nginx: Running

⏳ فقط منتظر DNS setup
```

---

**تاریخ**: 2025-12-23  
**نسخه**: 1.0  
**وضعیت**: Production Ready
