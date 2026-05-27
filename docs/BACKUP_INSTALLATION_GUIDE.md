# راهنمای نصب و پیکربندی بک‌آپ حرفه‌ای TitanGold

## 📋 استراتژی 7-4-3

این استراتژی استاندارد صنعت برای retention policy است:
- **7 Daily**: نسخه‌های 7 روز اخیر
- **4 Weekly**: نسخه‌های 4 هفته اخیر
- **3 Monthly**: نسخه‌های 3 ماه اخیر

### مزایا نسبت به روش فعلی:
- ✅ **23% صرفه‌جویی در فضا** (~13.7GB → ~10.5GB)
- ✅ **پوشش بلندمدت‌تر** (1 ماه → 3 ماه)
- ✅ **مدیریت خودکار** (بدون نیاز به دخالت دستی)
- ✅ **سازگار با 3-2-1 rule**

---

## 🚀 نصب (یکبار اجرا)

### مرحله 1: کپی اسکریپت‌ها به محل سیستمی

```bash
cd /home/ubuntu/webapp

# کپی اسکریپت‌ها به /usr/local/bin
sudo cp scripts/titangold-backup-rotation.sh /usr/local/bin/
sudo cp scripts/titangold-monthly-backup.sh /usr/local/bin/
sudo cp scripts/titangold-backup-healthcheck.sh /usr/local/bin/

# اعطای مجوز اجرا
sudo chmod +x /usr/local/bin/titangold-backup-rotation.sh
sudo chmod +x /usr/local/bin/titangold-monthly-backup-sh
sudo chmod +x /usr/local/bin/titangold-backup-healthcheck.sh

# تأیید نصب
ls -lh /usr/local/bin/titangold-*
```

### مرحله 2: ایجاد دایرکتوری Monthly

```bash
# ایجاد پوشه monthly اگر وجود ندارد
sudo mkdir -p /var/backups/titangold/monthly
sudo chown -R postgres:postgres /var/backups/titangold/monthly
sudo chmod 750 /var/backups/titangold/monthly

# تأیید دسترسی
ls -ld /var/backups/titangold/*
```

### مرحله 3: تست دستی اسکریپت‌ها

```bash
# تست rotation script
sudo /usr/local/bin/titangold-backup-rotation.sh

# بررسی لاگ
tail -20 /var/log/titangold-backup-rotation.log

# تست monthly backup creator
sudo /usr/local/bin/titangold-monthly-backup.sh

# تست health check
sudo /usr/local/bin/titangold-backup-healthcheck.sh
```

### مرحله 4: پیکربندی Cron Jobs

```bash
# ویرایش crontab به عنوان root
sudo crontab -e

# اضافه کردن این خطوط:
# -----------------------------------
# TitanGold Backup Rotation (7-4-3 Policy)
0 3 * * * /usr/local/bin/titangold-backup-rotation.sh >> /var/log/titangold-backup-rotation.log 2>&1
0 4 1 * * /usr/local/bin/titangold-monthly-backup.sh >> /var/log/titangold-backup-rotation.log 2>&1
0 5 * * * /usr/local/bin/titangold-backup-healthcheck.sh >> /var/log/titangold-backup-rotation.log 2>&1
# -----------------------------------

# ذخیره و خروج (Ctrl+X → Y → Enter در nano)
```

### مرحله 5: تأیید Cron Jobs

```bash
# بررسی cron jobs نصب شده
sudo crontab -l | grep titangold

# بررسی لاگ cron
sudo tail -f /var/log/cron

# یا در Ubuntu:
sudo tail -f /var/log/syslog | grep CRON
```

---

## 🧪 تست و صحت‌سنجی

### تست 1: اجرای دستی و بررسی خروجی

```bash
# اجرای rotation
sudo /usr/local/bin/titangold-backup-rotation.sh

# انتظار خروجی:
# [2026-05-27 10:30:15] === Starting TitanGold Backup Rotation ===
# [2026-05-27 10:30:15] Before rotation: Daily=13, Weekly=5, Monthly=0
# [2026-05-27 10:30:15] Rotating daily backups (keeping last 7 days)...
# [2026-05-27 10:30:16] Rotating weekly backups (keeping last 28 days)...
# [2026-05-27 10:30:16] Rotating monthly backups (keeping last 90 days)...
# [2026-05-27 10:30:16] After rotation: Daily=7, Weekly=4, Monthly=0
# [2026-05-27 10:30:16] Deleted: Daily=6, Weekly=1, Monthly=0
# [2026-05-27 10:30:16] Current backup sizes: Daily=5.3G, Weekly=3.0G, Monthly=0, Total=8.3G
# [2026-05-27 10:30:16] === Backup Rotation Completed Successfully ===
```

### تست 2: بررسی تعداد فایل‌ها

```bash
# تعداد بک‌آپ‌ها بعد از rotation
echo "Daily: $(find /var/backups/titangold/daily -type f -name '*.sql.gpg' | wc -l)"
echo "Weekly: $(find /var/backups/titangold/weekly -type f -name '*.sql.gpg' | wc -l)"
echo "Monthly: $(find /var/backups/titangold/monthly -type f -name '*.sql.gpg' | wc -l)"

# انتظار:
# Daily: 7
# Weekly: 4
# Monthly: 0 (تا اول ماه بعد)
```

### تست 3: شبیه‌سازی ایجاد monthly backup

```bash
# اجرای دستی (بدون انتظار تا اول ماه)
sudo /usr/local/bin/titangold-monthly-backup.sh

# بررسی
ls -lh /var/backups/titangold/monthly/
# باید یک فایل جدید با نام titangold_monthly_YYYY-MM-01.sql.gpg ایجاد شود
```

---

## 📊 مانیتورینگ و نگهداری

### بررسی روزانه وضعیت

```bash
# بررسی لاگ rotation
tail -50 /var/log/titangold-backup-rotation.log

# بررسی فضای مصرفی
du -sh /var/backups/titangold/*

# بررسی جدیدترین بک‌آپ
ls -lth /var/backups/titangold/daily/ | head -5
```

### بررسی Health Check

```bash
# اجرای دستی health check
sudo /usr/local/bin/titangold-backup-healthcheck.sh

# بررسی آخرین alert ها در syslog
sudo grep "titangold-backup" /var/log/syslog | tail -10
```

### Monitoring با Grafana/Prometheus (اختیاری)

اگر سیستم monitoring دارید، می‌توانید این متریک‌ها را اضافه کنید:

```bash
# تعداد بک‌آپ‌های موجود
titangold_backup_count{type="daily"} = $(find /var/backups/titangold/daily -type f | wc -l)
titangold_backup_count{type="weekly"} = $(find /var/backups/titangold/weekly -type f | wc -l)
titangold_backup_count{type="monthly"} = $(find /var/backups/titangold/monthly -type f | wc -l)

# حجم بک‌آپ‌ها (بایت)
titangold_backup_size_bytes{type="daily"} = $(du -sb /var/backups/titangold/daily | cut -f1)

# سن آخرین بک‌آپ (ثانیه)
titangold_backup_age_seconds = $(( $(date +%s) - $(stat -c %Y $(ls -t /var/backups/titangold/daily/*.sql.gpg | head -1)) ))
```

---

## 🔧 عیب‌یابی (Troubleshooting)

### مشکل 1: اسکریپت اجرا نمی‌شود

```bash
# بررسی مجوزها
ls -lh /usr/local/bin/titangold-backup-rotation.sh

# باید چیزی شبیه این باشد:
# -rwxr-xr-x 1 root root 3.1K May 27 10:00 titangold-backup-rotation.sh

# اگر مجوز اجرا ندارد:
sudo chmod +x /usr/local/bin/titangold-backup-rotation.sh
```

### مشکل 2: دسترسی به دایرکتوری

```bash
# بررسی مالکیت و مجوزها
ls -ld /var/backups/titangold/*

# تنظیم مجوزهای صحیح
sudo chown -R postgres:postgres /var/backups/titangold
sudo chmod 750 /var/backups/titangold/*
```

### مشکل 3: Cron اجرا نمی‌شود

```bash
# بررسی سرویس cron
sudo systemctl status cron

# اگر غیرفعال است:
sudo systemctl start cron
sudo systemctl enable cron

# بررسی لاگ cron
sudo tail -f /var/log/syslog | grep CRON
```

### مشکل 4: Monthly backup ایجاد نمی‌شود

```bash
# بررسی وجود weekly backup
ls -lh /var/backups/titangold/weekly/

# اگر weekly backup وجود ندارد:
# باید ابتدا حداقل یک weekly backup داشته باشید

# اجرای دستی برای دیباگ
sudo bash -x /usr/local/bin/titangold-monthly-backup.sh
```

---

## 🔐 امنیت و Best Practices

### 1. محافظت از اسکریپت‌ها

```bash
# فقط root باید بتواند اسکریپت‌ها را ویرایش کند
sudo chown root:root /usr/local/bin/titangold-*
sudo chmod 755 /usr/local/bin/titangold-*
```

### 2. رمزنگاری بک‌آپ‌ها

بک‌آپ‌های شما با GPG رمزنگاری شده‌اند (✅ already done). مطمئن شوید:

```bash
# تست decrypt
sudo gpg -d /var/backups/titangold/daily/$(ls -t /var/backups/titangold/daily/*.sql.gpg | head -1) > /tmp/test_restore.sql

# اگر موفق بود، فایل تست را حذف کنید
rm /tmp/test_restore.sql
```

### 3. Offsite Backup (3-2-1 Rule)

برای تکمیل 3-2-1 rule، حداقل یکی از monthly backups را به مکان خارج از سرور منتقل کنید:

```bash
# گزینه 1: rsync به سرور backup
rsync -avz --progress /var/backups/titangold/monthly/ backup-server:/backups/titangold/

# گزینه 2: آپلود به cloud storage (S3, Wasabi, Backblaze B2)
# s3cmd put /var/backups/titangold/monthly/*.sql.gpg s3://my-backup-bucket/titangold/

# گزینه 3: Rclone (پشتیبانی از 40+ cloud provider)
# rclone copy /var/backups/titangold/monthly/ remote:titangold-backups/
```

---

## 📅 جدول زمان‌بندی نهایی

| زمان | روز | کار | اسکریپت |
|------|-----|-----|---------|
| **03:00** | هر روز | Rotation (حذف قدیمی‌ها) | `titangold-backup-rotation.sh` |
| **04:00** | اول هر ماه | ایجاد monthly backup | `titangold-monthly-backup.sh` |
| **05:00** | هر روز | Health check | `titangold-backup-healthcheck.sh` |

---

## ✅ Checklist نهایی

- [ ] اسکریپت‌ها کپی شدند به `/usr/local/bin/`
- [ ] مجوز اجرا به اسکریپت‌ها داده شد (`chmod +x`)
- [ ] دایرکتوری `/var/backups/titangold/monthly/` ایجاد شد
- [ ] تست دستی اسکریپت‌ها موفق بود
- [ ] Cron jobs اضافه شدند (`sudo crontab -e`)
- [ ] تأیید cron jobs (`sudo crontab -l`)
- [ ] لاگ‌ها قابل نوشتن هستند (`/var/log/titangold-backup-rotation.log`)
- [ ] Health check اولیه موفق بود
- [ ] سیاست offsite backup تعریف شد (3-2-1 rule)

---

## 📞 پشتیبانی

اگر مشکلی پیش آمد:

1. لاگ‌ها را بررسی کنید: `/var/log/titangold-backup-rotation.log`
2. Syslog را چک کنید: `sudo grep titangold-backup /var/log/syslog`
3. اسکریپت را با debug mode اجرا کنید: `sudo bash -x /usr/local/bin/titangold-backup-rotation.sh`

---

**نکته**: این سیستم کاملاً خودکار است و بعد از نصب نیازی به مداخله دستی ندارد. فقط هر چند وقت یکبار لاگ‌ها را بررسی کنید تا از سلامت بک‌آپ‌ها مطمئن شوید.
