# 🔧 Development Login Bypass

این فایل توضیح می‌دهد که چطور در حالت Development می‌توانید بدون نیاز به backend لاگین کنید.

## ⚠️ مهم

این قابلیت **فقط در Development Mode** کار می‌کند و در Production غیرفعال است.

## 🚀 روش استفاده

### روش 1: لاگین خودکار با URL Parameter

برای ورود خودکار در Development، URL را با `?dev-login` باز کنید:

```
http://localhost:3000?dev-login
```

این کار یک mock user با نقش Admin ایجاد می‌کند و شما را مستقیماً وارد Dashboard می‌کند.

### روش 2: لاگین با هر نام کاربری و رمز عبور

در Development Mode، اگر backend در دسترس نباشد یا لاگین fail کند، سیستم به صورت خودکار یک mock user ایجاد می‌کند:

1. هر نام کاربری و رمز عبوری را وارد کنید
2. اگر backend در دسترس نباشد، به صورت خودکار لاگین می‌شوید
3. یک mock user با نقش Admin ایجاد می‌شود

## 📋 جزئیات فنی

### چه زمانی فعال می‌شود؟

- ✅ فقط در `import.meta.env.DEV === true`
- ✅ فقط وقتی backend در دسترس نباشد یا لاگین fail کند
- ❌ در Production Mode کار نمی‌کند

### Mock User Details

```typescript
{
  id: 'dev-user-' + Date.now(),
  name: username || 'Development User',
  email: `${username}@dev.local`,
  username: username || 'dev',
  role: 'Admin'
}
```

### Storage

Mock user در `sessionStorage` و `localStorage` ذخیره می‌شود:
- `titan_user`: اطلاعات کاربر
- `titan_token`: یک token موقت برای development

## 🔒 امنیت

- این قابلیت **فقط در Development** کار می‌کند
- در Production، اگر backend در دسترس نباشد، خطای "Invalid credentials" نمایش داده می‌شود
- هیچ تغییری در backend یا دیتابیس ایجاد نمی‌شود

## 🎯 استفاده برای Development

این قابلیت برای موارد زیر مفید است:

1. **توسعه Frontend بدون نیاز به Backend**
   - می‌توانید UI را تست کنید بدون اینکه backend را راه‌اندازی کنید

2. **تست سریع**
   - برای تست سریع تغییرات UI

3. **Development روی Local Machine**
   - وقتی backend روی سرور است و شما فقط frontend را توسعه می‌دهید

## 📝 مثال استفاده

```bash
# Development server را راه‌اندازی کنید
npm run dev

# در مرورگر باز کنید:
http://localhost:3000?dev-login

# یا هر نام کاربری/رمز عبوری را وارد کنید
# اگر backend در دسترس نباشد، به صورت خودکار لاگین می‌شوید
```

## ⚠️ نکات مهم

1. **این فقط برای Development است** - در Production کار نمی‌کند
2. **Backend API calls ممکن است fail شوند** - چون mock user یک token واقعی ندارد
3. **برای تست کامل، باید backend را راه‌اندازی کنید**

## 🔄 بازگشت به حالت عادی

برای استفاده از backend واقعی:

1. Backend را راه‌اندازی کنید
2. با اطلاعات واقعی لاگین کنید
3. یا `?dev-login` را از URL حذف کنید

---

**تاریخ ایجاد**: 2025-01-XX  
**وضعیت**: ✅ فعال در Development Mode

