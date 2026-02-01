#!/bin/bash

echo "=== Security Endpoints Test ==="

# Login
echo -e "\n1️⃣ Login as admin..."
TOKEN=$(curl -s "https://titan.zala.ir/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  exit 1
fi
echo "✅ Token received"

# GET Security Config
echo -e "\n2️⃣ GET /api/config/security"
curl -s "https://titan.zala.ir/api/config/security" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# PUT Security Config
echo -e "\n3️⃣ PUT /api/config/security (update jwtExpiryHours)"
curl -s "https://titan.zala.ir/api/config/security" \
  -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "allowEmailLogin": true,
    "jwtExpiryHours": 48,
    "maxLoginAttempts": 10,
    "lockoutMinutes": 15
  }' | jq '.'

# Verify update
echo -e "\n4️⃣ Verify update (GET again)"
curl -s "https://titan.zala.ir/api/config/security" \
  -H "Authorization: Bearer $TOKEN" | jq '.config.jwtExpiryHours'

echo -e "\n✅ Security endpoints test complete"
