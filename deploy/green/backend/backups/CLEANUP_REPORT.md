# Agent Cleanup Documentation

## تاریخ: 2026-02-01

## مشکل شناسایی شده

در پروژه TitanGold، به اشتباه **دو مجموعه از 15 agent** ایجاد شده بود:

### ✅ Agents واقعی (نگهداری شدند)
این 15 agent به سیستم متصل هستند و در production استفاده می‌شوند:

1. Technical Analysis Agent (`technical`)
2. Risk Management Agent (`risk`)
3. Sentiment Analysis Agent (`sentiment`)
4. Pattern Recognition Agent (`pattern`)
5. Price Prediction Agent (`price_prediction`)
6. Arbitrage Agent (`arbitrage`)
7. Portfolio Allocation Agent (`portfolio`)
8. Liquidity Agent (`liquidity`)
9. Trend Agent (`trend`)
10. Optimization Agent (`optimization`)
11. Order Management Agent (`order`)
12. Fundamental Agent (`fundamental`)
13. Market Intelligence Agent (`market_intelligence`)
14. Volume Agent (`volume`)
15. Timing Agent (`timing`)

**مشخصات:**
- ✅ دارای `agent_key` یکتا
- ✅ Backend service file دارند (`backend/services/agents/*.js`)
- ✅ Frontend control component دارند (`components/ai/*AgentControl.tsx`)
- ✅ در `agentRegistry.ts` ثبت شده‌اند

**منبع:** `seed_real_agents_v3.js`

---

### ❌ Agents الکی (حذف شدند)
این 15 agent به هیچ جای سیستم متصل نبودند:

1. Technical Analysis Agent (type: `technical` - بدون agent_key)
2. Sentiment Analysis Agent (type: `sentiment` - بدون agent_key)
3. Risk Management Agent (type: `risk` - بدون agent_key)
4. Volume Profile Agent (type: `volume` - اسم اشتباه)
5. **News Analysis Agent** (type: `news` - service وجود ندارد)
6. **On-Chain Metrics Agent** (type: `onchain` - service وجود ندارد)
7. **Correlation Analysis Agent** (type: `correlation` - service وجود ندارد)
8. Portfolio Allocation Agent (type: `portfolio` - تکراری)
9. **Position Sizing Agent** (type: `position` - service وجود ندارد)
10. **Scalping Agent** (type: `scalping` - service وجود ندارد)
11. **Swing Trading Agent** (type: `swing` - service وجود ندارد)
12. Arbitrage Agent (type: `arbitrage` - تکراری)
13. **Market Regime Agent** (type: `regime` - service وجود ندارد)
14. **Whale Tracker Agent** (type: `whale` - service وجود ندارد)
15. **Execution Agent** (type: `execution` - service وجود ندارد)

**مشکلات:**
- ❌ بدون `agent_key` یا agent_key نامعتبر
- ❌ Backend service ندارند
- ❌ Frontend control component ندارند
- ❌ در `agentRegistry.ts` ثبت نشده‌اند

**منبع:** `seed_ai_agents.js` (حذف شد)

---

## عملیات انجام شده

### 1. ایجاد Backup
تمام seed scripts قبل از حذف backup شدند در:
```
backend/backups/
├── seed_ai_agents.js.backup_20260201_135122
├── seed_real_agents.js.backup_20260201_135122
└── seed_real_agents_v2.js.backup_20260201_135122
```

### 2. پاکسازی Database
Script `cleanup_fake_agents.js` ایجاد شد برای حذف agents الکی از database.

**نتیجه:** Database از قبل تمیز بود - فقط 15 agent واقعی در آن وجود داشت.

### 3. حذف Seed Scripts الکی
فایل‌های زیر حذف شدند:
- ❌ `seed_ai_agents.js` (agents بدون agent_key)
- ❌ `seed_real_agents.js` (نسخه قدیمی بدون agent_key)
- ❌ `seed_real_agents_v2.js` (نسخه قدیمی بدون agent_key)

فقط این فایل نگهداری شد:
- ✅ `seed_real_agents_v3.js` (تنها نسخه صحیح با agent_key)

---

## تأیید صحت

### Backend Layer
```bash
# تعداد agent service files
ls backend/services/agents/*.js | grep -v registry | grep -v _template | wc -l
# نتیجه: 15
```

### Frontend Layer
```bash
# تعداد agent control components
ls components/ai/*AgentControl.tsx | wc -l
# نتیجه: 15
```

### Registry Mapping
```bash
# تعداد entries در agentRegistry
grep "key: AGENT_KEYS" components/ai/agentRegistry.ts | wc -l
# نتیجه: 15
```

### Database
```sql
SELECT COUNT(*) FROM ai_agents WHERE agent_key IS NOT NULL;
-- نتیجه: 15
```

---

## Scripts مفید

### اجرای Cleanup Script
```bash
cd backend
node scripts/cleanup_fake_agents.js
```

### اجرای Real Agents Seed
```bash
cd backend
node scripts/seed_real_agents_v3.js
```

### بازیابی از Backup (در صورت نیاز)
```bash
cd backend
cp backups/seed_ai_agents.js.backup_20260201_135122 scripts/seed_ai_agents.js
```

---

## نتیجه

✅ **مشکل با موفقیت حل شد:**
- Database تمیز است (15 agent واقعی)
- Seed scripts تمیز شدند (فقط v3 باقی ماند)
- Backups برای امنیت نگهداری شدند
- مستندات کامل ایجاد شد

✅ **هیچ مشکلی برای سیستم ایجاد نشد:**
- تمام agent های واقعی کار می‌کنند
- Backend services سالم هستند
- Frontend controls سالم هستند
- Database integrity حفظ شد

---

## بررسی توسط
- تاریخ: 2026-02-01
- نتیجه: موفق ✅
