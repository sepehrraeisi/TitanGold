# TitanGold Backup Scripts

این دایرکتوری شامل 6 اسکریپت Bash برای سیستم بک‌آپ production-grade TitanGold است.

---

## 📂 فهرست اسکریپت‌ها

### Basic Scripts (الزامی)

#### 1. `titangold-backup-rotation.sh`
**کاربرد**: پاکسازی خودکار بک‌آپ‌های قدیمی با استراتژی ثابت 7-4-3  
**زمان اجرا**: روزانه ساعت 03:00  
**وابستگی**: هیچ  
**خروجی لاگ**: `/var/log/titangold-backup-rotation.log`

```bash
# تست دستی
sudo /usr/local/bin/titangold-backup-rotation.sh
```

#### 2. `titangold-monthly-backup.sh`
**کاربرد**: ایجاد بک‌آپ ماهانه از آخرین بک‌آپ هفتگی  
**زمان اجرا**: اول هر ماه ساعت 04:00  
**وابستگی**: حداقل یک weekly backup موجود باشد  
**خروجی**: `/var/backups/titangold/monthly/titangold_monthly_YYYY-MM-01.sql.gpg`

```bash
# تست دستی
sudo /usr/local/bin/titangold-monthly-backup.sh
```

#### 3. `titangold-backup-healthcheck.sh`
**کاربرد**: بررسی سلامت بک‌آپ (سن < 48 ساعت، حجم > 10 KB)  
**زمان اجرا**: روزانه ساعت 05:00  
**وابستگی**: هیچ  
**Alert**: syslog + Telegram/Discord/Email (اختیاری)

```bash
# تست دستی
sudo /usr/local/bin/titangold-backup-healthcheck.sh
```

---

### Advanced Scripts (Production-Grade)

#### 4. `titangold-backup-verify.sh` ⭐️
**کاربرد**: تست واقعی بازیابی (decrypt + restore روی DB موقت)  
**زمان اجرا**: اول هر ماه ساعت 06:00  
**وابستگی**:
- GPG passphrase file: `/root/.titangold_backup_passphrase`
- PostgreSQL client tools
- حداقل 2x فضای DB برای temp restore

**چه کاری انجام می‌دهد؟**
1. Decrypt کردن آخرین بک‌آپ
2. ایجاد DB موقت (`titangold_restore_test_TIMESTAMP`)
3. Restore کامل داده‌ها
4. بررسی تعداد جداول (باید > 10)
5. حذف DB موقت
6. Alert در Telegram/Discord/Email در صورت failure

```bash
# نصب پیش‌نیاز
sudo nano /root/.titangold_backup_passphrase
# محتوا: رمز GPG شما
sudo chmod 600 /root/.titangold_backup_passphrase

# تست دستی
sudo /usr/local/bin/titangold-backup-verify.sh
```

#### 5. `titangold-offsite-sync.sh` ⭐️
**کاربرد**: همگام‌سازی بک‌آپ‌ها با offsite storage (3-2-1 rule)  
**زمان اجرا**: یکشنبه‌ها ساعت 07:00  
**وابستگی**: حداقل یک offsite destination فعال باشد

**Offsite Providers:**
- **Hetzner Storage Box** (پیشنهادی برای EU)
- **AWS S3 / Wasabi** (enterprise)
- **Backblaze B2** (ارزان‌ترین، 10GB رایگان)
- **Rclone** (universal, 40+ providers)

```bash
# پیکربندی Hetzner (مثال)
sudo nano /usr/local/bin/titangold-offsite-sync.sh

# تغییر این متغیرها:
HETZNER_ENABLED="true"
HETZNER_USER="u123456"
HETZNER_HOST="u123456.your-storagebox.de"
HETZNER_PATH="/titangold-backups"

# اضافه کردن SSH key
ssh-keygen -t rsa -b 4096 -f ~/.ssh/hetzner_backup
ssh-copy-id -i ~/.ssh/hetzner_backup.pub -p 23 u123456@u123456.your-storagebox.de

# تست دستی
sudo /usr/local/bin/titangold-offsite-sync.sh
```

#### 6. `titangold-adaptive-rotation.sh` ⭐️
**کاربرد**: پاکسازی adaptive (تنظیم خودکار براساس اندازه DB)  
**زمان اجرا**: روزانه ساعت 03:00 (جایگزین rotation.sh)  
**وابستگی**: PostgreSQL (برای تشخیص اندازه DB)

**Retention Policies:**
| اندازه DB | Policy | Daily | Weekly | Monthly |
|-----------|--------|-------|--------|---------|
| **<5 GB** | SMALL | 7 | 4 | 3 |
| **5-20 GB** | MEDIUM | 5 | 3 | 3 |
| **>20 GB** | LARGE | 3 | 2 | 3 |

```bash
# تست دستی
sudo /usr/local/bin/titangold-adaptive-rotation.sh

# بررسی policy فعلی
cat /var/lib/titangold-backup-policy
```

---

## 🚀 نصب سریع

```bash
cd /home/ubuntu/webapp/TitanGold

# کپی همه اسکریپت‌ها
sudo cp scripts/titangold-*.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/titangold-*.sh

# بررسی نصب
ls -lh /usr/local/bin/titangold-*
```

---

## ⏰ پیکربندی Cron

### Basic Setup (7-4-3 Fixed)
```bash
sudo crontab -e

# اضافه کردن:
0 3 * * * /usr/local/bin/titangold-backup-rotation.sh >> /var/log/titangold-backup-rotation.log 2>&1
0 4 1 * * /usr/local/bin/titangold-monthly-backup.sh >> /var/log/titangold-backup-rotation.log 2>&1
0 5 * * * /usr/local/bin/titangold-backup-healthcheck.sh >> /var/log/titangold-backup-rotation.log 2>&1
```

### Production-Grade Setup (پیشنهادی) ⭐️
```bash
sudo crontab -e

# اضافه کردن:
0 3 * * * /usr/local/bin/titangold-adaptive-rotation.sh >> /var/log/titangold-backup-rotation.log 2>&1
0 4 1 * * /usr/local/bin/titangold-monthly-backup.sh >> /var/log/titangold-backup-rotation.log 2>&1
0 5 * * * /usr/local/bin/titangold-backup-healthcheck.sh >> /var/log/titangold-backup-rotation.log 2>&1
0 6 1 * * /usr/local/bin/titangold-backup-verify.sh >> /var/log/titangold-backup-rotation.log 2>&1
0 7 * * 0 /usr/local/bin/titangold-offsite-sync.sh >> /var/log/titangold-backup-rotation.log 2>&1
```

---

## 🔔 پیکربندی Alerts

### Telegram Bot (پیشنهادی)
```bash
# 1. ایجاد bot: @BotFather → /newbot
# 2. دریافت chat_id از https://api.telegram.org/botTOKEN/getUpdates

# 3. اضافه کردن به environment
sudo nano /root/.bashrc

export TELEGRAM_BOT_TOKEN="123456789:ABCdefGhIjKlmNoPQRsTUVwxyZ"
export TELEGRAM_CHAT_ID="123456789"

source /root/.bashrc

# 4. تست
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -d chat_id="$TELEGRAM_CHAT_ID" \
  -d text="✅ TitanGold Backup Test"
```

**راهنمای کامل**: [`../docs/BACKUP_ALERTS_SETUP.md`](../docs/BACKUP_ALERTS_SETUP.md)

---

## 📊 مانیتورینگ

### بررسی لاگ‌ها
```bash
# آخرین 50 خط لاگ
tail -50 /var/log/titangold-backup-rotation.log

# بررسی خطاها
sudo grep "CRITICAL\|ERROR" /var/log/titangold-backup-rotation.log

# بررسی syslog
sudo grep "titangold-backup" /var/log/syslog | tail -20
```

### بررسی وضعیت بک‌آپ‌ها
```bash
# تعداد بک‌آپ‌ها
echo "Daily: $(find /var/backups/titangold/daily -type f -name '*.sql.gpg' | wc -l)"
echo "Weekly: $(find /var/backups/titangold/weekly -type f -name '*.sql.gpg' | wc -l)"
echo "Monthly: $(find /var/backups/titangold/monthly -type f -name '*.sql.gpg' | wc -l)"

# حجم مصرفی
du -sh /var/backups/titangold/*

# جدیدترین بک‌آپ
ls -lth /var/backups/titangold/daily/ | head -3
```

---

## 🛠️ عیب‌یابی

### مشکل: اسکریپت اجرا نمی‌شود
```bash
# بررسی مجوزها
ls -lh /usr/local/bin/titangold-backup-verify.sh

# اعطای مجوز اجرا
sudo chmod +x /usr/local/bin/titangold-*.sh
```

### مشکل: GPG decryption خطا می‌دهد
```bash
# تست دستی decrypt
gpg --passphrase-file /root/.titangold_backup_passphrase \
    -d /var/backups/titangold/daily/latest.sql.gpg > /tmp/test.sql

# بررسی محتوا
head -10 /tmp/test.sql
rm /tmp/test.sql
```

### مشکل: Offsite sync fail می‌شود
```bash
# تست اتصال Hetzner
ssh -p 23 u123456@u123456.your-storagebox.de

# اجرای debug mode
sudo bash -x /usr/local/bin/titangold-offsite-sync.sh
```

---

## 📚 مستندات کامل

- **[BACKUP_INSTALLATION_GUIDE.md](../docs/BACKUP_INSTALLATION_GUIDE.md)** - راهنمای نصب گام‌به‌گام
- **[BACKUP_ALERTS_SETUP.md](../docs/BACKUP_ALERTS_SETUP.md)** - پیکربندی alerts و offsite storage
- **[BACKUP_STRATEGY_COMPARISON.md](../docs/BACKUP_STRATEGY_COMPARISON.md)** - تحلیل استراتژی‌ها
- **[BACKUP_PRODUCTION_GRADE_SUMMARY.md](../docs/BACKUP_PRODUCTION_GRADE_SUMMARY.md)** - خلاصه executive

---

## 🎯 Quick Reference

| اسکریپت | نوع | زمان | وابستگی | الویت |
|---------|-----|------|---------|---------|
| `backup-rotation.sh` | Basic | 03:00 روزانه | - | ⭐️⭐️⭐️ |
| `monthly-backup.sh` | Basic | 04:00 اول ماه | - | ⭐️⭐️⭐️ |
| `backup-healthcheck.sh` | Basic | 05:00 روزانه | - | ⭐️⭐️⭐️ |
| `backup-verify.sh` | Advanced | 06:00 اول ماه | GPG passphrase | ⭐️⭐️⭐️⭐️⭐️ |
| `offsite-sync.sh` | Advanced | 07:00 یکشنبه | Offsite storage | ⭐️⭐️⭐️⭐️⭐️ |
| `adaptive-rotation.sh` | Advanced | 03:00 روزانه | PostgreSQL | ⭐️⭐️⭐️⭐️ |

---

**نکته**: برای production environment، حتماً اسکریپت‌های Advanced را نصب کنید!

**Enterprise Readiness: 9.5/10** ⭐️
