# 👥 User Management API - مستندات کامل

## ✅ وضعیت: 100% کامل و عملیاتی

**تاریخ**: 2025-11-23  
**نسخه**: 1.0.0  
**Base URL**: `http://188.40.209.82:5002/api/users`

---

## 📋 فهرست Endpoints

| Method | Endpoint | نقش مورد نیاز | توضیحات |
|--------|----------|--------------|---------|
| GET | `/` | Admin | لیست تمام کاربران با فیلتر |
| GET | `/stats/overview` | Admin | آمار کاربران |
| GET | `/:id` | User/Admin | جزئیات یک کاربر |
| PATCH | `/:id` | User/Admin | به‌روزرسانی پروفایل |
| POST | `/:id/change-password` | User | تغییر رمز عبور |
| PATCH | `/:id/role` | Admin | تغییر نقش کاربر |
| PATCH | `/:id/status` | Admin | فعال/غیرفعال کردن |
| DELETE | `/:id` | Admin | حذف کاربر |
| GET | `/:id/activity` | User/Admin | لاگ فعالیت کاربر |

---

## 🔐 Authentication

تمام endpoints نیاز به JWT token دارند:

```bash
Authorization: Bearer <your_jwt_token>
```

### دریافت Token:

```bash
curl -X POST http://188.40.209.82:5002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }'
```

---

## 📊 1. لیست کاربران (GET /)

**نقش**: Admin  
**توضیحات**: دریافت لیست کاربران با قابلیت جستجو و فیلتر

### Request:

```bash
GET /api/users?search=admin&role=admin&is_active=true&limit=50&offset=0
```

### Query Parameters:

| پارامتر | نوع | اجباری | توضیحات |
|---------|-----|--------|---------|
| `search` | string | خیر | جستجو در username, email, full_name |
| `role` | string | خیر | فیلتر بر اساس نقش (user, admin, trader, vip) |
| `is_active` | boolean | خیر | فیلتر بر اساس وضعیت فعال/غیرفعال |
| `limit` | number | خیر | تعداد نتایج (پیش‌فرض: 50) |
| `offset` | number | خیر | شروع از رکورد (پیش‌فرض: 0) |

### مثال:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://188.40.209.82:5002/api/users?limit=10&search=admin"
```

### Response:

```json
{
  "users": [
    {
      "id": "58d6c166-d632-407a-b380-f4ee3e1879e1",
      "email": "admin@titangold.com",
      "username": "admin",
      "full_name": "TitanGold Admin",
      "phone": "+989123456789",
      "avatar_url": null,
      "role": "admin",
      "is_active": true,
      "is_verified": false,
      "created_at": "2025-11-23T14:32:23.652Z",
      "last_login_at": "2025-11-23T14:47:12.066Z"
    }
  ],
  "total": 2,
  "limit": 10,
  "offset": 0
}
```

---

## 📈 2. آمار کاربران (GET /stats/overview)

**نقش**: Admin  
**توضیحات**: دریافت آمار کلی کاربران

### Request:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://188.40.209.82:5002/api/users/stats/overview
```

### Response:

```json
{
  "total_users": 2,
  "active_users": 2,
  "verified_users": 0,
  "admin_count": 1,
  "trader_count": 0,
  "vip_count": 0,
  "new_users_30d": 2,
  "active_7d": 1
}
```

### توضیح فیلدها:

- `total_users`: تعداد کل کاربران
- `active_users`: تعداد کاربران فعال
- `verified_users`: تعداد کاربران تایید شده
- `admin_count`: تعداد ادمین‌ها
- `trader_count`: تعداد تریدرها
- `vip_count`: تعداد VIPها
- `new_users_30d`: کاربران جدید ۳۰ روز اخیر
- `active_7d`: کاربران فعال ۷ روز اخیر

---

## 👤 3. جزئیات کاربر (GET /:id)

**نقش**: User (خودش) یا Admin  
**توضیحات**: دریافت اطلاعات کامل یک کاربر

### Request:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://188.40.209.82:5002/api/users/58d6c166-d632-407a-b380-f4ee3e1879e1
```

### Response:

```json
{
  "id": "58d6c166-d632-407a-b380-f4ee3e1879e1",
  "email": "admin@titangold.com",
  "username": "admin",
  "full_name": "TitanGold Admin",
  "phone": "+989123456789",
  "avatar_url": null,
  "role": "admin",
  "is_active": true,
  "is_verified": false,
  "created_at": "2025-11-23T14:32:23.652Z",
  "last_login_at": "2025-11-23T14:47:12.066Z",
  "theme": "dark",
  "language": "en",
  "timezone": null,
  "currency": "USD"
}
```

---

## ✏️ 4. به‌روزرسانی پروفایل (PATCH /:id)

**نقش**: User (خودش) یا Admin  
**توضیحات**: به‌روزرسانی اطلاعات کاربر

### Request Body:

```json
{
  "email": "newemail@example.com",
  "full_name": "New Full Name",
  "phone": "+989123456789",
  "avatar_url": "https://example.com/avatar.jpg"
}
```

### مثال:

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+989123456789", "full_name": "Updated Name"}' \
  http://188.40.209.82:5002/api/users/58d6c166-d632-407a-b380-f4ee3e1879e1
```

### Response:

```json
{
  "id": "58d6c166-d632-407a-b380-f4ee3e1879e1",
  "email": "admin@titangold.com",
  "username": "admin",
  "full_name": "Updated Name",
  "phone": "+989123456789",
  "avatar_url": null,
  "role": "admin",
  "created_at": "2025-11-23T14:32:23.652Z",
  "updated_at": "2025-11-23T14:50:00.000Z"
}
```

### Validation:

- `email`: باید email معتبر باشد و تکراری نباشد
- تمام فیلدها اختیاری هستند
- فقط فیلدهایی که ارسال می‌شوند به‌روزرسانی می‌شوند

---

## 🔑 5. تغییر رمز عبور (POST /:id/change-password)

**نقش**: User (فقط خودش)  
**توضیحات**: تغییر رمز عبور کاربر

### Request Body:

```json
{
  "current_password": "OldPassword123!",
  "new_password": "NewPassword123!"
}
```

### مثال:

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "Admin123!",
    "new_password": "NewAdmin123!"
  }' \
  http://188.40.209.82:5002/api/users/58d6c166-d632-407a-b380-f4ee3e1879e1/change-password
```

### Response:

```json
{
  "message": "Password changed successfully"
}
```

### خطاها:

```json
{
  "error": "Current password is incorrect"
}
```

### Validation:

- `current_password`: الزامی
- `new_password`: حداقل ۶ کاراکتر

---

## 👑 6. تغییر نقش کاربر (PATCH /:id/role)

**نقش**: Admin  
**توضیحات**: تغییر نقش کاربر

### Request Body:

```json
{
  "role": "admin"
}
```

### مقادیر مجاز:

- `user` - کاربر عادی
- `admin` - مدیر سیستم
- `trader` - تریدر حرفه‌ای
- `vip` - کاربر VIP

### مثال:

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "trader"}' \
  http://188.40.209.82:5002/api/users/c93d0992-2f61-4d4d-84db-b5e6b3371e18/role
```

### Response:

```json
{
  "id": "c93d0992-2f61-4d4d-84db-b5e6b3371e18",
  "email": "trader@titangold.com",
  "username": "trader1",
  "full_name": "Professional Trader",
  "role": "trader"
}
```

---

## 🔓 7. فعال/غیرفعال کردن (PATCH /:id/status)

**نقش**: Admin  
**توضیحات**: فعال یا غیرفعال کردن کاربر

### Request Body:

```json
{
  "is_active": false
}
```

### مثال:

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}' \
  http://188.40.209.82:5002/api/users/c93d0992-2f61-4d4d-84db-b5e6b3371e18/status
```

### Response:

```json
{
  "id": "c93d0992-2f61-4d4d-84db-b5e6b3371e18",
  "email": "trader@titangold.com",
  "username": "trader1",
  "is_active": false
}
```

---

## 🗑️ 8. حذف کاربر (DELETE /:id)

**نقش**: Admin  
**توضیحات**: حذف دائمی کاربر از سیستم

### مثال:

```bash
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  http://188.40.209.82:5002/api/users/c93d0992-2f61-4d4d-84db-b5e6b3371e18
```

### Response:

```json
{
  "message": "User deleted successfully",
  "user": {
    "id": "c93d0992-2f61-4d4d-84db-b5e6b3371e18",
    "username": "trader1"
  }
}
```

### محدودیت‌ها:

- ادمین نمی‌تواند خودش را حذف کند
- تمام داده‌های مرتبط با CASCADE حذف می‌شوند

---

## 📝 9. لاگ فعالیت (GET /:id/activity)

**نقش**: User (خودش) یا Admin  
**توضیحات**: دریافت لاگ فعالیت‌های کاربر

### Request:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://188.40.209.82:5002/api/users/58d6c166-d632-407a-b380-f4ee3e1879e1/activity?limit=20"
```

### Query Parameters:

| پارامتر | نوع | پیش‌فرض | توضیحات |
|---------|-----|---------|---------|
| `limit` | number | 50 | تعداد نتایج |
| `offset` | number | 0 | شروع از رکورد |

### Response:

```json
[
  {
    "id": "log-id",
    "action": "login",
    "entity_type": "user",
    "entity_id": "58d6c166-d632-407a-b380-f4ee3e1879e1",
    "created_at": "2025-11-23T14:47:12.066Z",
    "ip_address": "127.0.0.1"
  }
]
```

---

## ❌ کدهای خطا

| کد | پیام | توضیحات |
|----|------|---------|
| 400 | Bad Request | داده‌های ورودی نامعتبر |
| 401 | Unauthorized | توکن نامعتبر یا منقضی |
| 403 | Forbidden | دسترسی کافی ندارید |
| 404 | Not Found | کاربر یافت نشد |
| 500 | Internal Server Error | خطای سرور |

### مثال خطا:

```json
{
  "error": "Access denied"
}
```

### خطای Validation:

```json
{
  "errors": [
    {
      "msg": "Invalid value",
      "param": "email",
      "location": "body"
    }
  ]
}
```

---

## 🔒 امنیت

### Authorization Rules:

1. **کاربران عادی**:
   - می‌توانند فقط پروفایل خودشان را ببینند و ویرایش کنند
   - می‌توانند فقط رمز عبور خودشان را تغییر دهند
   - می‌توانند فقط لاگ فعالیت خودشان را ببینند

2. **ادمین‌ها**:
   - دسترسی کامل به تمام کاربران
   - می‌توانند نقش کاربران را تغییر دهند
   - می‌توانند کاربران را فعال/غیرفعال کنند
   - می‌توانند کاربران را حذف کنند (به جز خودشان)

### نکات امنیتی:

- ✅ تمام رمزهای عبور با bcrypt hash می‌شوند
- ✅ JWT tokens تاریخ انقضا دارند
- ✅ Session management پیاده‌سازی شده
- ✅ Email uniqueness بررسی می‌شود
- ✅ Audit logs برای تمام تغییرات

---

## 🧪 تست‌های کامل

### Test 1: Login as Admin

```bash
TOKEN=$(curl -s -X POST http://188.40.209.82:5002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}' | jq -r .token)

echo "Token: $TOKEN"
```

### Test 2: Get Statistics

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://188.40.209.82:5002/api/users/stats/overview | jq .
```

### Test 3: List Users

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://188.40.209.82:5002/api/users | jq .
```

### Test 4: Update Profile

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+989123456789"}' \
  http://188.40.209.82:5002/api/users/YOUR_USER_ID | jq .
```

### Test 5: Create New User

```bash
curl -X POST http://188.40.209.82:5002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "username": "testuser",
    "password": "Test123!",
    "fullName": "Test User"
  }' | jq .
```

---

## 📊 وضعیت نهایی

### ✅ Features پیاده‌سازی شده:

- ✅ لیست کاربران با فیلتر و جستجو
- ✅ آمار و گزارشات کاربران
- ✅ مشاهده جزئیات کاربر
- ✅ به‌روزرسانی پروفایل
- ✅ تغییر رمز عبور
- ✅ مدیریت نقش‌ها
- ✅ فعال/غیرفعال سازی
- ✅ حذف کاربر
- ✅ لاگ فعالیت‌ها
- ✅ Validation کامل
- ✅ Authorization Rules
- ✅ Error Handling

### 📈 آمار:

- **Endpoints**: 9
- **Roles**: 4 (user, admin, trader, vip)
- **Tests**: همه موفق ✅

---

## 💡 نکات مهم

1. **Token Expiration**: توکن‌ها ۷ روز اعتبار دارند
2. **Refresh Token**: برای تمدید از `/api/auth/refresh` استفاده کنید
3. **Pagination**: از limit و offset برای صفحه‌بندی استفاده کنید
4. **Search**: جستجو case-insensitive است
5. **Delete**: حذف permanent است و قابل بازگشت نیست

---

## 🎉 خلاصه

**User Management System به طور کامل پیاده‌سازی شده و تست شده است!**

- ✅ 9 Endpoint کامل
- ✅ Authorization کامل
- ✅ Validation کامل
- ✅ Error Handling
- ✅ Security Best Practices
- ✅ مستندات کامل

**Status**: 100% Operational ✅

---

*آخرین به‌روزرسانی: 2025-11-23*  
*نسخه: 1.0.0*
