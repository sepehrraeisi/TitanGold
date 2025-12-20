# 🔐 Complete Guide: Setting Up MEXC API Keys in TitanGold

**Version**: 1.0.0  
**Last Updated**: 2025-01-XX  
**Level**: Beginner to Advanced

---

## 📋 Table of Contents

1. [Introduction](#introduction)
2. [Getting API Keys from MEXC](#getting-api-keys-from-mexc)
3. [Configuring API Keys in TitanGold](#configuring-api-keys-in-titangold)
4. [Testing Connection](#testing-connection)
5. [Common Issues and Solutions](#common-issues-and-solutions)
6. [Security Best Practices](#security-best-practices)
7. [Frequently Asked Questions (FAQ)](#frequently-asked-questions-faq)

---

## 🎯 Introduction

MEXC is one of the largest cryptocurrency exchanges that enables automated and manual trading. To use Trading features in TitanGold, you need to configure API Keys.

### ⚠️ Important Notes Before Starting:

- ✅ Your API Keys are **confidential** and should not be shared with anyone
- ✅ Only enable **Read** and **Trade** permissions (not Withdraw)
- ✅ Use **IP Whitelist** for additional security
- ✅ For testing, you can use **Testnet**

---

## 📝 Getting API Keys from MEXC

### Step 1: Log in to MEXC Account

1. Go to [MEXC.com](https://www.mexc.com)
2. Log in to your account
3. If you don't have an account, create a new one

### Step 2: Access API Management

1. Click on **Profile** icon (top right)
2. Select **API Management** or **API Keys** from the menu
3. Or go directly to: `https://www.mexc.com/user/api`

### Step 3: Create New API Key

1. Click **Create API Key** or **Create New API** button
2. Choose a **name** for your API Key (e.g., `TitanGold Trading`)
3. Set **Permissions**:
   - ✅ **Read** (read information)
   - ✅ **Trade** (trading)
   - ❌ **Withdraw** (withdraw funds) - **should NOT be enabled**
4. Set **IP Whitelist** (optional but recommended):
   - Enter your TitanGold server IP
   - Or leave empty for testing
5. Click **Create** or **Confirm**

### Step 4: Save API Key and Secret

⚠️ **Important Warning**: Secret Key is shown only once!

1. Copy **API Key** (e.g., `mexc_xxxxxxxxxxxxx`)
2. Copy **Secret Key** (e.g., `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
3. Save both in a secure location
4. Click **I have saved it**

### Step 5: Activate API Key

1. Find your new API Key in the list
2. Make sure its **Status** is **Active**
3. If inactive, click **Enable**

---

## ⚙️ Configuring API Keys in TitanGold

### Step 1: Access Settings

1. Log in to TitanGold panel
2. Click **Settings** from the left menu
3. Select **Connections** tab
4. Find **Exchange API Keys** section

### Step 2: Enter API Keys

1. In **MEXC API Key** field, paste your copied API Key
2. In **MEXC API Secret** field, paste your copied Secret Key
3. If you want to use **Testnet**:
   - Enable **Use Testnet** option
   - Note: In Testnet, trades are not real

### Step 3: Test Connection

1. Click **Test Connection** button
2. Wait for the test to complete (usually 2-5 seconds)
3. If successful:
   - Message **✅ Connection successful** is displayed
   - Your account information is displayed
4. If unsuccessful:
   - Refer to [Common Issues](#common-issues-and-solutions) section

### Step 4: Save Settings

1. After successful test, click **Save Changes**
2. Message **✅ Settings saved successfully!** is displayed
3. Now you can use **Trades** section

---

## ✅ Testing Connection

### Automatic Test

After entering API Keys, the system automatically:
- Tests the connection
- Checks account balance
- Displays account information

### Manual Test

1. In **Connections Settings** section, click **Test Connection**
2. If successful, the following information is displayed:
   - USDT balance
   - Other currencies balance
   - Last update time

### Verification in Trades Section

1. Go to **Trades** section
2. Select **Manual Trades** tab
3. If API Keys are correctly configured:
   - Order Book is displayed
   - You can place trades
   - Your balance is displayed

---

## 🔧 Common Issues and Solutions

### Issue 1: "Connection test failed" or "Invalid API Key"

**Possible Causes:**
- API Key or Secret Key entered incorrectly
- API Key is inactive
- IP Whitelist is set and your IP is not in the list

**Solution:**
1. ✅ Copy API Key and Secret again from MEXC
2. ✅ In MEXC, make sure API Key is **Active**
3. ✅ Check IP Whitelist:
   - In MEXC, go to API Management
   - Clear IP Whitelist or add server IP
4. ✅ Create a new API Key

### Issue 2: "Permission denied" or "Insufficient permissions"

**Cause:**
- API Key only has **Read** permission
- Trading requires **Trade** permission

**Solution:**
1. In MEXC, go to API Management
2. Edit API Key
3. Enable **Trade** permission
4. Save changes
5. Test again in TitanGold

### Issue 3: "Balance not available" or balance not displayed

**Possible Causes:**
- Connection to MEXC is not established
- API Key only has Read permission
- Network or server issue

**Solution:**
1. ✅ Check internet connection
2. ✅ Test API Key again
3. ✅ In MEXC, make sure API Key is active
4. ✅ Refresh the page

### Issue 4: "Rate limit exceeded"

**Cause:**
- Too many requests to MEXC API

**Solution:**
1. ✅ Wait a few minutes
2. ✅ Reduce number of requests
3. ✅ If problem persists, contact support

### Issue 5: "Testnet connection failed"

**Cause:**
- Testnet API Keys are different from Mainnet
- Or Testnet is unavailable

**Solution:**
1. ✅ Use Mainnet instead
2. ✅ Or disable Testnet

---

## 🔒 Security Best Practices

### 1. Use IP Whitelist

**Why Important:**
- Only specified IPs can access API Key
- Greatly increases security

**How to Configure:**
1. Find your TitanGold server IP
2. In MEXC, go to API Management
3. Add IP to Whitelist
4. Only use trusted IPs

### 2. Limit Permissions

**Recommendation:**
- ✅ Only enable **Read** and **Trade**
- ❌ Never enable **Withdraw**
- This prevents unauthorized fund withdrawal

### 3. Use Separate API Key for TitanGold

**Why:**
- If API Key is compromised, you can disable only that one
- Your other API Keys remain secure

### 4. Periodically Change API Keys

**Recommendation:**
- Change API Key every 3-6 months
- Delete old API Key

### 5. Secure Storage of API Keys

**Notes:**
- ❌ Don't store API Keys in email or SMS
- ✅ Use Password Manager
- ✅ Don't commit API Keys in code or Git

### 6. Monitor API Activity

**How:**
1. In MEXC, go to **API Logs** section
2. Review API activities
3. If you see suspicious activity, immediately disable API Key

---

## ❓ Frequently Asked Questions (FAQ)

### Q1: Can I use Testnet?

**Answer:** Yes, TitanGold supports Testnet. To enable:
1. In settings, enable **Use Testnet** option
2. Get Testnet API Keys from MEXC
3. Note: In Testnet, trades are not real

### Q2: Can I have multiple API Keys?

**Answer:** Yes, you can create multiple API Keys in MEXC, but only one API Key can be active in TitanGold.

### Q3: What if I forget my API Key?

**Answer:**
- Secret Key is shown only once
- If forgotten, you must create a new API Key
- Delete old API Key in MEXC

### Q4: Can I disable API Key?

**Answer:** Yes:
1. In MEXC, go to API Management
2. Find API Key
3. Click **Disable**
4. Or clear API Keys in TitanGold

### Q5: Can I use API Key for Withdraw?

**Answer:**
- ❌ **Not recommended**
- For better security, don't enable Withdraw permission
- If you need to withdraw, use MEXC website

### Q6: Why is my balance not displayed?

**Answer:** Several possibilities:
1. API Key only has Read permission (needs Trade)
2. Connection to MEXC is not established
3. Your balance is zero
4. Network or server issue

### Q7: Can I use API Key on multiple devices?

**Answer:** Yes, but:
- If IP Whitelist is enabled, you can only use from specified IPs
- For better security, use IP Whitelist

### Q8: Can I use API Key for multiple MEXC accounts?

**Answer:** No, each API Key is only for one MEXC account.

---

## 📞 Support

If you still have issues after following the above steps:

1. **Check Logs:**
   - Check errors in browser Console
   - Check MEXC-related errors in Backend logs

2. **Contact Support:**
   - Email: support@titangold.com
   - Or use Help section in panel

3. **MEXC Documentation:**
   - [MEXC API Documentation](https://mexcdevelop.github.io/apidocs/spot_v3_en/)
   - [MEXC Support](https://www.mexc.com/support)

---

## 📚 Additional Resources

- [MEXC Official Website](https://www.mexc.com)
- [MEXC API Documentation](https://mexcdevelop.github.io/apidocs/spot_v3_en/)
- [CCXT Library Documentation](https://docs.ccxt.com/)
- [TitanGold Trading Guide](./TRADING_GUIDE.md)

---

## ✅ Final Checklist

Before starting Trading, make sure:

- [ ] API Key obtained from MEXC
- [ ] Secret Key saved
- [ ] Permissions correctly set (Read + Trade)
- [ ] Withdraw permission disabled
- [ ] IP Whitelist configured (optional)
- [ ] API Keys entered in TitanGold
- [ ] Connection test successful
- [ ] Account balance displayed
- [ ] Can trade in Trades section

---

**Last Updated**: 2025-01-XX  
**Guide Version**: 1.0.0  
**Prepared by**: TitanGold Development Team

