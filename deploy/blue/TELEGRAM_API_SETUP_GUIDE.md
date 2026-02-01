# 🔐 Telegram API Credentials Setup Guide

**Date**: 2025-11-26  
**Purpose**: Enable real Telegram integration for TitanGold Telegram Collector  
**Status**: Ready for configuration

---

## 📋 Overview

To enable **real Telegram integration** (not mock data), you need to:
1. Get API credentials from Telegram
2. Configure the telegram-collector service
3. Login via the frontend

---

## 🔑 Step 1: Get Telegram API Credentials

### 1.1 Visit Telegram API Portal
Open your browser and go to:
```
https://my.telegram.org
```

### 1.2 Login with Your Phone Number
- Enter your phone number (with country code)
- Example: `+989123456789`
- You'll receive a verification code via Telegram app
- Enter the code to login

### 1.3 Create API Application
1. Click **"API development tools"**
2. If you already have an app, you'll see it listed
3. If not, create a new application:
   - **App title**: `TitanGold Collector` (or any name)
   - **Short name**: `titangold` (or any short name)
   - **Platform**: Select **"Other"**
   - **Description**: `Professional trading platform data collector`
4. Click **"Create application"**

### 1.4 Copy Your Credentials
You'll see two important values:
```
api_id: 1234567
api_hash: abcdef1234567890abcdef1234567890
```

**⚠️ IMPORTANT**: 
- Keep these credentials **SECRET**
- Don't share them with anyone
- Don't commit them to GitHub

---

## ⚙️ Step 2: Configure Telegram Collector

### 2.1 Edit Configuration File
```bash
cd /home/ubuntu/webapp/TitanGold/telegram-collector
nano .env
```

### 2.2 Add Your Credentials
Replace the commented lines with your actual values:

```bash
# Telegram Collector Configuration
PORT=3002

# Telegram API Credentials (get from https://my.telegram.org)
TELEGRAM_API_ID=1234567                          # Replace with your api_id
TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890  # Replace with your api_hash
TELEGRAM_PHONE_NUMBER=+989123456789              # Replace with your phone number

# If you have 2FA (Two-Factor Authentication) enabled:
TELEGRAM_PASSWORD=your_2fa_password              # Optional, only if you have 2FA

# Session will be stored after first authentication
# TELEGRAM_SESSION_STRING=will_be_generated_after_login

# Cache TTL in seconds (default: 300 = 5 minutes)
CACHE_TTL=300
```

**Save the file**: Press `Ctrl+X`, then `Y`, then `Enter`

### 2.3 Restart the Service
```bash
pm2 restart telegram-collector
```

### 2.4 Verify Configuration
```bash
curl http://localhost:3002/health
```

You should see:
```json
{
  "status": "healthy",
  "configured": {
    "apiId": true,   ← Should be true now
    "apiHash": true, ← Should be true now
    "session": false ← Will be true after login
  }
}
```

---

## 🎯 Step 3: Login via Frontend

### 3.1 Access Frontend
Open your browser and navigate to:
```
http://188.40.209.82:3000
```

### 3.2 Navigate to Telegram Collector
1. Click **"AI Center"** in the left menu
2. Click **"Data Hub"** tab
3. Click **"Telegram Collector"** section

### 3.3 Start Login Process
1. Enter your **phone number** (e.g., `+989123456789`)
2. Click **"Send Verification Code"** ✅ (button should be enabled)
3. Wait for the request to complete

### 3.4 Enter Verification Code
1. Check your **Telegram app** for a verification code
2. You'll receive a message like: `Your login code: 12345`
3. Enter the 5-digit code in the frontend
4. If you have **2FA enabled**, also enter your password
5. Click **"Confirm Login"**

### 3.5 Success!
If login is successful:
- ✅ Session will be saved on the server
- ✅ You can now track Telegram channels
- ✅ No need to login again (session persists)

---

## 📊 Step 4: Track Telegram Channels

### 4.1 Add a Channel
1. Go to **"Channel Management"** tab
2. Enter channel username: `@channelname` (without @)
   - Example: `crypto` for `@crypto`
3. Click **"Add Channel"**

### 4.2 View Messages
1. Go to **"Tracked Channels"** section
2. Select a channel from the list
3. View recent messages
4. Messages are cached for 5 minutes (CACHE_TTL)

---

## 🔧 Troubleshooting

### Issue 1: "Failed to send verification code"
**Possible causes**:
- API credentials are incorrect
- Phone number format is wrong (must include country code: `+98...`)
- Network connectivity issues

**Solution**:
1. Verify API credentials from https://my.telegram.org
2. Check phone number format
3. Check telegram-collector logs:
   ```bash
   pm2 logs telegram-collector --lines 50
   ```

### Issue 2: "Invalid verification code"
**Possible causes**:
- Code expired (valid for 5 minutes)
- Wrong code entered
- Code already used

**Solution**:
1. Request a new code
2. Enter the code immediately after receiving it
3. Double-check the code in your Telegram app

### Issue 3: "2FA password required"
**Possible causes**:
- Your Telegram account has Two-Factor Authentication enabled
- Password not provided or incorrect

**Solution**:
1. Enter your 2FA password in the frontend
2. Or add it to `.env` file:
   ```bash
   TELEGRAM_PASSWORD=your_2fa_password
   ```

### Issue 4: "Session expired"
**Possible causes**:
- Session string deleted or corrupted
- Telegram revoked the session

**Solution**:
1. Login again via frontend
2. New session will be generated and saved

---

## 🔒 Security Best Practices

### 1. Protect Your Credentials
```bash
# Set proper file permissions
chmod 600 /home/ubuntu/webapp/TitanGold/telegram-collector/.env
```

### 2. Don't Commit Credentials
The `.env` file is already in `.gitignore`, but verify:
```bash
cd /home/ubuntu/webapp/TitanGold
grep ".env" .gitignore
```

### 3. Use Environment Variables (Production)
For production, use environment variables instead of `.env` file:
```bash
export TELEGRAM_API_ID=1234567
export TELEGRAM_API_HASH=abcdef...
pm2 restart telegram-collector --update-env
```

### 4. Rotate Credentials Regularly
- Change API credentials every 6-12 months
- Revoke old sessions from Telegram app:
  - Settings → Privacy and Security → Active Sessions

---

## 📝 Configuration Reference

### Required Fields
| Field | Description | Example |
|-------|-------------|---------|
| `TELEGRAM_API_ID` | API ID from my.telegram.org | `1234567` |
| `TELEGRAM_API_HASH` | API Hash from my.telegram.org | `abcdef1234567890...` |
| `TELEGRAM_PHONE_NUMBER` | Your phone number with country code | `+989123456789` |

### Optional Fields
| Field | Description | Default |
|-------|-------------|---------|
| `TELEGRAM_PASSWORD` | 2FA password (if enabled) | `` |
| `TELEGRAM_SESSION_STRING` | Auto-generated after first login | `` |
| `PORT` | Service port | `3002` |
| `CACHE_TTL` | Message cache duration (seconds) | `300` |

---

## 🧪 Testing

### Test 1: Verify Credentials Loaded
```bash
curl http://localhost:3002/health | jq '.configured'
```

Expected:
```json
{
  "apiId": true,
  "apiHash": true,
  "session": false  // Will be true after login
}
```

### Test 2: Send Verification Code
```bash
curl -X POST http://localhost:3002/api/telegram-collector/login/start \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+989123456789"}'
```

Expected:
```json
{
  "success": true,
  "authId": "auth_1234567890_abc123",
  "message": "Verification code sent"
}
```

### Test 3: Confirm Login
```bash
curl -X POST http://localhost:3002/api/telegram-collector/login/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "authId": "auth_1234567890_abc123",
    "code": "12345"
  }'
```

Expected:
```json
{
  "success": true,
  "message": "Login successful",
  "sessionString": "1AbC..."
}
```

---

## 🎉 Success Checklist

After completing all steps, verify:

- ✅ API credentials obtained from https://my.telegram.org
- ✅ `.env` file configured with credentials
- ✅ Service restarted: `pm2 restart telegram-collector`
- ✅ Health check shows `apiId: true, apiHash: true`
- ✅ Frontend login successful
- ✅ Session saved on server
- ✅ Can track Telegram channels
- ✅ Messages fetched successfully

---

## 🔗 Related Documentation

- `TELEGRAM_COLLECTOR_SETUP.md` - Complete setup guide (Persian)
- `TELEGRAM_COLLECTOR_PROXY_FIX.md` - Proxy configuration details
- `FINAL_PROJECT_STATUS.md` - Full project status

---

## 📞 Support

### Check Service Status
```bash
pm2 status telegram-collector
pm2 logs telegram-collector
```

### Check Configuration
```bash
cat /home/ubuntu/webapp/TitanGold/telegram-collector/.env | grep -v "^#"
```

### Restart Service
```bash
pm2 restart telegram-collector
```

### View Logs
```bash
pm2 logs telegram-collector --lines 100
```

---

## 🎯 Next Steps After Setup

Once you have real Telegram integration working:

1. **Add Channels**: Track crypto news channels, trading signals, etc.
2. **Set Up Alerts**: Configure notifications for important messages
3. **Analyze Data**: Use collected data for AI-powered insights
4. **Automate Trading**: Connect to Autopilot Engine for automated decisions

---

**Guide Created**: 2025-11-26  
**Status**: Ready for setup  
**Estimated Setup Time**: 10-15 minutes  
**Difficulty**: Easy (follow step-by-step)

**🚀 Let's get your Telegram Collector connected to real data!**
