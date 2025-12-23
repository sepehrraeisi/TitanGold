# Artemis API Manual Test Results (Template)

این فایل برای ثبت نتایج تست دستی API های Artemis آماده شده است.
فعلاً توکن احراز هویت در دسترس نبود؛ لطفاً پس از اجرای تست‌ها موارد زیر را تکمیل کنید.

## تنظیمات اولیه
- پایه آدرس API: `http://188.40.209.82:5002/api`
- هدر مشترک: `Authorization: Bearer <JWT_TOKEN>`

## تست‌ها

### 1) GET /api/artemis/state
- وضعیت: Pending (نیاز به JWT)
- زمان/توضیح: ---
- داده بازگشتی کامل بود؟ `[]` بله/خیر
- فیلدهای ناقص/undefined: ...

### 2) PUT /api/artemis/mode
- وضعیت: Pending
- درخواست نمونه: `{"mode":"real"}`
- نتیجه و پیام: ---
- آیا مقدار در backend ذخیره شد؟ ---

### 3) GET /api/artemis/logs
- وضعیت: Pending
- تعداد رکوردها / ساختار: ---
- شامل خطا یا warning؟ ---

### 4) GET /api/artemis/scenarios
- وضعیت: Pending
- لیست سناریوها / فیلدهای کلیدی: ---

### 5) POST /api/agents/:id/activate
- وضعیت: Pending
- Agent تست‌شده: ---
- نتیجه: ---

### 6) POST /api/agents/:id/deactivate
- وضعیت: Pending
- Agent تست‌شده: ---
- نتیجه: ---

## جمع‌بندی
- وضعیت کلی: Pending (منتظر اجرای تست با توکن معتبر)
- اقدام بعدی: پس از دریافت JWT، هر مورد را اجرا و این فایل را تکمیل کنید.

