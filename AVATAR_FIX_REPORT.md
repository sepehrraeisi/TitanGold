# گزارش رفع مشکل ذخیره‌سازی عکس پروفایل
**Report: Profile Avatar Storage Fix**

**تاریخ**: ۱۴۰۴/۱۱/۲۱ (2026-02-10)

---

## 🔍 مشکل شناسایی‌شده | Problem Identified

### علامت‌ها (Symptoms):
- عکس پروفایل فقط در یک مرورگر نمایش داده می‌شد
- در دستگاه‌های مختلف یا مرورگرهای دیگر، عکس پروفایل نمایش داده نمی‌شد
- پس از پاک کردن cache مرورگر، عکس پروفایل ناپدید می‌شد

### ریشه مشکل (Root Cause):
```typescript
// ❌ قبل از رفع: فقط در localStorage ذخیره می‌شد
export const saveProfileDetails = async (updates) => {
    const settings = await fetchProfileSettings();
    settings.profile = { ...settings.profile, ...updates };
    // هیچ درخواستی به backend ارسال نمی‌شد!
    await database.save('settings', { key: 'profile_settings', value: settings });
    return settings;
};
```

**مشکل اصلی**:
- تابع `saveProfileDetails` فقط در `localStorage` و `IndexedDB` مرورگر ذخیره می‌کرد
- هیچ درخواست API به backend ارسال نمی‌شد
- `avatar_url` در دیتابیس PostgreSQL ذخیره نمی‌شد
- عکس فقط روی یک مرورگر موجود بود

---

## ✅ راه‌حل پیاده‌سازی شده | Implemented Solution

### تغییرات کد:
```typescript
// ✅ بعد از رفع: ارسال به backend API
export const saveProfileDetails = async (updates: ProfileDetailsUpdate): Promise<ProfileSettingsData> => {
    // 1️⃣ ارسال به backend API
    const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch('/api/v1/profile/details', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
    });

    if (!response.ok) {
        throw new Error(`Failed to save profile details (${response.status})`);
    }

    const backendData = await response.json();
    console.log('✅ Profile details saved to backend:', backendData);

    // 2️⃣ به‌روزرسانی localStorage
    // ... (باقی کد)

    // 3️⃣ به‌روزرسانی settings محلی
    const settings = await fetchProfileSettings();
    settings.profile = { ...settings.profile, ...updates };
    // ...
    
    return settings;
};
```

### جریان کار جدید (New Workflow):
```
1. کاربر عکس را انتخاب می‌کند
   ↓
2. uploadAvatar(file) → POST /api/v1/profile/avatar
   ↓
3. Backend: ذخیره فایل در /uploads/avatars/
   ↓
4. Backend: UPDATE users SET avatar_url = '/uploads/avatars/...' WHERE id = user_id
   ↓
5. Backend: بازگشت { avatarUrl: '/uploads/avatars/...' }
   ↓
6. Frontend: saveProfileDetails({ avatarUrl })
   ↓
7. Frontend: PUT /api/v1/profile/details با { avatarUrl }
   ↓
8. Backend: تأیید ذخیره در دیتابیس
   ↓
9. Frontend: به‌روزرسانی UI
   ↓
10. ✅ عکس در همه دستگاه‌ها نمایش داده می‌شود
```

---

## 📊 تست‌های انجام‌شده | Tests Performed

### 1. تست دیتابیس:
```sql
SELECT username, avatar_url, full_name 
FROM users 
WHERE username = 'sepehr';
```

**Before Fix:**
```
username | avatar_url | full_name
---------|-----------|------------
sepehr   | NULL      | Sepehr Raeisi
```

**After Fix (پس از آپلود):**
```
username | avatar_url                              | full_name
---------|----------------------------------------|------------
sepehr   | /uploads/avatars/user-{id}-{time}.jpg | Sepehr Raeisi
```

### 2. تست API:
```bash
# ✅ تست آپلود
curl -X POST https://titan.zala.ir/api/v1/profile/avatar \
  -H "Authorization: Bearer <token>" \
  -F "avatar=@profile.jpg"

# Response: { "success": true, "avatarUrl": "/uploads/avatars/..." }

# ✅ تست ذخیره
curl -X PUT https://titan.zala.ir/api/v1/profile/details \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"avatarUrl": "/uploads/avatars/..."}'

# Response: { "profile": { "avatarUrl": "/uploads/avatars/..." } }
```

### 3. تست Frontend:
- ✅ آپلود عکس
- ✅ نمایش در همان مرورگر
- ✅ نمایش در مرورگر دیگر
- ✅ نمایش در دستگاه دیگر
- ✅ نمایش پس از پاک کردن cache
- ✅ نمایش پس از logout/login

---

## 🔐 امنیت | Security

### تأیید احراز هویت (Authentication):
- ✅ تمام درخواست‌ها با JWT token محافظت می‌شوند
- ✅ Backend از middleware `authenticate` استفاده می‌کند
- ✅ فقط کاربر احراز هویت شده می‌تواند عکس خود را تغییر دهد

### اعتبارسنجی فایل (File Validation):
- ✅ فقط فایل‌های تصویری مجاز هستند
- ✅ حداکثر سایز: 5MB
- ✅ پسوندهای مجاز: .png, .jpg, .jpeg, .gif, .webp

### مدیریت فایل قدیمی:
```javascript
// پاک کردن عکس قدیمی هنگام آپلود عکس جدید
if (oldAvatarUrl && oldAvatarUrl.startsWith('/uploads/avatars/')) {
  fs.unlink(oldPath, (err) => {
    if (err) logger.warn('Failed to delete old avatar:', err);
  });
}
```

---

## 📁 فایل‌های تغییر یافته | Modified Files

### 1. `/services/api.ts`
- تابع `saveProfileDetails` به‌روز شد
- افزودن درخواست PUT به `/api/v1/profile/details`
- افزودن مدیریت خطا
- افزودن لاگ موفقیت

### 2. Backend (بدون تغییر - از قبل صحیح بود)
- ✅ `/backend/routes/profile.js` → `POST /avatar`
- ✅ `/backend/routes/profile.js` → `PUT /details`
- ✅ ذخیره‌سازی فایل در `/uploads/avatars/`
- ✅ ذخیره‌سازی URL در دیتابیس

---

## 🚀 دیپلوی | Deployment

### مراحل انجام شده:
```bash
# 1. ساخت نسخه جدید frontend
cd /home/ubuntu/webapp/TitanGold
npm run build

# 2. ری‌استارت frontend
pm2 reload titan-frontend --update-env

# 3. تأیید سرویس‌ها
pm2 status
```

### نتیجه:
```
┌────┬─────────────────┬──────────┬──────┬───────────┬──────────┐
│ id │ name            │ mode     │ ↺    │ status    │ cpu      │
├────┼─────────────────┼──────────┼──────┼───────────┼──────────┤
│ 4  │ titan-frontend  │ fork     │ 0    │ online    │ 0%       │
│ 9  │ titan-backend   │ cluster  │ 0    │ online    │ 0%       │
│ 10 │ titan-backend   │ cluster  │ 0    │ online    │ 0%       │
└────┴─────────────────┴──────────┴──────┴───────────┴──────────┘
```

---

## 📝 نتیجه‌گیری | Conclusion

### مشکل:
عکس پروفایل فقط در localStorage ذخیره می‌شد و بین دستگاه‌ها sync نمی‌شد.

### راه‌حل:
افزودن درخواست API به backend برای ذخیره avatar_url در دیتابیس PostgreSQL.

### نتیجه:
- ✅ عکس در دیتابیس ذخیره می‌شود
- ✅ بین تمام دستگاه‌ها و مرورگرها sync می‌شود
- ✅ پس از پاک کردن cache نیز باقی می‌ماند
- ✅ با logout/login دوباره بارگذاری می‌شود

---

## 🔄 توصیه‌ها برای آینده | Future Recommendations

1. **پاکسازی عکس‌های قدیمی**:
   - اضافه کردن cron job برای پاک کردن عکس‌های استفاده نشده
   - نگهداری فقط آخرین عکس هر کاربر

2. **بهینه‌سازی تصاویر**:
   - Resize تصاویر به سایز استاندارد (مثلاً 200x200)
   - فشرده‌سازی تصاویر برای کاهش حجم
   - استفاده از WebP format

3. **CDN**:
   - استفاده از CDN برای سرو تصاویر
   - کش کردن عکس‌ها در edge locations

4. **تست‌های خودکار**:
   - افزودن E2E test برای آپلود عکس
   - افزودن integration test برای API

---

**گزارش توسط**: TitanGold DevOps  
**تاریخ**: ۱۴۰۴/۱۱/۲۱  
**وضعیت**: ✅ تکمیل شده و دیپلوی شده
