# راهنمای راه‌اندازی AI Center

## 📋 پیش‌نیازها

AI Center به صورت خودکار راه‌اندازی می‌شود و نیاز به تنظیمات خاصی ندارد. با این حال، برای استفاده کامل از قابلیت‌ها، مراحل زیر را دنبال کنید:

---

## 🚀 راه‌اندازی خودکار

### 1. Database Initialization

سیستم به صورت خودکار IndexedDB را initialize می‌کند. اگر IndexedDB در دسترس نباشد، از localStorage به عنوان fallback استفاده می‌شود.

**هیچ کاری لازم نیست!** سیستم خودش این کار را انجام می‌دهد.

---

## 📝 مراحل راه‌اندازی

### مرحله 1: باز کردن AI Center

1. به بخش **AI Center** در منوی اصلی بروید
2. سیستم به صورت خودکار:
   - Database را initialize می‌کند
   - داده‌های پیش‌فرض را ایجاد می‌کند
   - 15 Agent پیش‌فرض را ایجاد می‌کند
   - Artemis State را initialize می‌کند

### مرحله 2: تنظیم API Keys (اختیاری اما توصیه می‌شود)

برای استفاده از قابلیت‌های AI، باید API Keys را تنظیم کنید:

1. به تب **Config** بروید
2. در بخش **AI Services**:
   - **Google Gemini**: API Key را وارد کنید
   - **Anthropic Claude**: API Key را وارد کنید
   - **OpenAI GPT**: API Key را وارد کنید
   - **DeepSeek**: API Key را وارد کنید
3. روی دکمه **Test** کلیک کنید تا اتصال را تست کنید
4. روی دکمه **Save** کلیک کنید تا API Key ذخیره شود

**نکته**: API Keys در `localStorage` ذخیره می‌شوند (به صورت موقت برای تست)

### مرحله 3: ایجاد Data Sources (اختیاری)

برای استفاده از Data Hub:

1. به تب **Manager** → **Data Hub** بروید
2. روی **+ Add Source** کلیک کنید
3. نوع Source را انتخاب کنید (API, Webhook, RSS, Telegram, etc.)
4. اطلاعات Source را وارد کنید
5. روی **Save** کلیک کنید

### مرحله 4: ایجاد Trading Scenario (اختیاری)

1. به تب **Manager** → **Scenarios** بروید
2. روی **+ Create Scenario** کلیک کنید
3. یا روی **Generate AI Strategy** کلیک کنید تا Artemis یک استراتژی هوشمند ایجاد کند

---

## 🔧 تنظیمات پیش‌فرض

### Agents

- **15 Agent** به صورت خودکار ایجاد می‌شوند
- **12 Agent** به صورت پیش‌فرض Active هستند
- **2 Agent** در حالت Training هستند

### Artemis

- **Status**: Active
- **Mode**: Demo (می‌توانید به Real تغییر دهید)
- **Strategy**: Mixture of Experts
- **Active Learning**: Enabled

### Training

- **Auto Training**: Disabled (می‌توانید فعال کنید)
- **Max Concurrent Sessions**: 3
- **Max Queue Size**: 10

---

## ✅ بررسی راه‌اندازی

### چک‌لیست:

- [ ] AI Center باز می‌شود بدون خطا
- [ ] تب Manager نمایش داده می‌شود
- [ ] تب Agents نمایش داده می‌شود (15 Agent)
- [ ] تب Training نمایش داده می‌شود
- [ ] تب Analytics نمایش داده می‌شود
- [ ] تب Config نمایش داده می‌شود

### تست عملکرد:

1. **Manager Tab**:

   - [ ] Overview نمایش داده می‌شود
   - [ ] Decision Engine کار می‌کند
   - [ ] Scenarios قابل ایجاد هستند

2. **Agents Tab**:

   - [ ] تمام Agents نمایش داده می‌شوند
   - [ ] Control Panel هر Agent باز می‌شود

3. **Training Tab**:

   - [ ] Sessions نمایش داده می‌شوند
   - [ ] می‌توان Session جدید ایجاد کرد

4. **Analytics Tab**:

   - [ ] Metrics نمایش داده می‌شوند
   - [ ] Charts نمایش داده می‌شوند

5. **Config Tab**:
   - [ ] API Services نمایش داده می‌شوند
   - [ ] می‌توان API Key را ذخیره کرد

---

## 🐛 رفع مشکلات

### مشکل 1: داده‌ها نمایش داده نمی‌شوند

**راه حل**:

1. Console را باز کنید (F12)
2. بررسی کنید که آیا خطایی وجود دارد
3. Database را بررسی کنید:
   ```javascript
   // در Console مرورگر:
   indexedDB.databases().then((dbs) => console.log(dbs));
   ```

### مشکل 2: IndexedDB کار نمی‌کند

**راه حل**:

- سیستم به صورت خودکار از localStorage استفاده می‌کند
- هیچ کاری لازم نیست

### مشکل 3: API Keys ذخیره نمی‌شوند

**راه حل**:

1. بررسی کنید که localStorage در دسترس است
2. Console را بررسی کنید برای خطاها
3. API Key را دوباره وارد کنید

---

## 📊 ساختار Database

### Object Stores:

- **aiAgents**: تمام AI Agents
- **aiTrainingSessions**: Training Sessions
- **settings**:
  - `ai_overview`: Overview data
  - `artemis_state`: Artemis state
  - `ai_analytics`: Analytics data
  - `ai_api_config`: API configuration
  - `data_hub_state`: Data Hub state
  - `trading_scenarios`: Trading scenarios

---

## 🎯 استفاده از AI Center

### شروع کار:

1. **برای تست**: فقط AI Center را باز کنید - همه چیز کار می‌کند!
2. **برای استفاده واقعی**: API Keys را تنظیم کنید
3. **برای استفاده پیشرفته**: Data Sources و Scenarios ایجاد کنید

### نکات مهم:

- تمام داده‌ها در IndexedDB ذخیره می‌شوند
- API Keys در localStorage ذخیره می‌شوند (موقت)
- برای استفاده production، باید API Keys را در backend ذخیره کنید

---

## 🔐 امنیت

**هشدار**: در حال حاضر API Keys در localStorage ذخیره می‌شوند که برای production مناسب نیست.

**برای production**:

- API Keys باید در backend ذخیره شوند
- باید از encryption استفاده شود
- باید از environment variables استفاده شود

---

## 📞 پشتیبانی

اگر مشکلی دارید:

1. Console را بررسی کنید
2. Network tab را بررسی کنید
3. Database را بررسی کنید
4. Error messages را بخوانید

---

## ✅ نتیجه

**AI Center به صورت خودکار راه‌اندازی می‌شود!**

فقط کافی است:

1. به AI Center بروید
2. (اختیاری) API Keys را تنظیم کنید
3. شروع به استفاده کنید!

🎉 **همه چیز آماده است!**
