# 🔧 گزارش تحلیل عمیق بخش Settings - TitanGold Platform

**تاریخ تحلیل**: 2025-12-20  
**نسخه پلتفرم**: v1.0.5  
**تحلیلگر**: Claude AI Assistant  
**سرور**: Production (188.40.209.82:3000)

---

## 📊 خلاصه اجرایی

بخش Settings در حال حاضر شامل **8 تب اصلی** است:

| # | تب | وضعیت | سایز | Backend | نظر کلی |
|---|-----|-------|------|---------|---------|
| 1 | **Profile** | ✅ کامل | 422 خط | ✅ دارد | عالی - نیاز به چند بهبود جزئی |
| 2 | **Connections** | ✅ کامل | 632 خط | ✅ دارد | عالی - MEXC + Wallets |
| 3 | **Wallet** | ✅ کامل | 240 خط + 6 widget | ✅ دارد | عالی - Dashboard-style |
| 4 | **Notifications** | ⚠️ پروتوتایپ | 1316 خط | ⚠️ ناقص | نیاز به Backend کامل |
| 5 | **Email** | ⚠️ پروتوتایپ | 301 خط | ✅ دارد | نیاز به Test و تکمیل |
| 6 | **Appearance** | ✅ کامل | 819 خط | ⚠️ محدود | خوب - نیاز به چند گزینه اضافی |
| 7 | **Security** | ✅ کامل | 352 خط | ✅ دارد | عالی - 2FA کامل |
| 8 | **Users** | ❌ غیرضروری | 1315 خط | ✅ دارد | **پیشنهاد: حذف/مخفی کردن** |

### 🎯 اولویت‌بندی کارها:

```
اولویت 1 (فوری):
  ✅ Settings/Users را مخفی کنیم (فقط برای Admin)
  ✅ Notifications Backend را کامل کنیم
  ✅ Email را تست و verify کنیم

اولویت 2 (متوسط):
  ⚠️ Profile را بهینه کنیم
  ⚠️ Appearance گزینه‌های بیشتر بدیم
  ⚠️ Wallet را با Trades یکپارچه کنیم

اولویت 3 (آینده):
  📝 API Rate Limits در Profile
  📝 Advanced Security Settings
  📝 Backup & Export Settings
```

---

## 1️⃣ بررسی تک به تک تب‌ها

### 📝 Tab 1: Profile Settings

**فایل**: `components/settings/ProfileSettings.tsx` (422 خط)  
**Backend**: `/api/profile/*` ✅  
**وضعیت**: ✅ 85% تکمیل

#### ✅ موارد موجود:
- ✅ Avatar Upload (با base64 storage)
- ✅ Account Details (Full Name, Email, Job Title, Phone, Timezone, Location)
- ✅ Communication Preferences (5 toggle)
- ✅ Change Password
- ✅ Connected Integrations (نمایش MEXC و سایر)
- ✅ Recent Activity Log
- ✅ Metrics Cards (3 کارت آماری)
- ✅ Profile Status Badge (Verified/Pending/Restricted)

#### ⚠️ نواقص و پیشنهادات:

1. **Avatar Storage Issue** (Medium Priority):
   ```
   مشکل: Avatar در base64 ذخیره می‌شود که برای production مناسب نیست
   راه‌حل: استفاده از CDN یا S3 Storage
   
   پیشنهاد کد:
   - اضافه کردن endpoint برای upload: POST /api/profile/avatar
   - استفاده از multer برای file handling
   - ذخیره URL به جای base64
   ```

2. **Timezone Selector** (Low Priority):
   ```
   مشکل: Timezone به صورت TextField است نه Dropdown
   راه‌حل: تبدیل به Select با لیست timezone ها
   
   کد پیشنهادی:
   <select id="timezone" value={details.timezone ?? ''} 
           onChange={e => handleDetailChange('timezone', e.target.value)}>
     <option value="UTC">UTC</option>
     <option value="Asia/Tehran">Asia/Tehran (GMT+3:30)</option>
     <option value="America/New_York">America/New_York (EST)</option>
     ...
   </select>
   ```

3. **Language Field Duplication** (Medium Priority):
   ```
   مشکل: Language هم در Profile هست هم در Appearance
   راه‌حل: حذف از Profile و فقط در Appearance نگه‌داشتن
   ```

4. **API Rate Limits Display** (Low Priority):
   ```
   مشکل: اطلاعات API usage و rate limits وجود ندارد
   پیشنهاد: اضافه کردن یک Card برای نمایش:
   - API Calls Today: 245 / 1000
   - MEXC API Quota: 1200 / 2400
   - Rate Limit Status: OK
   ```

5. **Export Profile Data** (Low Priority):
   ```
   پیشنهاد: دکمه "Export My Data" برای GDPR compliance
   ```

#### 📊 نمره کلی: 8.5/10

---

### 🔌 Tab 2: Connections Settings

**فایل**: `components/settings/ConnectionsSettings.tsx` (632 خط)  
**Backend**: `/api/connections/*` ✅  
**وضعیت**: ✅ 90% تکمیل

#### ✅ موارد موجود:
- ✅ MEXC Exchange API Keys (Save, Test, Display)
- ✅ MetaMask Wallet Connection
- ✅ WalletConnect با QR Code
- ✅ Cold Wallet (Manual Address + Balance Retry Logic)
- ✅ Account Info Display (Total USDT, Available Balance)
- ✅ Disconnect Functionality
- ✅ Real-time Status Checking

#### ⚠️ نواقص و پیشنهادات:

1. **Multi-Exchange Support** (High Priority):
   ```
   مشکل: فقط MEXC پشتیبانی می‌شود
   راه‌حل: اضافه کردن Binance, KuCoin, OKX
   
   پیشنهاد UI:
   - Tabs برای هر Exchange
   - یا Dropdown برای انتخاب Exchange
   ```

2. **API Key Permissions Display** (Medium Priority):
   ```
   مشکل: وقتی API key save می‌شود، permissions نمایش داده نمی‌شود
   پیشنهاد: نمایش:
   - ✅ Read: Enabled
   - ✅ Trade: Enabled
   - ❌ Withdraw: Disabled (recommended)
   ```

3. **Connection Health Monitor** (Low Priority):
   ```
   پیشنهاد: نمایش وضعیت real-time:
   - Last API Call: 2 seconds ago
   - Response Time: 234ms
   - Status: 🟢 Healthy
   ```

4. **Wallet Portfolio Sync** (Medium Priority):
   ```
   مشکل: Cold Wallet Balance فقط fetch می‌شود
   راه‌حل: یکپارچگی با Portfolio Section
   ```

#### 📊 نمره کلی: 9/10

---

### 💰 Tab 3: Wallet Settings

**فایل**: `components/settings/WalletSettings.tsx` (240 خط) + 6 Widgets  
**Backend**: `/api/wallet/*` ⚠️  
**وضعیت**: ✅ 75% تکمیل

#### ✅ موارد موجود:
- ✅ Dashboard-style Layout با 4 StatCard
- ✅ AllocationWidget (Asset Distribution)
- ✅ RecentTransactionsWidget
- ✅ SecurityWidget (Security Controls Toggle)
- ✅ ColdWalletWidget
- ✅ DeFiWidget
- ✅ GeneralConfigWidget (Preferences)
- ✅ Refresh All Functionality
- ✅ Auto-refresh هر 5 دقیقه

#### ⚠️ نواقص و پیشنهادات:

1. **Backend Integration Missing** (CRITICAL):
   ```
   مشکل: API endpoints هنوز mock data برمی‌گردانند
   نیاز به پیاده‌سازی:
   - GET /api/wallet/data
   - POST /api/wallet/refresh-connector/:id
   - PUT /api/wallet/security-controls/:id
   - PUT /api/wallet/preferences
   
   فعلاً در services/api.ts mock است
   ```

2. **Transaction History Pagination** (Medium Priority):
   ```
   مشکل: فقط Recent Transactions نمایش می‌دهد
   راه‌حل: لینک به صفحه "View All Transactions"
   ```

3. **Multi-Wallet Management** (High Priority):
   ```
   مشکل: فقط یک wallet display می‌شود
   پیشنهاد: 
   - List of all connected wallets
   - Add/Remove wallet functionality
   - Default wallet selection
   ```

4. **DeFi Protocols Integration** (Low Priority):
   ```
   پیشنهاد: اتصال به:
   - Uniswap positions
   - Aave lending
   - Compound deposits
   ```

5. **Duplicate with Connections Tab** (Medium Priority):
   ```
   مشکل: ColdWalletWidget تکراری با Connections > Cold Wallet
   راه‌حل: 
   - گزینه 1: حذف از Wallet Settings
   - گزینه 2: حذف از Connections
   - گزینه 3 (بهتر): Wallet Settings فقط Overview باشد
   ```

#### 📊 نمره کلی: 7.5/10

---

### 🔔 Tab 4: Notifications Settings

**فایل**: `components/settings/NotificationsSettings.tsx` (1316 خط)  
**Backend**: `/api/notifications/*` ⚠️  
**وضعیت**: ⚠️ 50% تکمیل (پروتوتایپ)

#### ✅ موارد موجود:
- ✅ UI کامل و زیبا
- ✅ Notification Channels (Email, SMS, Push, In-App)
- ✅ Category-based Settings (Trading, Price Alerts, System, AI)
- ✅ Advanced Filters
- ✅ Test Notification Button
- ✅ Notification History

#### ❌ نواقص و پیشنهادات (CRITICAL):

1. **Backend Not Implemented** (CRITICAL):
   ```
   مشکل: Backend endpoints ناقص است
   نیاز به پیاده‌سازی کامل:
   
   Routes مورد نیاز:
   GET    /api/notifications/settings         - دریافت تنظیمات
   PUT    /api/notifications/settings         - ذخیره تنظیمات
   POST   /api/notifications/test             - ارسال تست
   GET    /api/notifications/history          - تاریخچه
   PUT    /api/notifications/history/:id/read - خواندن notification
   DELETE /api/notifications/history/:id      - حذف notification
   
   Database Schema مورد نیاز:
   Table: notification_settings
   - user_id
   - channel (email, sms, push, in_app)
   - category (trading, price_alerts, system, ai)
   - enabled (boolean)
   - filters (jsonb)
   
   Table: notification_history
   - id
   - user_id
   - type
   - message
   - read_at
   - created_at
   ```

2. **Push Notification Service** (High Priority):
   ```
   پیشنهاد: یکپارچگی با:
   - Firebase Cloud Messaging (FCM) برای موبایل
   - Web Push API برای browser
   - OneSignal یا Pusher
   ```

3. **SMS Service Integration** (Medium Priority):
   ```
   پیشنهاد: استفاده از:
   - Twilio
   - Kavenegar (ایران)
   - مستقیم با اپراتورها
   ```

4. **Email Template System** (Medium Priority):
   ```
   پیشنهاد: 
   - ایجاد Email Templates با Handlebars یا EJS
   - Preview Templates در Settings
   - Customizable branding
   ```

#### 📊 نمره کلی: 5/10 (فقط UI)

---

### 📧 Tab 5: Email Settings

**فایل**: `components/settings/EmailSettings.tsx` (301 خط)  
**Backend**: `/api/email/*` ✅ (routes/email.js - 4.8KB)  
**وضعیت**: ⚠️ 60% تکمیل

#### ✅ موارد موجود:
- ✅ SMTP Configuration (Server, Port, Username, Password, Encryption)
- ✅ From Address & Name
- ✅ Test Email Button
- ✅ Save Settings

#### ⚠️ نواقص و پیشنهادات:

1. **Backend Verification Needed** (High Priority):
   ```
   باید بررسی شود:
   - آیا backend واقعاً کار می‌کند؟
   - آیا Test Email ارسال می‌شود؟
   - آیا SMTP authentication درست است؟
   
   تست مورد نیاز:
   1. Configure Gmail SMTP
   2. Send Test Email
   3. Check delivery
   ```

2. **Email Templates Missing** (Medium Priority):
   ```
   پیشنهاد: اضافه کردن بخش Email Templates:
   - Welcome Email
   - Password Reset
   - Trade Notification
   - Daily Summary
   - ... با Preview و Edit
   ```

3. **Email Queue & Retry** (Low Priority):
   ```
   پیشنهاد: سیستم Queue برای:
   - Failed emails retry
   - Bulk email sending
   - Rate limiting
   ```

4. **Advanced Options** (Low Priority):
   ```
   پیشنهاد:
   - BCC/CC default addresses
   - Reply-To address
   - Email signature
   - Unsubscribe link
   ```

#### 📊 نمره کلی: 6/10

---

### 🎨 Tab 6: Appearance Settings

**فایل**: `components/settings/AppearanceSettings.tsx` (819 خط)  
**Backend**: `/api/settings/:key` ⚠️ (محدود)  
**وضعیت**: ✅ 70% تکمیل

#### ✅ موارد موجود:
- ✅ Theme Switcher (Dark, Light, Auto)
- ✅ Language Selector (English, فارسی)
- ✅ Real-time Apply
- ✅ Persistent Storage (localStorage)

#### ⚠️ نواقص و پیشنهادات:

1. **Limited Theme Options** (Medium Priority):
   ```
   پیشنهاد: اضافه کردن:
   - Custom Color Accent (Primary Color Picker)
   - Font Size (Small, Medium, Large, Extra Large)
   - Compact/Comfortable Density
   - High Contrast Mode (برای Accessibility)
   ```

2. **Chart Theme Customization** (Low Priority):
   ```
   پیشنهاد: تنظیمات جداگانه برای Charts:
   - Candlestick Colors (Bull/Bear)
   - Grid Lines Style
   - Indicators Colors
   ```

3. **Layout Customization** (Low Priority):
   ```
   پیشنهاد:
   - Sidebar Position (Left/Right)
   - Sidebar Collapsed by Default
   - Dashboard Widget Layout (Drag & Drop)
   ```

4. **More Languages** (Low Priority):
   ```
   پیشنهاد: اضافه کردن:
   - العربية (Arabic)
   - 中文 (Chinese)
   - Español (Spanish)
   ```

#### 📊 نمره کلی: 7/10

---

### 🔐 Tab 7: Security Settings

**فایل**: `components/settings/SecuritySettings.tsx` (352 خط)  
**Backend**: `/api/security/*` ✅ (routes/security.js - 6.9KB)  
**وضعیت**: ✅ 95% تکمیل

#### ✅ موارد موجود:
- ✅ 2FA Setup با QR Code
- ✅ 2FA Verify & Enable
- ✅ 2FA Disable با Password
- ✅ 2FA Verify Token (Login)
- ✅ Speakeasy TOTP
- ✅ Complete UI با Instructions

#### ⚠️ نواقص و پیشنهادات:

1. **Backup Codes Missing** (High Priority):
   ```
   مشکل: اگر user دستگاه 2FA خود را گم کند، راهی برای بازیابی ندارد
   راه‌حل: Backup Codes
   
   پیاده‌سازی:
   - Generate 10 one-time backup codes هنگام enable 2FA
   - نمایش codes به user
   - ذخیره hashed codes در database
   - Allow using backup code for login
   
   Backend Route:
   POST /api/security/2fa/backup-codes/generate
   POST /api/security/2fa/backup-codes/verify
   ```

2. **Session Management** (Medium Priority):
   ```
   پیشنهاد: نمایش Active Sessions:
   - Device Name & Location
   - Last Active Time
   - "Logout from this device" button
   - "Logout from all devices" button
   ```

3. **Login History** (Low Priority):
   ```
   پیشنهاد: 
   - تاریخچه Login ها
   - Suspicious activity detection
   - Email alerts for new logins
   ```

4. **Advanced Security Options** (Low Priority):
   ```
   پیشنهاد:
   - IP Whitelist/Blacklist
   - API Key Management
   - Withdrawal Whitelist Addresses
   ```

#### 📊 نمره کلی: 9.5/10

---

### 👥 Tab 8: Users Settings

**فایل**: `components/settings/UsersSettings.tsx` (1315 خط)  
**Backend**: `/api/users/*` ✅ (routes/users.js - 11KB)  
**وضعیت**: ✅ کامل اما **غیرضروری**

#### ✅ موارد موجود:
- ✅ User Management (CRUD)
- ✅ Role Management (Admin, Trader, Viewer)
- ✅ Permissions Assignment
- ✅ Add/Edit/Delete Users
- ✅ Search & Filter

#### ❌ مشکل اصلی:

```
🚫 این بخش برای یک PERSONAL TRADING PLATFORM غیرضروری است!

چرا؟
1. TitanGold یک پلتفرم شخصی است نه چند کاربره
2. هر کاربر فقط خودش باید دسترسی داشته باشد
3. این بخش فقط برای Multi-tenant یا Enterprise مناسب است

پیشنهاد:
گزینه 1 (بهتر): حذف کامل این تب
گزینه 2: مخفی کردن و فقط برای Admin (Role-based) نمایش دادن
گزینه 3: تبدیل به "Team Management" برای آینده

کد پیشنهادی برای مخفی کردن:
در Settings.tsx:
const tabs = [
  // ... other tabs
  ...(user?.role === 'admin' ? [
    { id: 'users', label: t('settings_users'), icon: <UserIcon /> }
  ] : [])
];
```

#### 📊 نمره کلی: N/A (باید حذف شود)

---

## 2️⃣ تحلیل Backend Routes

### ✅ Backend Routes موجود:

```javascript
✅ /api/settings/*          (settings.js - 5.3KB)
   - GET  /api/settings           - همه تنظیمات
   - GET  /api/settings/:key      - یک تنظیم خاص
   - PUT  /api/settings/:key      - بروزرسانی تنظیم

✅ /api/security/*          (security.js - 6.9KB)
   - POST /api/security/2fa/setup        - Setup 2FA
   - POST /api/security/2fa/verify       - Verify & Enable
   - POST /api/security/2fa/disable      - Disable 2FA
   - POST /api/security/2fa/verify-token - Login verification

✅ /api/email/*             (email.js - 4.8KB)
   - GET  /api/email/config      - دریافت تنظیمات
   - PUT  /api/email/config      - ذخیره تنظیمات
   - POST /api/email/test        - ارسال تست

⚠️ /api/notifications/*     (notifications.js - 1.5KB)
   - ناقص - نیاز به تکمیل

✅ /api/users/*             (users.js - 11KB)
   - کامل اما غیرضروری

❌ /api/profile/* - نیاز به بررسی و تکمیل
❌ /api/wallet/*  - نیاز به پیاده‌سازی کامل
```

---

## 3️⃣ هماهنگی با بقیه بخش‌ها

### 🔗 Settings ↔ Trades

**مشکلات هماهنگی**:
1. MEXC API Keys در Connections تنظیم می‌شوند اما Trades باید آن‌ها را بخواند
2. Trading Preferences در Trades هست نه در Settings
3. Stop Loss/Take Profit defaults کجا تنظیم شوند؟

**پیشنهاد**:
```
- MEXC Config: Settings > Connections ✅ (فعلی درست است)
- Trading Preferences: بیاید به Settings > Trading (جدید)
- Default Trade Parameters: Settings > Trading
- Risk Management Rules: Settings > Trading
```

### 🔗 Settings ↔ AI

**مشکلات هماهنگی**:
1. AI API Keys (OpenAI, etc.) کجا تنظیم شوند؟
2. Agent Preferences کجا؟
3. Training Schedule کجا؟

**پیشنهاد**:
```
Settings > AI Configuration (Tab جدید):
- AI API Keys (OpenAI, Anthropic, etc.)
- Default AI Model Selection
- Training Schedule
- Agent Behavior Preferences
```

### 🔗 Settings ↔ Favorites

**هماهنگی**: ✅ خوب است
- Price Alerts در Favorites تنظیم می‌شوند
- Notification Settings در Settings

### 🔗 Settings ↔ Dashboard/Portfolio/Analysis/News/Gold

**وضعیت**: ⚠️ این بخش‌ها هنوز پیاده‌سازی نشده‌اند
**پیشنهاد**: بعد از تکمیل این بخش‌ها، Settings مربوطه اضافه شوند

---

## 4️⃣ چک‌لیست کامل برای برنامه‌نویس

### 🔥 اولویت 1: CRITICAL (باید انجام شود)

#### Task 1: مخفی کردن Users Tab
**زمان**: 30 دقیقه  
**Severity**: Medium  
**فایل**: `components/Settings.tsx`

```typescript
// Before:
const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  // ... all 8 tabs including 'users'
];

// After:
const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: t('settings_profile'), icon: <ProfileIcon /> },
  { id: 'connections', label: t('settings_connections'), icon: <ConnectionIcon /> },
  { id: 'wallet', label: t('settings_wallet'), icon: <WalletIcon /> },
  { id: 'notifications', label: t('settings_notifications'), icon: <NotificationIcon /> },
  { id: 'email', label: t('email_configuration'), icon: <EmailIcon /> },
  { id: 'appearance', label: t('settings_appearance'), icon: <AppearanceIcon /> },
  { id: 'security', label: t('settings_security'), icon: <SecurityIcon /> },
  // 'users' tab حذف شد - برای single-user platform غیرضروری است
];

// Optional: اگر در آینده multi-tenant شد، با role-check اضافه کنید:
// ...(user?.role === 'admin' ? [{ id: 'users', ... }] : [])
```

---

#### Task 2: تکمیل Notifications Backend
**زمان**: 4-6 ساعت  
**Severity**: Critical  
**فایل**: `backend/routes/notifications.js`

**قدم 1: Database Schema**
```sql
-- Migration: add_notification_tables.sql

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
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_created (user_id, created_at DESC)
);

CREATE INDEX idx_notification_settings_user ON notification_settings(user_id);
CREATE INDEX idx_notification_history_user_unread ON notification_history(user_id, read_at) WHERE read_at IS NULL;
```

**قدم 2: Backend Routes**
```javascript
// backend/routes/notifications.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';

const router = express.Router();

// Get notification settings
router.get('/settings', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await query(
      'SELECT * FROM notification_settings WHERE user_id = $1 ORDER BY category, channel',
      [userId]
    );
    
    // If no settings exist, return defaults
    if (result.rows.length === 0) {
      const defaults = createDefaultNotificationSettings();
      res.json({ settings: defaults });
    } else {
      res.json({ settings: result.rows });
    }
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Save notification settings
router.put('/settings', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { settings } = req.body;
    
    // Upsert each setting
    for (const setting of settings) {
      await query(
        `INSERT INTO notification_settings (user_id, channel, category, enabled, filters)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, channel, category)
         DO UPDATE SET enabled = $4, filters = $5, updated_at = NOW()`,
        [userId, setting.channel, setting.category, setting.enabled, setting.filters || {}]
      );
    }
    
    // Return updated settings
    const result = await query(
      'SELECT * FROM notification_settings WHERE user_id = $1 ORDER BY category, channel',
      [userId]
    );
    
    res.json({ settings: result.rows, message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Error saving notification settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Get notification history
router.get('/history', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, unreadOnly = false } = req.query;
    
    let sql = `
      SELECT * FROM notification_history 
      WHERE user_id = $1
    `;
    const params = [userId];
    
    if (unreadOnly === 'true') {
      sql += ' AND read_at IS NULL';
    }
    
    sql += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
    params.push(limit, offset);
    
    const result = await query(sql, params);
    
    // Get unread count
    const unreadResult = await query(
      'SELECT COUNT(*) as count FROM notification_history WHERE user_id = $1 AND read_at IS NULL',
      [userId]
    );
    
    res.json({
      notifications: result.rows,
      unreadCount: parseInt(unreadResult.rows[0].count),
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching notification history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Mark notification as read
router.put('/history/:id/read', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    await query(
      'UPDATE notification_history SET read_at = NOW() WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Delete notification
router.delete('/history/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    await query(
      'DELETE FROM notification_history WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Send test notification
router.post('/test', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { channel, category } = req.body;
    
    // Create test notification in history
    await query(
      `INSERT INTO notification_history (user_id, type, category, title, message, data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        'test',
        category || 'system',
        'Test Notification',
        `This is a test ${channel} notification from TitanGold Platform`,
        { channel, timestamp: new Date().toISOString() }
      ]
    );
    
    // TODO: Actually send via email/sms/push based on channel
    
    res.json({ success: true, message: 'Test notification sent' });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send test' });
  }
});

function createDefaultNotificationSettings() {
  const channels = ['email', 'sms', 'push', 'in_app'];
  const categories = ['trading', 'price_alerts', 'system', 'ai'];
  const defaults = [];
  
  for (const channel of channels) {
    for (const category of categories) {
      defaults.push({
        channel,
        category,
        enabled: true, // Default همه فعال
        filters: {}
      });
    }
  }
  
  return defaults;
}

export default router;
```

**قدم 3: Integration در server.js**
```javascript
// backend/server.js
import notificationsRoutes from './routes/notifications.js';

app.use('/api/notifications', notificationsRoutes);
```

---

#### Task 3: Test Email Configuration
**زمان**: 1-2 ساعت  
**Severity**: High  
**فایل**: `backend/routes/email.js`

**مراحل تست**:
```bash
# 1. بررسی فایل email.js
cat backend/routes/email.js

# 2. تست با Gmail SMTP
curl -X PUT http://localhost:5002/api/email/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "smtpServer": "smtp.gmail.com",
    "smtpPort": 587,
    "smtpUser": "your-email@gmail.com",
    "smtpPassword": "your-app-password",
    "fromAddress": "your-email@gmail.com",
    "fromName": "TitanGold",
    "encryption": "TLS"
  }'

# 3. ارسال تست
curl -X POST http://localhost:5002/api/email/test \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. چک کردن inbox
```

**اگر کار نکرد، نیاز به Debug**:
- بررسی SMTP credentials
- فعال کردن "Less secure app access" در Gmail
- استفاده از App Password به جای password اصلی
- بررسی Firewall/Port blocking

---

### ⚠️ اولویت 2: HIGH (خیلی مهم)

#### Task 4: Wallet Backend Implementation
**زمان**: 6-8 ساعت  
**Severity**: High  
**فایل**: `backend/routes/wallet.js` (جدید)

```javascript
// backend/routes/wallet.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';

const router = express.Router();

// Get wallet data
router.get('/data', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get wallet stats
    const stats = await getWalletStats(userId);
    
    // Get assets allocation
    const assets = await getAssetsAllocation(userId);
    
    // Get recent transactions
    const transactions = await getRecentTransactions(userId, 10);
    
    // Get security controls
    const securityControls = await getSecurityControls(userId);
    
    // Get wallet connectors
    const connectors = await getWalletConnectors(userId);
    
    // Get preferences
    const preferences = await getWalletPreferences(userId);
    
    res.json({
      stats,
      assets,
      transactions,
      securityControls,
      connectors,
      preferences,
      lastSyncedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching wallet data:', error);
    res.status(500).json({ error: 'Failed to fetch wallet data' });
  }
});

// Refresh connector
router.post('/refresh-connector/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    // TODO: Implement refresh logic for specific connector
    // This would typically:
    // 1. Fetch latest balance from blockchain/exchange
    // 2. Update database
    // 3. Return updated data
    
    const updatedData = await refreshConnector(userId, id);
    res.json(updatedData);
  } catch (error) {
    console.error('Error refreshing connector:', error);
    res.status(500).json({ error: 'Failed to refresh connector' });
  }
});

// Toggle security control
router.put('/security-controls/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { enabled } = req.body;
    
    await query(
      `UPDATE wallet_security_controls 
       SET enabled = $1, updated_at = NOW() 
       WHERE id = $2 AND user_id = $3`,
      [enabled, id, userId]
    );
    
    const updatedData = await getWalletData(userId);
    res.json(updatedData);
  } catch (error) {
    console.error('Error toggling security control:', error);
    res.status(500).json({ error: 'Failed to toggle security control' });
  }
});

// Update preferences
router.put('/preferences', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { preferences } = req.body;
    
    await query(
      `INSERT INTO wallet_preferences (user_id, preferences)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET preferences = $2, updated_at = NOW()`,
      [userId, preferences]
    );
    
    const updatedData = await getWalletData(userId);
    res.json(updatedData);
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Helper functions
async function getWalletStats(userId) {
  // TODO: Calculate from actual data
  return {
    totalAssets: 0,
    activeWallets: 0,
    profit24h: 0,
    coldStorage: 0
  };
}

async function getAssetsAllocation(userId) {
  // TODO: Get from database
  return [];
}

async function getRecentTransactions(userId, limit) {
  // TODO: Get from database
  return [];
}

async function getSecurityControls(userId) {
  const result = await query(
    'SELECT * FROM wallet_security_controls WHERE user_id = $1',
    [userId]
  );
  return result.rows;
}

async function getWalletConnectors(userId) {
  // TODO: Get from database
  return [];
}

async function getWalletPreferences(userId) {
  const result = await query(
    'SELECT preferences FROM wallet_preferences WHERE user_id = $1',
    [userId]
  );
  return result.rows[0]?.preferences || {};
}

async function refreshConnector(userId, connectorId) {
  // TODO: Implement
  return await getWalletData(userId);
}

async function getWalletData(userId) {
  // TODO: Implement
  return {};
}

export default router;
```

---

#### Task 5: Add 2FA Backup Codes
**زمان**: 2-3 ساعت  
**Severity**: High  
**فایل**: `backend/routes/security.js`

**قدم 1: Database Migration**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_backup_codes JSONB DEFAULT '[]';
```

**قدم 2: Backend Route**
```javascript
// backend/routes/security.js

// Generate backup codes
router.post('/2fa/backup-codes/generate', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if 2FA is enabled
    const userResult = await query(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );
    
    if (!userResult.rows[0]?.two_factor_enabled) {
      return res.status(400).json({ error: '2FA must be enabled first' });
    }
    
    // Generate 10 backup codes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      const code = generateRandomCode(8); // 8-digit code
      backupCodes.push({
        code: code,
        hash: await bcrypt.hash(code, 10),
        used: false
      });
    }
    
    // Save hashed codes to database
    const hashedCodes = backupCodes.map(bc => ({ hash: bc.hash, used: false }));
    await query(
      'UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2',
      [JSON.stringify(hashedCodes), userId]
    );
    
    // Return plain codes to user (only time they can see them)
    res.json({
      backupCodes: backupCodes.map(bc => bc.code),
      message: 'Save these codes in a safe place. You will not be able to see them again.'
    });
  } catch (error) {
    console.error('Error generating backup codes:', error);
    res.status(500).json({ error: 'Failed to generate backup codes' });
  }
});

// Verify backup code (during login)
router.post('/2fa/backup-codes/verify', async (req, res) => {
  try {
    const { userId, backupCode } = req.body;
    
    const userResult = await query(
      'SELECT two_factor_backup_codes FROM users WHERE id = $1',
      [userId]
    );
    
    const backupCodes = JSON.parse(userResult.rows[0]?.two_factor_backup_codes || '[]');
    
    // Find matching backup code
    let codeFound = false;
    for (let i = 0; i < backupCodes.length; i++) {
      if (!backupCodes[i].used) {
        const isMatch = await bcrypt.compare(backupCode, backupCodes[i].hash);
        if (isMatch) {
          // Mark as used
          backupCodes[i].used = true;
          await query(
            'UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2',
            [JSON.stringify(backupCodes), userId]
          );
          codeFound = true;
          break;
        }
      }
    }
    
    if (codeFound) {
      res.json({ success: true, message: 'Backup code verified' });
    } else {
      res.status(400).json({ error: 'Invalid or used backup code' });
    }
  } catch (error) {
    console.error('Error verifying backup code:', error);
    res.status(500).json({ error: 'Failed to verify backup code' });
  }
});

function generateRandomCode(length) {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
}
```

**قدم 3: Frontend UI در SecuritySettings.tsx**
```typescript
// Add after 2FA enable
const [backupCodes, setBackupCodes] = useState<string[]>([]);
const [showBackupCodes, setShowBackupCodes] = useState(false);

const generateBackupCodes = async () => {
  try {
    const response = await api.generateBackupCodes();
    setBackupCodes(response.backupCodes);
    setShowBackupCodes(true);
  } catch (error) {
    setError('Failed to generate backup codes');
  }
};

// UI
{showBackupCodes && (
  <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-4">
    <h4 className="font-semibold text-yellow-300 mb-2">⚠️ Save Your Backup Codes</h4>
    <p className="text-sm text-yellow-200 mb-3">
      Save these codes in a safe place. You can use them to login if you lose your 2FA device.
      Each code can only be used once.
    </p>
    <div className="grid grid-cols-2 gap-2 bg-gray-900 p-3 rounded font-mono text-sm">
      {backupCodes.map((code, i) => (
        <div key={i} className="text-white">{i + 1}. {code}</div>
      ))}
    </div>
    <button
      onClick={() => {
        navigator.clipboard.writeText(backupCodes.join('\n'));
        alert('Codes copied to clipboard');
      }}
      className="mt-3 text-sm text-blue-400 hover:text-blue-300"
    >
      📋 Copy All Codes
    </button>
  </div>
)}
```

---

#### Task 6: Fix Avatar Storage
**زمان**: 2-3 ساعت  
**Severity**: Medium  
**فایل**: `backend/routes/profile.js` (جدید)

**راه‌حل: استفاده از File Upload + Local Storage**

```javascript
// backend/routes/profile.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/avatars');
    
    // Create directory if not exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user.id;
    const ext = path.extname(file.originalname);
    cb(null, `user-${userId}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Upload avatar
router.post('/avatar', authenticate, upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Generate public URL
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    
    // Delete old avatar file if exists
    const oldResult = await query('SELECT avatar_url FROM users WHERE id = $1', [userId]);
    const oldAvatarUrl = oldResult.rows[0]?.avatar_url;
    if (oldAvatarUrl && oldAvatarUrl.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '..', oldAvatarUrl);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }
    
    // Update database
    await query(
      'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2',
      [avatarUrl, userId]
    );
    
    res.json({
      avatarUrl: avatarUrl,
      message: 'Avatar uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Serve avatars statically
router.use('/uploads/avatars', express.static(path.join(__dirname, '../uploads/avatars')));

export default router;
```

**Integration در server.js**:
```javascript
import profileRoutes from './routes/profile.js';
app.use('/api/profile', profileRoutes);

// Serve uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

**Frontend تغییر**:
```typescript
// ProfileSettings.tsx
const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  // Validate
  if (!file.type.startsWith('image/')) {
    setError(t('invalid_image_file'));
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    setError(t('image_too_large'));
    return;
  }

  try {
    // Create FormData
    const formData = new FormData();
    formData.append('avatar', file);

    // Upload
    const response = await api.uploadAvatar(formData);
    
    // Update preview
    setAvatarPreview(response.avatarUrl);
    setAvatarUrl(response.avatarUrl);
    
    setSuccess(t('avatar_updated'));
    setTimeout(() => setSuccess(null), 3000);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to upload avatar');
  }
};
```

---

### 📝 اولویت 3: MEDIUM (مهم اما نه فوری)

#### Task 7: Timezone Dropdown
#### Task 8: Remove Language from Profile
#### Task 9: Add Theme Customization Options
#### Task 10: Session Management UI
#### Task 11: Multi-Exchange Support

*(جزئیات این Task ها در صورت نیاز می‌توانم اضافه کنم)*

---

## 5️⃣ نتیجه‌گیری و پیشنهاد نهایی

### 📊 امتیاز کلی بخش Settings: 7.5/10

**نقاط قوت**:
- ✅ UI زیبا و حرفه‌ای
- ✅ Component ها modular و منظم
- ✅ 2FA کامل و عالی
- ✅ Connections عالی (MEXC + Wallets)

**نقاط ضعف**:
- ❌ Notifications Backend ناقص
- ❌ Wallet Backend ناقص
- ❌ Users Tab غیرضروری
- ⚠️ Avatar storage نامناسب
- ⚠️ Email نیاز به تست

### 🎯 پیشنهاد اصلی:

**مرحله 1 (این هفته)**:
1. Users Tab را مخفی کنیم ✅
2. Notifications Backend را کامل کنیم ✅
3. Email را تست کنیم ✅

**مرحله 2 (هفته بعد)**:
4. Wallet Backend را پیاده‌سازی کنیم
5. 2FA Backup Codes اضافه کنیم
6. Avatar Upload را با File Storage پیاده‌سازی کنیم

**مرحله 3 (در آینده)**:
7. بقیه بهبودها و gزینه‌های اضافی

---

### 📋 خلاصه Task ها برای برنامه‌نویس:

| Task | اولویت | زمان | Severity |
|------|--------|------|----------|
| 1. مخفی کردن Users Tab | 🔥 Critical | 30 دقیقه | Medium |
| 2. تکمیل Notifications Backend | 🔥 Critical | 4-6 ساعت | Critical |
| 3. تست Email Configuration | 🔥 Critical | 1-2 ساعت | High |
| 4. Wallet Backend Implementation | ⚠️ High | 6-8 ساعت | High |
| 5. Add 2FA Backup Codes | ⚠️ High | 2-3 ساعت | High |
| 6. Fix Avatar Storage | ⚠️ High | 2-3 ساعت | Medium |
| 7-11. بهبودهای دیگر | 📝 Medium | متغیر | Medium |

**زمان کل تخمینی**: 16-25 ساعت (2-3 روز کاری)

---

**آماده برای شروع؟** 🚀

چه کاری می‌خواهید انجام دهیم:
1. کار را شروع کنیم و Task های Critical را انجام دهیم؟
2. گزارش را در GitHub commit کنیم؟
3. توضیحات بیشتری درباره یک Task خاص بدهیم؟
4. بریم سراغ بخش بعدی (AI/Trades/Favorites)؟
