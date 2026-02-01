# Admin Login Fix - Step 6.1.1

## Problem
- Admin user credentials were not working
- Login endpoint returned "Invalid credentials"
- All Admin-only endpoints (like PUT /api/config/artemis) were inaccessible

## Root Cause Analysis
1. Admin user existed in DB:
   - Username: `admin`
   - Email: `admin@titangold.com`
   - Role: `admin`
   - `is_active`: `true`

2. Password hash existed but didn't match the expected password `Admin@123`
3. bcrypt.compare() was failing

## Solution
Reset admin password using bcrypt:

```bash
cd /home/ubuntu/webapp/TitanGold/backend
node -e "
import bcrypt from 'bcrypt';
import('./database/db.js').then(async ({query})=>{
  const NEW='Admin@123';
  const hash=await bcrypt.hash(NEW, 10);
  const a=await query(\"SELECT id, username, email FROM users WHERE role='admin' LIMIT 1\");
  await query(\"UPDATE users SET password_hash=\$1 WHERE id=\$2\", [hash, a.rows[0].id]);
  console.log('✅ Admin password reset for:', a.rows[0]);
  process.exit(0);
})"
```

## Testing Results

### ✅ Login Test
```bash
curl -s "https://titan.zala.ir/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' | jq '.'
```

**Result**: Successfully returns user object and JWT token

### ✅ GET Config Test
```bash
TOKEN=$(curl -s "https://titan.zala.ir/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' | jq -r '.token')

curl -s "https://titan.zala.ir/api/config/artemis" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

**Result**: Successfully retrieves Artemis configuration

### ✅ PUT Config Test (Admin-only)
```bash
curl -s "https://titan.zala.ir/api/config/artemis" \
  -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "weighted_vote",
    "quorum": { "type": "percent", "value": 60, "min": 3 },
    "timeoutMs": 18000,
    "maxRetries": 3,
    "maxConcurrency": 10,
    "providersToUse": ["openrouter", "deepseek"],
    "degradedMode": "best_effort",
    "aggregation": { "method": "weighted_vote", "finalSummarizer": true }
  }' | jq '.'
```

**Result**: 
```json
{
  "success": true,
  "message": "Artemis configuration updated successfully"
}
```

## Current Admin Credentials

**For Testing/Development:**
- **Username**: `admin`
- **Email**: `admin@titangold.com`
- **Password**: `Admin@123`
- **Role**: `admin`
- **User ID**: `58d6c166-d632-407a-b380-f4ee3e1879e1`

## Known Issues
- ⚠️ Login with email (instead of username) returns null
  - Login route checks both: `WHERE (username = $1 OR email = $1)`
  - Needs further investigation

## Impact
- ✅ All Admin-only endpoints now accessible
- ✅ Configuration management fully functional
- ✅ Ready for UI Configuration page integration
- ✅ Ready for Step 6.2.3: Agents Registry API

## Next Steps
1. Build UI Configuration → Decision Engine tab
2. Implement Agents Registry API
3. Build Agents UI tab
4. Investigate email login issue (low priority)

## Date
2025-12-30
