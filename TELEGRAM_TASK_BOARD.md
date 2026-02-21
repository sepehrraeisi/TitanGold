 # ✅ Telegram Project – Task Board

 **Project**: TitanGold Telegram Integration  
 **Source docs**:  
 - `TELEGRAM_PROJECT_INDEX.md`  
 - `TELEGRAM_ROADMAP_COMPLETE.md`  
 - `TELEGRAM_IMPLEMENTATION_GUIDE_COMPLETE.md`  
 - `TELEGRAM_IMPLEMENTATION_GUIDE_PART2.md`  
 - `TELEGRAM_IMPLEMENTATION_GUIDE_PART3.md`  
 - `DESIGN_SYSTEM_DATAHUB.md`

 این فایل «مرجع تسک‌ها» است؛ هر تسک اینجا یک مرجع دقیق به داک اصلی دارد تا گم نشود.

 ---

 ## A) Option A – UI TelegramDataPanel  (`tele-option-a-ui`)

 ### A.1 – CategoryBreakdown (تب Categories)

 **مرجع اصلی**:
 - `TELEGRAM_PROJECT_INDEX.md` → بخش *Option A / Task A.1* (لینک‌ها و چک‌لیست)
 - `TELEGRAM_IMPLEMENTATION_GUIDE_COMPLETE.md` → بخش *Task A.1: CategoryBreakdown Component* (کد کامل)
 - `DESIGN_SYSTEM_DATAHUB.md` → استایل کارت‌ها، دکمه‌ها، گرید متریک، تایپوگرافی

**زیرتسک‌ها**:
- [x] A1.1 – نصب UI deps:
   - `recharts`, `date-fns`  
   - Doc: `TELEGRAM_IMPLEMENTATION_GUIDE_COMPLETE.md` خطوط 139–144
- [x] A1.2 – ایجاد کامپوننت:
   - فایل: `components/ai/AIManager/tabs/DataHub/CategoryBreakdown.tsx`  
   - Doc: همان، خطوط 148–587
- [x] A1.3 – اینتگریت در TelegramDataPanel:
   - فایل: `components/ai/AIManager/tabs/DataHub/TelegramDataPanel.tsx`  
   - Doc: همان، خطوط 589–599
 - [ ] A1.4 – هماهنگی کامل با Design System:
   - رنگ‌ها، کارت‌ها، دکمه‌ها، گرید، تایپوگرافی  
   - Doc: `DESIGN_SYSTEM_DATAHUB.md` (بخش‌های ۲ تا ۱۰)
 - [ ] A1.5 – تست و تأیید:
   - سوییچ pie/bar/area  
   - time range (24h/2d/7d/30d)  
   - drill-down و timeline  
   - ریسپانسیو  
   - Doc: `TELEGRAM_PROJECT_INDEX.md` خطوط 216–225

 ---

 ### A.2 – BreakingNewsMonitor (تب Breaking News)

 **مرجع اصلی**:
 - `TELEGRAM_IMPLEMENTATION_GUIDE_COMPLETE.md` → *Task A.2: BreakingNewsMonitor Component*  
 - `TELEGRAM_PROJECT_INDEX.md` → *Task A.2 checklist*  
 - `DESIGN_SYSTEM_DATAHUB.md` → استایل لیست، بنر هشدار، دکمه‌ها

**زیرتسک‌ها**:
- [x] A2.1 – ایجاد فایل کامپوننت:
   - `components/ai/AIManager/tabs/DataHub/BreakingNewsMonitor.tsx`  
   - Doc: IMPLEMENTATION_PART1 خطوط 610–1114
 - [ ] A2.2 – فایل صدا:
   - `public/sounds/alert.mp3`  
   - Doc: همان، خطوط 1129–1137
- [x] A2.3 – اینتگریت در TelegramDataPanel:
   - تب `breaking`  
   - Doc: خطوط 1118–1126
 - [ ] A2.4 – هماهنگی دیزاین:
   - کارت‌های خبر، بنر قرمز، badgeها، دکمه‌ها طبق Design System
 - [ ] A2.5 – تست:
   - auto-refresh، فیلتر severity/category، نوتیفیکیشن، dismiss  
   - Doc: PROJECT_INDEX خطوط 229–241

 ---

 ### A.3 – GeographicHeatMap (تب نقشه جهانی)

 **مرجع اصلی**:
 - `TELEGRAM_IMPLEMENTATION_GUIDE_PART2.md` → *Task A.3: GeographicHeatMap*  
 - `TELEGRAM_PROJECT_INDEX.md` → *Task A.3 checklist*

**زیرتسک‌ها**:
- [x] A3.1 – نصب deps:
   - `react-simple-maps`, `react-tooltip`, `d3-geo`, `d3-scale`  
   - Doc: PART2 خطوط 11–16
- [x] A3.2 – ایجاد فایل:
   - `components/ai/AIManager/tabs/DataHub/GeographicHeatMap.tsx`  
   - Doc: PART2 خطوط 20–447
- [x] A3.3 – اینتگریت در TelegramDataPanel:
   - تب `geographic`  
   - Doc: PART2 خطوط 451–468
 - [ ] A3.4 – هماهنگی دیزاین:
   - کارت آمار بالا، container نقشه، جدول region list
 - [ ] A3.5 – تست:
   - رندر نقشه، مارکر، رنگ، انتخاب region، جدول  
   - Doc: PROJECT_INDEX خطوط 243–253

 ---

### A.4 – AgentDetailPanel (نمای جزئیات هر Agent)

**مرجع اصلی**:
- `TELEGRAM_IMPLEMENTATION_GUIDE_PART2.md` → *Task A.4: AgentDetailPanel*  
- `TELEGRAM_PROJECT_INDEX.md` → *Task A.4 checklist*

**زیرتسک‌ها**:
- [x] A4.1 – ایجاد فایل:
  - `components/ai/AIManager/tabs/DataHub/AgentDetailPanel.tsx`  
  - Doc: PART2 خطوط 475–927
- [x] A4.2 – اینتگریت انتخاب Agent:
  - state `selectedAgent` در `TelegramDataPanel.tsx`  
  - Doc: PART2 خطوط 931–959
- [ ] A4.3 – هماهنگی دیزاین:
  - کارت متریک‌ها، لیست پیام‌ها، badgeها و دکمه‌ها
- [ ] A4.4 – تست:
  - لود feed، فیلتر، pagination، Mark Processed، اکشن‌ها  
  - Doc: PROJECT_INDEX خطوط 256–266

> **یادداشت نام‌گذاری:**  
> تب 🤖 در `TelegramDataPanel.tsx` عمداً با نام **"Telegram AI Inbox (15 Agents)"** نام‌گذاری شده است تا با منوی اصلی `Agents` در TITAN AI Management System اشتباه نشود.  
> این تب فقط **Inbox و صف پیام‌های تلگرام برای همان ۱۵ Agent موجود** است (چیدمان و آماده‌سازی خبرها)، و نباید به‌عنوان سیستم Agent جدید/موازی پیاده‌سازی شود.

 ---

 ## B) Option B – Advanced AI  (`tele-option-b-ai`)

 ### B.1 – ML Sentiment Model
 - [ ] ساخت/تنظیم `backend/ai/sentimentModel.js`  
 - [ ] روتر `backend/routes/ai-ml.js` + mount در `/api/v1/ai/ml`  
 - [ ] اتصال به processor و تست API  
 - **Docs**: IMPLEMENTATION_PART3 بخش *Task B.1* + PROJECT_INDEX بخش B.1

 ### B.2 – Pattern Recognition & Anomalies
 - [ ] `backend/ai/patternRecognition.js`  
 - [ ] Endpointهای `/ai/ml/patterns`, `/ai/ml/anomalies`, `/ai/ml/insights`  
 - [ ] تست کوئری‌ها روی دیتای فعلی  
 - **Docs**: IMPLEMENTATION_PART3 بخش *Task B.2*

 ### B.3 – Signal Generator
 - [ ] `backend/ai/signalGenerator.js`  
 - [ ] `backend/routes/trading-signals.js` + مایگریشن `add_trading_signals_table.sql`  
 - [ ] تست تولید سیگنال و فیلتر کردن active signals  
 - **Docs**: IMPLEMENTATION_PART3 بخش *Task B.3*

 ---

 ## C) Option C – Trading Integration  (`tele-option-c-trading`)

 ### C.1 – Agent Feed Service
 - [ ] `backend/services/agentFeedService.js`  
 - [ ] مایگریشن `add_agent_integration_tables.sql`  
 - [ ] پیکربندی registry ۱۵ agent و تست broadcast/decisions  
 - **Docs**: IMPLEMENTATION_PART3 *Task C.1*

 ### C.2 – Signal Processor Worker
 - [ ] `backend/services/signalProcessor.js`  
 - [ ] `backend/workers/signalProcessorWorker.js`  
 - [ ] افزودن app `signal-processor` به `ecosystem.config.js` و PM2  
 - **Docs**: IMPLEMENTATION_PART3 *Task C.2*

 ### C.3 – Trading Engine Integration
 - [ ] به‌روزرسانی `backend/services/tradingEngine.js` برای استفاده از signals  
 - [ ] تست end-to-end (بدون اجرای واقعی معامله در اول)  
 - **Docs**: IMPLEMENTATION_PART3 *Task C.3*

 ---

 ## D) Telegram ↔ DataHub Bridge  (`tele-bridge-datahub`)

 - [ ] `backend/services/telegramDataHubBridge.js`  
 - [ ] `backend/services/correlationService.js`  
 - [ ] مایگریشن‌های لازم برای `collected_data` / correlation  
 - [ ] تست: یک processed_telegram_message → یک `collected_data` + category + correlation  
 - **Docs**: `TELEGRAM_ROADMAP_COMPLETE.md` بخش *Data Routing to Other DataHub Sources*

 ---

 ## E) Infrastructure, Monitoring, Design  (`tele-health-monitoring-hardening`, `tele-ui-design-consistency`, `tele-docs-sync`)

 ### E.1 – Health & Monitoring
 - [ ] اسکریپت health-check بعد از deploy (`scripts/check-telegram-health.sh`)  
 - [ ] اتصال به cron یا PM2 monitor  
 - [ ] قانون «عدم ویرایش dist» در README/راهنمای مشارکت  

 ### E.2 – Design Harmony با DataHub
 - [ ] مرور تب‌های مربوط به Telegram در Data Hub (Categories, Breaking, Map, AgentDetail)  
 - [ ] تطبیق با `DESIGN_SYSTEM_DATAHUB.md` (بخش‌های ۲–۱۵)  

 ### E.3 – همگام‌سازی مستندات
 - [ ] بعد از اتمام Option A: آپدیت ROADMAP + PROJECT_INDEX (درصد UI)  
 - [ ] بعد از Option B/C: آپدیت status و نکات عملی در IMPLEMENTATION_GUIDEها  

GUIDEها  
