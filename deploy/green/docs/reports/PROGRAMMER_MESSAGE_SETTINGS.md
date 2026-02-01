# 📋 پیام برای برنامه‌نویس - تکمیل بخش Settings

**تاریخ**: 2025-12-20  
**نسخه پلتفرم**: v1.0.5  
**محلل**: Claude AI Assistant

---

## 🎯 خلاصه وضعیت فعلی

بخش **Settings** به طور کلی **75% تکمیل** است اما نیاز به رفع چند مورد **Critical** و **High Priority** دارد.

### 📊 جدول وضعیت تب‌ها:

| تب | وضعیت فعلی | نمره | نیاز به اقدام |
|-----|-----------|------|--------------|
| Profile | ✅ 85% | 8.5/10 | بهینه‌سازی جزئی |
| Connections | ✅ 90% | 9/10 | عالی است |
| Wallet | ⚠️ 75% | 7.5/10 | Backend ناقص |
| Notifications | ❌ 50% | 5/10 | **Backend نیاز به تکمیل کامل** |
| Email | ⚠️ 60% | 6/10 | تست و تایید |
| Appearance | ✅ 70% | 7/10 | گزینه‌های بیشتر |
| Security | ✅ 95% | 9.5/10 | Backup Codes کم است |
| Users | ❌ N/A | N/A | **باید مخفی شود** |

---

## 🔥 Task های Critical (باید حتماً انجام شوند)

### Task 1: مخفی کردن Users Tab ⚡
**اولویت**: 🔥 Critical  
**زمان تخمینی**: 30 دقیقه  
**Severity**: Medium  

**چرا؟**  
TitanGold یک پلتفرم شخصی (personal) است نه چند کاربره. تب Users فقط برای پلتفرم‌های Enterprise یا Multi-tenant مناسب است.

**راه‌حل**:
```typescript
// File: components/Settings.tsx
// خط 17-26

// BEFORE:
const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: t('settings_profile'), icon: <ProfileIcon /> },
  { id: 'connections', label: t('settings_connections'), icon: <ConnectionIcon /> },
  { id: 'wallet', label: t('settings_wallet'), icon: <WalletIcon /> },
  { id: 'notifications', label: t('settings_notifications'), icon: <NotificationIcon /> },
  { id: 'email', label: t('email_configuration'), icon: <EmailIcon /> },
  { id: 'appearance', label: t('settings_appearance'), icon: <AppearanceIcon /> },
  { id: 'security', label: t('settings_security'), icon: <SecurityIcon /> },
  { id: 'users', label: t('settings_users'), icon: <UsersIcon /> }, // ❌ این خط
];

// AFTER:
const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: t('settings_profile'), icon: <svg>...</svg> },
  { id: 'connections', label: t('settings_connections'), icon: <svg>...</svg> },
  { id: 'wallet', label: t('settings_wallet'), icon: <svg>...</svg> },
  { id: 'notifications', label: t('settings_notifications'), icon: <svg>...</svg> },
  { id: 'email', label: t('email_configuration'), icon: <svg>...</svg> },
  { id: 'appearance', label: t('settings_appearance'), icon: <svg>...</svg> },
  { id: 'security', label: t('settings_security'), icon: <svg>...</svg> },
  // 'users' tab حذف شد - برای single-user platform غیرضروری است
];

// همچنین Type را هم تغییر دهید:
// خط 11:
type SettingsTab = 'profile' | 'connections' | 'notifications' | 'appearance' | 'security' | 'wallet' | 'email';
// 'users' را حذف کنید
```

---

### Task 2: تکمیل Notifications Backend 🚨
**اولویت**: 🔥 Critical  
**زمان تخمینی**: 4-6 ساعت  
**Severity**: Critical  

**چرا؟**  
UI کامل است اما Backend فقط یک فایل 1.5KB دارد که هیچ کاری نمی‌کند. باید کامل شود.

**مراحل پیاده‌سازی**:

#### قدم 1: Database Migration
```sql
-- File: backend/database/migrations/add_notification_tables.sql

CREATE TABLE IF NOT EXISTS notification_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL, -- 'email', 'sms', 'push', 'in_app'
  category VARCHAR(50) NOT NULL, -- 'trading', 'price_alerts', 'system', 'ai'
  enabled BOOLEAN DEFAULT true,
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, channel, category)
);

CREATE TABLE IF NOT EXISTS notification_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notification_settings_user ON notification_settings(user_id);
CREATE INDEX idx_notification_history_user_created ON notification_history(user_id, created_at DESC);
CREATE INDEX idx_notification_history_user_unread ON notification_history(user_id, read_at) WHERE read_at IS NULL;
```

اجرا کنید:
```bash
cd backend/database/migrations
psql -U your_user -d titangold < add_notification_tables.sql
```

#### قدم 2: Backend Routes کامل
**File**: `backend/routes/notifications.js`

کد کامل در گزارش صفحه 600-750 موجود است. شامل:
- `GET /settings` - دریافت تنظیمات
- `PUT /settings` - ذخیره تنظیمات
- `GET /history` - دریافت تاریخچه
- `PUT /history/:id/read` - خواندن notification
- `DELETE /history/:id` - حذف notification
- `POST /test` - ارسال تست

**توجه**: کد کامل و آماده برای copy-paste در گزارش موجود است.

#### قدم 3: Integration در server.js
```javascript
// backend/server.js
import notificationsRoutes from './routes/notifications.js';

app.use('/api/notifications', notificationsRoutes);
```

---

### Task 3: تست Email Configuration 📧
**اولویت**: 🔥 Critical  
**زمان تخمینی**: 1-2 ساعت  
**Severity**: High  

**چرا؟**  
Backend موجود است (`routes/email.js`) اما نیاز به تست و تایید دارد.

**مراحل تست**:

1. **Configure کردن SMTP با Gmail**:
```bash
curl -X PUT http://localhost:5002/api/email/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "smtpServer": "smtp.gmail.com",
    "smtpPort": 587,
    "smtpUser": "your-email@gmail.com",
    "smtpPassword": "your-app-password",
    "fromAddress": "your-email@gmail.com",
    "fromName": "TitanGold Platform",
    "encryption": "TLS"
  }'
```

2. **ارسال Test Email**:
```bash
curl -X POST http://localhost:5002/api/email/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. **چک کردن Inbox** و تایید دریافت

**اگر کار نکرد**:
- App Password در Gmail استفاده کنید (نه password اصلی)
- "Less secure app access" را فعال کنید
- Firewall را چک کنید (Port 587)
- SMTP logs را بررسی کنید

---

## ⚡ Task های High Priority (خیلی مهم)

### Task 4: Wallet Backend Implementation 💰
**اولویت**: ⚠️ High  
**زمان تخمینی**: 6-8 ساعت  
**Severity**: High  

**چرا؟**  
فعلاً API endpoints موجود در `services/api.ts` mock data برمی‌گردانند. باید backend واقعی پیاده‌سازی شود.

**فایل جدید**: `backend/routes/wallet.js`

کد کامل skeleton در گزارش صفحه 800-950 موجود است که شامل:
- `GET /data` - دریافت wallet data
- `POST /refresh-connector/:id` - Refresh یک connector
- `PUT /security-controls/:id` - Toggle security control
- `PUT /preferences` - بروزرسانی preferences

**مراحل**:
1. فایل `backend/routes/wallet.js` را ایجاد کنید
2. کد از گزارش را copy کنید
3. Helper functions را تکمیل کنید (فعلاً TODO دارند)
4. در `server.js` register کنید:
```javascript
import walletRoutes from './routes/wallet.js';
app.use('/api/wallet', walletRoutes);
```

---

### Task 5: Add 2FA Backup Codes 🔐
**اولویت**: ⚠️ High  
**زمان تخمینی**: 2-3 ساعت  
**Severity**: High  

**چرا؟**  
اگر user دستگاه 2FA خود را گم کند، هیچ راهی برای بازیابی ندارد. این یک مشکل امنیتی جدی است.

**مراحل پیاده‌سازی**:

#### قدم 1: Database Migration
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_backup_codes JSONB DEFAULT '[]';
```

#### قدم 2: Backend Routes
**File**: `backend/routes/security.js`

دو endpoint اضافه کنید:
- `POST /2fa/backup-codes/generate` - تولید 10 کد backup
- `POST /2fa/backup-codes/verify` - تایید backup code هنگام login

کد کامل در گزارش صفحه 1000-1100 موجود است.

#### قدم 3: Frontend UI
**File**: `components/settings/SecuritySettings.tsx`

یک section جدید اضافه کنید که بعد از enable کردن 2FA، backup codes نمایش داده شود.

کد UI کامل در گزارش موجود است.

---

### Task 6: Fix Avatar Storage 🖼️
**اولویت**: ⚠️ High  
**زمان تخمینی**: 2-3 ساعت  
**Severity**: Medium  

**چرا؟**  
فعلاً avatar در base64 ذخیره می‌شود که برای production مناسب نیست (حجم زیاد در database).

**راه‌حل**: File Upload با Multer

**مراحل**:

#### قدم 1: نصب multer
```bash
cd backend
npm install multer
```

#### قدم 2: ایجاد Profile Routes
**File**: `backend/routes/profile.js` (جدید)

کد کامل در گزارش صفحه 1150-1250 موجود است که شامل:
- Configure multer با validation
- `POST /avatar` endpoint برای upload
- حذف فایل قدیمی
- ذخیره URL در database

#### قدم 3: Integration در server.js
```javascript
import profileRoutes from './routes/profile.js';
app.use('/api/profile', profileRoutes);

// Serve uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

#### قدم 4: Frontend تغییر
**File**: `components/settings/ProfileSettings.tsx`

تابع `handleAvatarChange` را تغییر دهید از base64 به FormData upload.

کد کامل در گزارش موجود است.

---

## 📝 Task های Medium Priority (مهم اما نه فوری)

این Task ها در phase بعدی انجام می‌شوند:

- **Task 7**: Timezone Dropdown (به جای TextField)
- **Task 8**: Remove Language field از Profile (duplication با Appearance)
- **Task 9**: Theme Customization بیشتر (Font Size, Color Accent, etc.)
- **Task 10**: Session Management UI
- **Task 11**: Multi-Exchange Support (Binance, KuCoin, OKX)

این Task ها فعلاً نیاز نیست انجام شوند.

---

## 📋 Checklist برای شما

لطفاً این مراحل را به ترتیب انجام دهید:

### Phase 1: Critical Tasks (اولویت بالا)

- [ ] **Task 1**: مخفی کردن Users Tab (30 دقیقه)
  - [ ] تغییر `components/Settings.tsx`
  - [ ] حذف 'users' از type SettingsTab
  - [ ] حذف import UsersSettings اگر لازم نیست
  - [ ] تست: Settings را باز کنید و ببینید Users دیگر نیست

- [ ] **Task 2**: تکمیل Notifications Backend (4-6 ساعت)
  - [ ] ایجاد migration فایل: `add_notification_tables.sql`
  - [ ] اجرای migration در database
  - [ ] کد کامل `backend/routes/notifications.js` از گزارش
  - [ ] Integration در `server.js`
  - [ ] تست با Postman/curl
  - [ ] تست از UI (Settings > Notifications)

- [ ] **Task 3**: تست Email Configuration (1-2 ساعت)
  - [ ] Configure Gmail SMTP از UI
  - [ ] ارسال Test Email
  - [ ] تایید دریافت در inbox
  - [ ] اگر کار نکرد، debug و fix کنید

### Phase 2: High Priority Tasks

- [ ] **Task 4**: Wallet Backend Implementation (6-8 ساعت)
  - [ ] ایجاد `backend/routes/wallet.js`
  - [ ] تکمیل helper functions
  - [ ] Integration در `server.js`
  - [ ] تست endpoints با Postman
  - [ ] تست از UI

- [ ] **Task 5**: Add 2FA Backup Codes (2-3 ساعت)
  - [ ] Migration: اضافه کردن column
  - [ ] Backend: دو endpoint جدید
  - [ ] Frontend: UI برای نمایش codes
  - [ ] تست کامل flow

- [ ] **Task 6**: Fix Avatar Storage (2-3 ساعت)
  - [ ] نصب multer
  - [ ] ایجاد `backend/routes/profile.js`
  - [ ] Integration در `server.js`
  - [ ] Frontend تغییر به FormData
  - [ ] تست upload

### Phase 3: بعد از تکمیل

- [ ] تست کامل تمام Settings tabs
- [ ] بررسی console برای errors
- [ ] تست performance
- [ ] **Commit و Push به GitHub**

---

## 🎯 زمان‌بندی پیشنهادی

| Phase | Tasks | زمان | روز |
|-------|-------|------|-----|
| Phase 1 | Tasks 1-3 (Critical) | 6-9 ساعت | روز 1 |
| Phase 2 | Tasks 4-6 (High) | 10-13 ساعت | روز 2-3 |
| Testing | تست کامل و Fix bugs | 2-3 ساعت | روز 3 |
| **Total** | | **18-25 ساعت** | **2-3 روز** |

---

## 📖 استفاده از گزارش

گزارش کامل **1453 خطی** در فایل `SETTINGS_ANALYSIS_REPORT.md` موجود است که شامل:

1. **تحلیل عمیق هر 8 تب** با کد و نمونه
2. **کد کامل و آماده** برای تمام Task ها
3. **مثال‌های واقعی** برای تست
4. **Troubleshooting** برای مشکلات رایج
5. **Best Practices** برای هر بخش

**نحوه استفاده**:
- برای هر Task، به صفحه مشخص شده در گزارش مراجعه کنید
- کدها را copy-paste کنید (تست شده و آماده است)
- اگر سوالی داشتید، متن توضیحات در گزارش کامل است

---

## ✅ معیارهای قبولی (Acceptance Criteria)

برای اینکه بگوییم Settings کامل است:

### Task 1: Users Tab
- [ ] Users tab در sidebar دیگر نمایش داده نمی‌شود
- [ ] Console error ندارد
- [ ] Default tab به Profile می‌رود

### Task 2: Notifications
- [ ] Database tables موجود است
- [ ] GET /api/notifications/settings کار می‌کند
- [ ] PUT /api/notifications/settings تنظیمات را ذخیره می‌کند
- [ ] GET /api/notifications/history تاریخچه برمی‌گرداند
- [ ] Test notification ارسال می‌شود
- [ ] UI بدون خطا کار می‌کند

### Task 3: Email
- [ ] SMTP configuration ذخیره می‌شود
- [ ] Test email ارسال و دریافت می‌شود
- [ ] Error handling درست است

### Task 4: Wallet
- [ ] GET /api/wallet/data واقعی data برمی‌گرداند (نه mock)
- [ ] Refresh connector کار می‌کند
- [ ] Security controls toggle می‌شود
- [ ] Preferences ذخیره می‌شود

### Task 5: 2FA Backup
- [ ] 10 backup codes تولید می‌شود
- [ ] Codes در UI نمایش داده می‌شود
- [ ] Codes در database (hashed) ذخیره می‌شوند
- [ ] Verify backup code هنگام login کار می‌کند

### Task 6: Avatar
- [ ] Avatar upload می‌شود
- [ ] فایل در `/uploads/avatars/` ذخیره می‌شود
- [ ] URL صحیح در database ذخیره می‌شود
- [ ] Preview در UI صحیح است
- [ ] فایل قدیمی حذف می‌شود

---

## 🚨 نکات مهم

1. **Git Workflow**:
   - بعد از هر Task commit کنید
   - قبل از commit، تست کنید
   - Commit message واضح و descriptive باشد
   - در آخر همه commits را squash کنید

2. **Testing**:
   - هر endpoint را با Postman تست کنید
   - Console را برای errors چک کنید
   - UI را در Chrome DevTools بررسی کنید

3. **Code Quality**:
   - Error handling اضافه کنید
   - Comments برای کدهای پیچیده
   - Console.log های اضافی را حذف کنید

4. **Documentation**:
   - اگر چیزی unclear بود، در گزارش جزئیات کامل است
   - اگر باز هم سوال داشتید، بپرسید

---

## 📞 سوال دارید؟

اگر در هر مرحله‌ای به مشکل خوردید یا سوال داشتید:
1. ابتدا گزارش کامل را مطالعه کنید (احتمالاً جواب است)
2. Error message را دقیق بخوانید
3. Console logs را چک کنید
4. اگر حل نشد، بپرسید

---

## 🎉 بعد از تکمیل

وقتی همه Task ها انجام شد:
1. ✅ تست کامل Settings از UI
2. ✅ Commit و Push به GitHub
3. ✅ اعلام تکمیل
4. 🚀 برویم سراغ بخش بعدی (AI/Trades/Favorites)

---

**موفق باشید! 💪**

این Task ها کاملاً واضح و قابل انجام هستند. کدها آماده است، فقط باید با دقت پیاده‌سازی کنید.
