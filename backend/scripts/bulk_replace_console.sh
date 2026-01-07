#!/bin/bash
# INFRA-005: Bulk replace console with logger
# Fast sed-based replacement for all backend JS files

set -e

BACKEND_DIR="/home/ubuntu/webapp/TitanGold/backend"
cd "$BACKEND_DIR"

echo "🔄 Bulk replacing console.* with logger.*..."
echo ""

# Count before
BEFORE=$(grep -r "console\.\(log\|error\|warn\|info\|debug\)" --include="*.js" --exclude-dir=node_modules --exclude-dir=__tests__ --exclude-dir=coverage . | wc -l)
echo "📊 Found $BEFORE console calls"

# Replace all console.* with logger.* (except in logger.js itself)
find . -name "*.js" -type f \
  ! -path "./node_modules/*" \
  ! -path "./__tests__/*" \
  ! -path "./coverage/*" \
  ! -path "./services/logger.js" \
  -exec sed -i \
    -e 's/console\.log(/logger.info(/g' \
    -e 's/console\.error(/logger.error(/g' \
    -e 's/console\.warn(/logger.warn(/g' \
    -e 's/console\.info(/logger.info(/g' \
    -e 's/console\.debug(/logger.debug(/g' \
    {} +

echo "✅ Replacement complete"

# Count after
AFTER=$(grep -r "logger\.\(error\|warn\|info\|debug\)" --include="*.js" --exclude-dir=node_modules --exclude-dir=__tests__ --exclude-dir=coverage --exclude="logger.js" . | wc -l)
REMAINING=$(grep -r "console\.\(log\|error\|warn\|info\|debug\)" --include="*.js" --exclude-dir=node_modules --exclude-dir=__tests__ --exclude-dir=coverage . | wc -l || echo "0")

echo ""
echo "📊 Results:"
echo "   Before: $BEFORE console calls"
echo "   After: $AFTER logger calls"
echo "   Remaining: $REMAINING console calls"
echo ""
echo "✨ Done! Now add logger imports where needed."
