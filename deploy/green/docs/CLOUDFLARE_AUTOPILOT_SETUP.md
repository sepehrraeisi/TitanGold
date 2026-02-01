# Cloudflare Autopilot Setup

## Problem

Autopilot API endpoints are being rate-limited by Cloudflare with:
- **Rate Limit**: 100 requests per 15 minutes (900 seconds)
- **Response**: `429 Too Many Requests - Too many requests from this IP, please try again later.`
- **Headers**: `RateLimit-Policy: 100;w=900`

This affects admin users trying to:
- Enable/disable autopilot
- Trigger manual runs
- Approve/reject suggestions

## Solution: Bypass Cloudflare Rate Limits for Autopilot

### Option A: WAF Custom Rule (Recommended)

**Steps**:

1. **Login to Cloudflare Dashboard** → Select `titan.zala.ir`

2. **Navigate**: Security → WAF → Custom rules

3. **Create Rule**:
   - **Rule name**: `Bypass Autopilot API`
   - **Expression**:
     ```
     (http.request.uri.path starts_with "/api/autopilot")
     ```
   - **Action**: `Skip`
   - **Select features to skip**:
     - ☑ Rate Limiting
     - ☑ WAF Managed Rules
     - ☑ Bot Fight Mode (if enabled)
     - ☑ All security features

4. **Deploy** → Save

**Result**: Autopilot endpoints bypass all Cloudflare rate limits while other APIs remain protected.

---

### Option B: Adjust Rate Limiting Rule

**Steps**:

1. **Navigate**: Security → WAF → Rate limiting rules

2. **Find rule** that applies to `/api/*` or `POST` requests

3. **Edit rule** → Add **Exclusion**:
   - **Expression**:
     ```
     (http.request.uri.path starts_with "/api/autopilot")
     ```

4. **Save**

---

### Option C: Gray-Cloud Subdomain (Alternative)

If you don't want to modify Cloudflare rules:

1. **Create DNS record**:
   - Type: `A`
   - Name: `api-direct` (or `api`)
   - Value: `<origin-server-IP>`
   - **Proxy status**: DNS only (gray cloud ☁️ OFF)

2. **Update frontend** to use `https://api-direct.titan.zala.ir/api/autopilot/*` for autopilot calls

**Pros**: Complete bypass, no Cloudflare interference  
**Cons**: No Cloudflare DDoS protection for autopilot endpoints

---

## Current Backend Configuration

**Backend rate limit** (already configured):
- **Route**: `/api/autopilot/*`
- **Limit**: 60 requests per minute (admin-only)
- **Response**: JSON `{ error: 'Too many autopilot requests', code: 'RATE_LIMITED' }`

**Nginx configuration**:
- `/api/autopilot/` bypasses nginx rate limits
- Backend rate limit is the only controller

---

## Testing After Fix

1. **Test external access**:
   ```bash
   curl -i -X POST https://titan.zala.ir/api/autopilot/enable
   ```
   Expected: `401 Unauthorized` (not 429)

2. **Test with valid admin token**:
   - Open browser → titan.zala.ir → AI Manager → Autopilot
   - Click "Enable Autopilot"
   - Expected: Toggle works without "Too many requests" error

---

## Summary

- **Cloudflare**: Needs dashboard configuration (Option A recommended)
- **Backend**: Already configured (60 req/min, admin-only)
- **Nginx**: Already bypasses rate limits for `/api/autopilot/`

**Action Required**: Configure Cloudflare using Option A, B, or C above.
