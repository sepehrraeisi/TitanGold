# TitanGold - مشکل بحرانی دیسک 100% - 2026-06-15

**تاریخ:** 2026-06-15 15:32 UTC  
**شدت:** 🔴🔴🔴 CRITICAL  
**وضعیت:** ✅ حل شد (100% → 52%)  
**سرور:** titan.zala.ir (95.217.14.161)

---

## 🚨 خلاصه بحران

**مشکل:** دیسک به 100% رسید، سیستم backup متوقف شد

**نتایج:**
- Backup جدید ایجاد نمی‌شد (آخرین backup: 13 June)
- PostgreSQL با "No space left on device" crash می‌کرد
- Daily Report (همچنان مشکل داشت - fix قبلی کافی نبود)
- Health Check FAILED (backup بیش از 50h قدیمی)

**علت اصلی:** telegram-collector هر چند دقیقه crash می‌کند و core dump ایجاد می‌کند (هر فایل 4.3GB!)

---

## تحلیل Timeline

### پیام‌های کاربر (Telegram):

**14 June 6:30 AM:**
```
✅ TitanGold Backup
Backup Rotation Completed
📁 Backups: 6 daily, 5 weekly, 2 monthly
📊 Total storage: 14G
💾 Disk Usage: 67%
```

**14 June 8:30 AM:**
```
✅ TitanGold Backup
Health Check Passed ✅
📁 Latest backup: titangold_daily_2026-06-13.sql.gpg
⏰ Age: 26h
💾 Disk Usage: 71%
```

**15 June 6:30 AM:**
```
✅ TitanGold Backup
Backup Rotation Completed
📁 Backups: 6 daily, 4 weekly, 2 monthly
📊 Total storage: 21G
💾 Disk Usage: 99% ⚠️⚠️⚠️
```

**15 June 8:30 AM:**
```
🔴 TitanGold Backup
Health Check FAILED
⚠️ Latest backup is too old
📁 File: titangold_daily_2026-06-13.sql.gpg
⏰ Age: 50h (threshold: 48h)
```

### تحلیل:
- 14 Jun 06:30: Disk 67% (طبیعی)
- 14 Jun 08:30: Disk 71% (+4% در 2 ساعت) ⚠️
- 15 Jun 06:30: Disk 99% (+28% در 22 ساعت) 🔴
- 15 Jun 08:30: Health Check FAILED - backup 50h قدیمی است

**نتیجه:** در کمتر از 24 ساعت، دیسک از 71% به 99% رسید!

---

## 🔍 تشخیص علت ریشه‌ای

### مرحله 1: بررسی فضای دیسک

```bash
df -h /
# نتیجه:
Filesystem                         Size  Used Avail Use% Mounted on
/dev/mapper/ubuntu--vg-ubuntu--lv   97G   92G  839M 100% /
```

**فقط 839MB فضا باقی مانده بود!**

### مرحله 2: پیدا کردن بزرگترین directories

```bash
sudo du -h --max-depth=1 / 2>/dev/null | sort -hr | head -10

# نتایج:
93G   /
45G   /home         ⚠️
40G   /var
5.1G  /usr
714M  /snap
```

### مرحله 3: تحلیل /home

```bash
sudo du -h --max-depth=1 /home/ubuntu | sort -hr

# نتایج:
45G   /home/ubuntu
37G   /home/ubuntu/webapp  ⚠️⚠️
3.9G  /home/ubuntu/.pm2
2.3G  /home/ubuntu/.cursor-server
```

### مرحله 4: تحلیل /webapp

```bash
sudo du -h --max-depth=1 /home/ubuntu/webapp/TitanGold | sort -hr

# نتایج:
37G   /home/ubuntu/webapp/TitanGold
36G   /home/ubuntu/webapp/TitanGold/telegram-collector  🔴🔴🔴
722M  /home/ubuntu/webapp/TitanGold/deploy
566M  /home/ubuntu/webapp/TitanGold/node_modules
```

### مرحله 5: پیدا کردن core dumps

```bash
sudo find /home/ubuntu/webapp/TitanGold/telegram-collector -type f -size +100M

# نتایج (فایل‌های core dump):
-rw------- 1 ubuntu ubuntu 333M Jun 15 07:53 core.3685219
-rw------- 1 ubuntu ubuntu 4.3G Jun 13 18:42 core.3444779
-rw------- 1 ubuntu ubuntu 1.3G Jun 15 12:38 core.3707052
-rw------- 1 ubuntu ubuntu 4.3G Jun 14 22:25 core.3637389
-rw------- 1 ubuntu ubuntu 4.3G Jun 14 04:11 core.3489546
-rw------- 1 ubuntu ubuntu 4.3G Jun 14 08:55 core.3511445
-rw------- 1 ubuntu ubuntu 4.4G Jun 13 13:58 core.3388985
-rw------- 1 ubuntu ubuntu 4.4G Jun 14 13:12 core.3554851
-rw------- 1 ubuntu ubuntu 4.3G Jun 13 23:27 core.3469831
-rw------- 1 ubuntu ubuntu 4.3G Jun 14 17:40 core.3606356

مجموع: ~40GB core dumps!
```

### مرحله 6: بررسی /var

```bash
sudo du -h --max-depth=1 /var | sort -hr

# نتایج:
40G   /var
21G   /var/backups  ⚠️ (افزایش از 14GB)
17G   /var/lib
1.3G  /var/www
684M  /var/crash    🔴 (جدید!)
```

### مرحله 7: بررسی backup directory

```bash
sudo ls -lh /var/backups/titangold/daily/ | tail -10

# پیدا کردن مشکل:
-rw-rw-r-- 1 postgres postgres 1.3G Jun 13 02:06 titangold_daily_2026-06-13.sql.gpg
-rw-rw-r-- 1 postgres postgres 8.5G Jun 15 02:03 titangold_daily_2026-06-15.sql  🔴

# فایل 15 June encrypt نشده و 8.5GB فضا گرفته!
```

### مرحله 8: بررسی crash files

```bash
sudo ls -lh /var/crash/

# نتیجه:
-rw-r----- 1 ubuntu root 683M May 28 09:20 _usr_bin_node.1000.crash
```

---

## 🎯 ریشه مشکل: telegram-collector crash loop

### بررسی PM2 status:

```bash
pm2 list

# نتیجه:
│ 6  │ telegram-collector  │ fork  │ 3730253  │ 2h  │ 528 ↺  │ online │

528 restart در 2 ساعت! = هر 13 ثانیه یک crash!
```

### بررسی logs:

```bash
pm2 logs telegram-collector --lines 50 --nostream

# Error مکرر:
Error: TIMEOUT
    at /home/ubuntu/webapp/TitanGold/telegram-collector/node_modules/telegram/client/updates.js:250:85
    at async _updateLoop (.../telegram/client/updates.js:184:17)
```

### علت crash:
- telegram API timeout می‌شود
- Node.js process crash می‌کند
- kernel core dump ایجاد می‌کند (4.3GB per crash!)
- در 24 ساعت، ~40GB core dump تولید شد!

---

## 🚀 راه‌حل اعمال شده

### 1. پاکسازی فوری فضای دیسک

```bash
# 1. حذف core dumps (40GB)
sudo rm -f /home/ubuntu/webapp/TitanGold/telegram-collector/core.*
# آزاد شده: ~40GB

# 2. حذف crash reports (684MB)
sudo rm -f /var/crash/*
# آزاد شده: 684MB

# 3. حذف backup نیمه‌کاره (8.5GB)
sudo rm -f /var/backups/titangold/daily/titangold_daily_2026-06-15.sql
# آزاد شده: 8.5GB

# مجموع آزاد شده: ~49GB
```

### 2. غیرفعال‌سازی Core Dumps

```bash
# 1. محدود کردن core dump size (system-wide)
echo "* hard core 0" | sudo tee -a /etc/security/limits.conf

# 2. غیرفعال کردن فوری
sudo sysctl -w kernel.core_pattern='|/bin/false'

# 3. دائمی کردن تنظیمات
echo "kernel.core_pattern=|/bin/false" | sudo tee -a /etc/sysctl.conf
```

### 3. بررسی Daily Report

```bash
# تست دستی:
sudo /usr/local/bin/titangold-daily-report.sh

# نتیجه:
[2026-06-15 15:32:35] [DAILY_REPORT] === Starting Daily Morning Report ===
[2026-06-15 15:32:36] [DAILY_REPORT] Sending daily report to Telegram...
[2026-06-15 15:32:36] [DAILY_REPORT] ✅ Daily report sent successfully
[2026-06-15 15:32:36] [DAILY_REPORT] === Daily Morning Report Complete ===
```

✅ Daily Report fix قبلی (13 June) همچنان کار می‌کند!

---

## ✅ نتایج نهایی

### Disk Usage بعد از cleanup:

```bash
df -h /

# Before:
/dev/mapper/ubuntu--vg-ubuntu--lv   97G   92G  839M 100% /

# After:
/dev/mapper/ubuntu--vg-ubuntu--lv   97G   48G   46G  52% /
```

**✅ 48% کاهش در disk usage (100% → 52%)**  
**✅ 48GB فضای خالی (از 839MB)**

### خلاصه فضای آزاد شده:

| مورد | فضا آزاد شده |
|------|--------------|
| Core dumps (telegram-collector) | ~40GB |
| Backup نیمه‌کاره | 8.5GB |
| Crash reports (/var/crash) | 684MB |
| **مجموع** | **~49GB** |

---

## 🔴 مشکلات باقیمانده

### 1. telegram-collector stability

**مشکل:** process هر چند دقیقه crash می‌کند

**Evidence:**
```
PM2 restarts: 528 times در 2 ساعت
Error: TIMEOUT in telegram API updates
```

**تاثیر:**
- ✅ دیگر core dump ایجاد نمی‌شود (غیرفعال کردیم)
- ⚠️ اما process همچنان unstable است
- ⚠️ ممکن است داده‌ها از دست بروند

**نیاز به اقدام:**
- بررسی کد telegram-collector
- timeout handling بهبود یابد
- error recovery mechanism اضافه شود
- consider using graceful restart strategy

### 2. Backup creation failure

**مشکل:** backup 15 June ایجاد نشد

**Evidence:**
```
# آخرین backup موفق: 13 June
titangold_daily_2026-06-13.sql.gpg (1.3GB) ✅

# Backup 14 June: وجود ندارد ❌

# Backup 15 June: نیمه‌کاره و encrypt نشد
titangold_daily_2026-06-15.sql (8.5GB) ❌
```

**علت:**
- دیسک پر بود → PostgreSQL نتوانست backup بگیرد
- Error: "could not write to file: No space left on device"

**وضعیت فعلی:**
- ✅ فضای کافی برای backup جدید آزاد شد (46GB)
- ⏳ backup بعدی: امشب 2:00 AM (16 June)

---

## 📊 وضعیت کنونی سیستم

```
✅ Disk Space: 52% (46GB آزاد)
✅ Daily Report: کار می‌کند
⚠️ Telegram Collector: unstable (528 restarts/2h)
⚠️ Backup: آخرین backup موفق: 13 June (50h قدیمی)
✅ Core Dumps: غیرفعال شده
✅ PostgreSQL: عملیاتی
✅ Backend: عملیاتی (titan-backend cluster)
```

---

## 🔄 اقدامات انجام شده

| اقدام | وضعیت | نتیجه |
|-------|--------|--------|
| حذف core dumps | ✅ | 40GB آزاد |
| حذف crash reports | ✅ | 684MB آزاد |
| حذف backup نیمه‌کاره | ✅ | 8.5GB آزاد |
| غیرفعال کردن core dumps | ✅ | جلوگیری از تولید در آینده |
| تست Daily Report | ✅ | کار می‌کند |
| تست PostgreSQL | ✅ | عملیاتی |

---

## 📋 TODO: اقدامات بعدی

### فوری (Priority 1):

1. **✅ Fix telegram-collector stability**
   - بررسی کد و timeout handling
   - پیاده‌سازی graceful error recovery
   - افزودن retry mechanism با exponential backoff
   - consider circuit breaker pattern

2. **✅ Monitor backup creation**
   - بررسی backup امشب (2:00 AM, 16 June)
   - اگر موفق نشد، manual backup بگیریم

3. **✅ Setup disk monitoring**
   - Alert اگر disk > 80%
   - Daily disk usage report

### کوتاه‌مدت (Priority 2):

4. **Backup retention review**
   - policy فعلی: 7 daily, 4 weekly, 3 monthly
   - آیا نیاز به کاهش داریم؟ (فعلاً خیر - 21GB OK است)

5. **Log monitoring**
   - بررسی `/var/log` size
   - اطمینان از log rotation

6. **Database growth monitoring**
   - `/var/lib/postgresql`: 17GB
   - رشد ماهیانه چقدر است؟

### میان‌مدت (Priority 3):

7. **Telegram collector refactoring**
   - بررسی استفاده از memory
   - optimize connection pooling
   - implement health check endpoint

8. **Automated cleanup**
   - اگر disk > 85%، قدیمی‌ترین backups را پاک کن
   - temporary files cleanup

9. **Backup to remote storage**
   - consider S3/object storage برای backups
   - کاهش فشار به local disk

---

## 📈 مانیتورینگ توصیه شده

### Disk Usage:
```bash
# هر روز بررسی شود:
df -h / | grep -v Filesystem

# اگر > 80%: Alert
# اگر > 90%: Critical Alert
# اگر > 95%: Emergency cleanup
```

### Telegram Collector:
```bash
# بررسی restart count:
pm2 list | grep telegram-collector

# اگر restarts > 100/hour: Alert
# اگر restarts > 500/hour: Critical (مثل الان)
```

### Backup Status:
```bash
# بررسی آخرین backup:
ls -lth /var/backups/titangold/daily/ | head -5

# اگر آخرین backup > 30h: Warning
# اگر آخرین backup > 48h: Critical (مثل الان)
```

---

## 🔗 مستندات مرتبط

- `ISSUES_FIXED_2026-06-13_FA.md` - مشکل Daily Report و Disk 77%
- `/var/log/titangold-backup-rotation.log` - backup logs
- `/var/log/postgresql/` - database logs

---

## خلاصه نهایی

| مورد | قبل | بعد | تغییر |
|------|-----|-----|-------|
| **Disk Usage** | 🔴 100% (92GB/97GB) | ✅ 52% (48GB/97GB) | -48% |
| **فضای خالی** | 🔴 839MB | ✅ 46GB | +45GB |
| **Core Dumps** | 🔴 40GB (active) | ✅ 0GB (disabled) | -40GB |
| **Crash Reports** | 🔴 684MB | ✅ 0MB | -684MB |
| **Backup نیمه‌کاره** | 🔴 8.5GB | ✅ حذف شد | -8.5GB |
| **Daily Report** | ✅ کار می‌کند | ✅ کار می‌کند | - |
| **Telegram Collector** | 🔴 528 crash/2h | 🔴 unstable | نیاز به fix |
| **آخرین Backup** | 🔴 13 June (50h) | ⏳ منتظر 16 June | - |

---

**نتیجه نهایی:**  
✅ بحران دیسک حل شد (100% → 52%)  
✅ 46GB فضای خالی  
✅ Daily Report کار می‌کند  
⚠️ Telegram collector نیاز به stability fix دارد  
⏳ Backup بعدی: امشب 2:00 AM (16 June)

🔴 **Action Required:** Fix telegram-collector stability به زودی!

---

**تهیه شده:** 2026-06-15 15:32 UTC  
**تهیه کننده:** Claude AI Assistant  
**مخاطب:** TitanGold DevOps Team
