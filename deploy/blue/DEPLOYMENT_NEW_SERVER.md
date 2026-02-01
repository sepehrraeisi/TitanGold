# 🚀 راهنمای Deploy در سرور جدید - پروژه TitanGold

این راهنما نشان می‌دهد چگونه می‌توانید پروژه TitanGold را روی یک سرور کاملاً جدید deploy کنید.

---

## 📋 پیش‌نیازها

### 1. سیستم عامل
- Ubuntu 20.04 LTS یا بالاتر
- یا هر Linux distribution با systemd

### 2. نرم‌افزارهای مورد نیاز
- Node.js 18+ و npm
- PostgreSQL 14+
- Git
- PM2 (برای process management)

---

## 🔧 مراحل نصب قدم‌به‌قدم

### مرحله 1: نصب Node.js و npm

```bash
# آپدیت system packages
sudo apt update && sudo apt upgrade -y

# نصب Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# تایید نصب
node --version  # باید 18.x یا بالاتر باشد
npm --version
```

---

### مرحله 2: نصب PostgreSQL

```bash
# نصب PostgreSQL 14
sudo apt install -y postgresql-14 postgresql-contrib-14

# استارت سرویس
sudo systemctl start postgresql
sudo systemctl enable postgresql

# تایید نصب
sudo -u postgres psql --version
```

---

### مرحله 3: ایجاد Database و User

```bash
# ورود به PostgreSQL
sudo -u postgres psql

# در محیط PostgreSQL:
-- ایجاد user جدید
CREATE USER titangold_user WITH PASSWORD 'your_secure_password_here';

-- ایجاد database
CREATE DATABASE titangold_db OWNER titangold_user;

-- دادن تمام دسترسی‌ها
GRANT ALL PRIVILEGES ON DATABASE titangold_db TO titangold_user;

-- خروج
\q
```

---

### مرحله 4: Clone کردن پروژه از GitHub

```bash
# ایجاد دایرکتوری کاری
mkdir -p /home/$(whoami)/webapp
cd /home/$(whoami)/webapp

# Clone از GitHub
git clone https://github.com/sepehrraeisi/TitanGold.git
cd TitanGold
```

---

### مرحله 5: نصب Dependencies

#### 5.1 Frontend Dependencies
```bash
cd /home/$(whoami)/webapp/TitanGold
npm install
```

#### 5.2 Backend Dependencies
```bash
cd /home/$(whoami)/webapp/TitanGold/backend
npm install
```

---

### مرحله 6: تنظیم Environment Variables

#### 6.1 Backend Environment
```bash
cd /home/$(whoami)/webapp/TitanGold/backend

# ایجاد فایل .env
cat > .env << 'EOF'
# Database Configuration
DB_USER=titangold_user
DB_PASSWORD=your_secure_password_here
DB_HOST=localhost
DB_PORT=5432
DB_NAME=titangold_db

# Server Configuration
PORT=5002
NODE_ENV=production

# JWT Secret (یک string تصادفی و امن)
JWT_SECRET=your_super_secret_jwt_key_here_change_this_in_production

# CORS Origin (آدرس frontend)
CORS_ORIGIN=http://localhost:3000,http://your-domain.com

# Session Secret
SESSION_SECRET=your_session_secret_here_change_this

# Optional: برای production
# SSL_MODE=require
# LOG_LEVEL=info
EOF

# تنظیم permissions برای امنیت
chmod 600 .env
```

**⚠️ مهم:** مقادیر زیر را حتماً تغییر دهید:
- `DB_PASSWORD`: پسورد دیتابیس خود
- `JWT_SECRET`: یک کلید امن و تصادفی
- `SESSION_SECRET`: یک کلید امن دیگر
- `CORS_ORIGIN`: آدرس frontend خود

#### 6.2 Frontend Environment (اختیاری)
```bash
cd /home/$(whoami)/webapp/TitanGold

# اگر نیاز به تنظیم API endpoint داشتید:
cat > .env.local << 'EOF'
VITE_API_URL=http://localhost:5002/api
# یا برای production:
# VITE_API_URL=https://api.your-domain.com/api
EOF
```

---

### مرحله 7: اجرای Database Migrations

```bash
cd /home/$(whoami)/webapp/TitanGold/backend

# اجرای schema SQL
PGPASSWORD='your_secure_password_here' psql \
  -h localhost \
  -p 5432 \
  -U titangold_user \
  -d titangold_db \
  -f database/schema.sql

# بررسی جداول ایجاد شده
PGPASSWORD='your_secure_password_here' psql \
  -h localhost \
  -U titangold_user \
  -d titangold_db \
  -c "\dt"
```

شما باید 25 جدول ببینید:
- users
- user_roles
- portfolios
- trades
- assets
- system_settings
- ... و 19 جدول دیگر

---

### مرحله 8: Seed کردن داده‌های اولیه (اختیاری)

```bash
cd /home/ubuntu/webapp/TitanGold/backend

# اگر فایل seed وجود داشت:
PGPASSWORD='your_password' psql -h localhost -U titangold_user -d titangold_db -f database/seeds.sql

# یا به‌صورت دستی کاربر admin ایجاد کنید:
PGPASSWORD='your_password' psql -h localhost -U titangold_user -d titangold_db << 'EOF'
-- ایجاد کاربر admin
INSERT INTO users (username, email, password_hash, full_name, role, active)
VALUES (
  'admin',
  'admin@titangold.com',
  '$2b$10$xk8YB7P.XZ7F5/rCqNc8/.x9gYmZGvNJKQZqHLk4KZoHPX4Y5oQ2S', -- Admin123!
  'System Administrator',
  'admin',
  true
);

-- تنظیمات سیستم
INSERT INTO system_settings (key, value, description)
VALUES
  ('public_registration', 'true', 'Allow users to create accounts from login page'),
  ('maintenance_mode', 'false', 'System maintenance mode'),
  ('max_trades_per_day', '100', 'Maximum trades per user per day'),
  ('default_trading_fee', '0.001', 'Default trading fee percentage');
EOF
```

**نکته:** پسورد hash شده برای `Admin123!` است.

---

### مرحله 9: تست Backend

```bash
cd /home/$(whoami)/webapp/TitanGold/backend

# استارت موقت برای تست
node server.js

# در terminal دیگر:
curl http://localhost:5002/health

# خروجی باید باشد:
# {"status":"ok","database":"connected","timestamp":"..."}
```

اگر خطا دیدید:
- بررسی کنید که PostgreSQL در حال اجرا است: `sudo systemctl status postgresql`
- بررسی کنید که credentials در `.env` درست است
- بررسی کنید که database و user ایجاد شده‌اند

---

### مرحله 10: نصب PM2 برای Process Management

```bash
# نصب PM2 به‌صورت global
sudo npm install -g pm2

# استارت Backend با PM2
cd /home/$(whoami)/webapp/TitanGold/backend
pm2 start server.js --name "titangold-backend"

# بررسی وضعیت
pm2 status

# ذخیره تنظیمات PM2 برای استارت خودکار
pm2 save
pm2 startup
# دستور sudo که نمایش داده می‌شود را اجرا کنید
```

---

### مرحله 11: استارت Frontend

#### روش 1: Development Mode (برای تست)
```bash
cd /home/$(whoami)/webapp/TitanGold
npm run dev
```

#### روش 2: Production Build (پیشنهادی)
```bash
cd /home/$(whoami)/webapp/TitanGold

# Build کردن برای production
npm run build

# سرو کردن با یک static server
npm install -g serve
serve -s dist -l 3000

# یا با PM2:
pm2 serve dist 3000 --name "titangold-frontend" --spa
```

---

### مرحله 12: تنظیم Firewall

```bash
# اجازه دسترسی به پورت‌های مورد نیاز
sudo ufw allow 3000/tcp  # Frontend
sudo ufw allow 5002/tcp  # Backend API
sudo ufw allow 22/tcp    # SSH

# فعال کردن firewall
sudo ufw enable

# بررسی وضعیت
sudo ufw status
```

---

### مرحله 13: تنظیم Nginx (اختیاری - برای Production)

```bash
# نصب Nginx
sudo apt install -y nginx

# ایجاد config برای TitanGold
sudo nano /etc/nginx/sites-available/titangold

# محتوای config:
```

```nginx
# Frontend
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    root /home/your-user/webapp/TitanGold/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Proxy برای API
    location /api {
        proxy_pass http://localhost:5002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# Backend API (subdomain اختیاری)
server {
    listen 80;
    server_name api.your-domain.com;
    
    location / {
        proxy_pass http://localhost:5002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# فعال کردن سایت
sudo ln -s /etc/nginx/sites-available/titangold /etc/nginx/sites-enabled/

# تست config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

### مرحله 14: نصب SSL با Let's Encrypt (پیشنهادی)

```bash
# نصب Certbot
sudo apt install -y certbot python3-certbot-nginx

# دریافت SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com -d api.your-domain.com

# تست auto-renewal
sudo certbot renew --dry-run
```

---

## ✅ بررسی نهایی

پس از اتمام، این URLها باید کار کنند:

### Local Access:
```bash
# Frontend
curl http://localhost:3000

# Backend Health
curl http://localhost:5002/health

# Backend API
curl http://localhost:5002/api/settings
```

### Production Access (با Nginx):
```bash
# Frontend
https://your-domain.com

# Backend API
https://your-domain.com/api/health
# یا
https://api.your-domain.com/health
```

---

## 🔐 تست Authentication

```bash
# ثبت‌نام کاربر جدید
curl -X POST http://localhost:5002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test123!",
    "fullName": "Test User"
  }'

# لاگین
curl -X POST http://localhost:5002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test123!"
  }'

# دریافت لیست کاربران (با token)
TOKEN="your_jwt_token_here"
curl -H "Authorization: Bearer $TOKEN" http://localhost:5002/api/users
```

---

## 📊 Management Commands

### PM2 Commands
```bash
# نمایش وضعیت
pm2 status

# نمایش لاگ‌ها
pm2 logs titangold-backend
pm2 logs titangold-frontend

# Restart سرویس‌ها
pm2 restart titangold-backend
pm2 restart titangold-frontend

# Stop سرویس‌ها
pm2 stop titangold-backend
pm2 stop all

# حذف از PM2
pm2 delete titangold-backend
```

### Database Management
```bash
# ورود به database
PGPASSWORD='your_password' psql -h localhost -U titangold_user -d titangold_db

# Backup
pg_dump -h localhost -U titangold_user titangold_db > backup_$(date +%Y%m%d).sql

# Restore
psql -h localhost -U titangold_user titangold_db < backup_20231123.sql

# بررسی تعداد کاربران
PGPASSWORD='your_password' psql -h localhost -U titangold_user -d titangold_db -c "SELECT COUNT(*) FROM users;"
```

---

## 🐛 رفع مشکلات رایج

### مشکل 1: Backend شروع نمی‌شود
```bash
# بررسی لاگ‌ها
pm2 logs titangold-backend --lines 50

# مشکلات رایج:
# - Database connection: بررسی .env
# - Port in use: پورت 5002 را چک کنید
sudo lsof -i :5002
```

### مشکل 2: Database connection error
```bash
# بررسی PostgreSQL
sudo systemctl status postgresql

# تست اتصال
PGPASSWORD='your_password' psql -h localhost -U titangold_user -d titangold_db -c "SELECT 1;"

# بررسی pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf
# مطمئن شوید این خط وجود دارد:
# local   all             all                                     md5
```

### مشکل 3: CORS Error در Frontend
```bash
# بررسی CORS_ORIGIN در backend/.env
cd /home/$(whoami)/webapp/TitanGold/backend
cat .env | grep CORS_ORIGIN

# باید شامل آدرس frontend باشد:
# CORS_ORIGIN=http://localhost:3000,https://your-domain.com
```

### مشکل 4: JWT Token Error
```bash
# مطمئن شوید JWT_SECRET در .env تنظیم شده
cd /home/$(whoami)/webapp/TitanGold/backend
cat .env | grep JWT_SECRET

# اگر ندارید، اضافه کنید:
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env

# Restart backend
pm2 restart titangold-backend
```

---

## 🔒 نکات امنیتی برای Production

### 1. محافظت از Credentials
```bash
# Permissions برای .env
chmod 600 /home/$(whoami)/webapp/TitanGold/backend/.env

# اطمینان از .gitignore
echo ".env" >> .gitignore
echo "*.log" >> .gitignore
```

### 2. تغییر پسوردهای پیش‌فرض
- ✅ Database password را تغییر دهید
- ✅ JWT_SECRET را generate کنید
- ✅ SESSION_SECRET را generate کنید
- ✅ پسورد کاربر admin را تغییر دهید

### 3. Firewall
```bash
# فقط پورت‌های لازم را باز کنید
sudo ufw status numbered
```

### 4. SSL/HTTPS
- ✅ از Let's Encrypt استفاده کنید
- ✅ HTTP را به HTTPS redirect کنید

### 5. Rate Limiting
Backend از express-rate-limit استفاده می‌کند (قبلاً پیاده‌سازی شده)

---

## 📈 Monitoring و Logs

### Application Logs
```bash
# PM2 Logs
pm2 logs --lines 100

# Nginx Logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# PostgreSQL Logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Performance Monitoring
```bash
# PM2 Monitoring
pm2 monit

# System Resources
htop
```

---

## 🎯 Checklist نهایی

قبل از production:

- [ ] PostgreSQL نصب و راه‌اندازی شده
- [ ] Database و user ایجاد شده
- [ ] Schema اجرا شده (25 جدول)
- [ ] Seed data اضافه شده
- [ ] Backend `.env` تنظیم شده
- [ ] Backend با PM2 اجرا می‌شود
- [ ] Frontend build شده و سرو می‌شود
- [ ] Nginx نصب و تنظیم شده
- [ ] SSL certificate نصب شده
- [ ] Firewall تنظیم شده
- [ ] Credentials تغییر کرده‌اند
- [ ] Backup strategy آماده است
- [ ] Monitoring راه‌اندازی شده

---

## 📞 منابع و پشتیبانی

### Documentation در پروژه:
- `/backend/README.md` - Backend API docs
- `/DATABASE_COMPLETE.md` - Database schema
- `/USER_MANAGEMENT_API.md` - User management
- `/LOGIN_SYSTEM_COMPLETE.md` - Authentication system

### Test Credentials (پیش‌فرض):
- Username: `admin`
- Password: `Admin123!`

**⚠️ حتماً پسورد را تغییر دهید!**

---

## 🎉 تبریک!

پروژه TitanGold شما اکنون روی سرور جدید در حال اجرا است!

### چیزهایی که حالا دارید:
✅ PostgreSQL Database با 25 جدول  
✅ Backend API با 30+ endpoint  
✅ JWT Authentication System  
✅ Frontend با React + TypeScript  
✅ Production-ready deployment  
✅ SSL/HTTPS  
✅ Process management با PM2  
✅ Nginx reverse proxy  

**🚀 آماده استفاده در Production!**
