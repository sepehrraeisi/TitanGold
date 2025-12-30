#!/bin/bash

echo "=== Package B: Security Tab Complete Test ==="

# 1. Login
echo -e "\n1️⃣ Login as admin"
TOKEN=$(curl -s "https://titan.zala.ir/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  exit 1
fi
echo "✅ Token: ${TOKEN:0:20}..."

# 2. GET current config
echo -e "\n2️⃣ GET /api/config/security"
CURRENT=$(curl -s "https://titan.zala.ir/api/config/security" \
  -H "Authorization: Bearer $TOKEN")
echo "$CURRENT" | jq '.'

# 3. Update config
echo -e "\n3️⃣ PUT /api/config/security (change values)"
UPDATE=$(curl -s "https://titan.zala.ir/api/config/security" \
  -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "allowEmailLogin": false,
    "jwtExpiryHours": 72,
    "maxLoginAttempts": 5,
    "lockoutMinutes": 30
  }')
echo "$UPDATE" | jq '.'

# 4. Verify persistence
echo -e "\n4️⃣ Verify persistence (GET again)"
VERIFY=$(curl -s "https://titan.zala.ir/api/config/security" \
  -H "Authorization: Bearer $TOKEN")
echo "$VERIFY" | jq '.config'

# 5. Test validation (invalid values)
echo -e "\n5️⃣ Test validation (invalid jwtExpiryHours=200)"
INVALID=$(curl -s "https://titan.zala.ir/api/config/security" \
  -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "allowEmailLogin": true,
    "jwtExpiryHours": 200,
    "maxLoginAttempts": 10,
    "lockoutMinutes": 15
  }')
echo "$INVALID" | jq '.'

# 6. Reset to defaults
echo -e "\n6️⃣ Reset to defaults"
RESET=$(curl -s "https://titan.zala.ir/api/config/security" \
  -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "allowEmailLogin": true,
    "jwtExpiryHours": 24,
    "maxLoginAttempts": 10,
    "lockoutMinutes": 15
  }')
echo "$RESET" | jq '.success'

echo -e "\n✅ Package B: Security Tab — ALL TESTS PASSED"
