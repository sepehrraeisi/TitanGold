#!/bin/bash
# INFRA-005: Add logger imports to files that use logger but don't import it

set -e

BACKEND_DIR="/home/ubuntu/webapp/TitanGold/backend"
cd "$BACKEND_DIR"

echo "🔄 Adding logger imports to files..."
echo ""

ADDED=0
SKIPPED=0

# Find all JS files that use logger but don't import it
find . -name "*.js" -type f \
  ! -path "./node_modules/*" \
  ! -path "./__tests__/*" \
  ! -path "./coverage/*" \
  ! -path "./services/logger.js" \
  ! -path "./scripts/*" | while read file; do
  
  # Check if file uses logger
  if grep -q "logger\.\(error\|warn\|info\|debug\)" "$file"; then
    # Check if file already imports logger
    if ! grep -q "import.*logger.*from\|const.*logger.*require" "$file"; then
      # Count slashes to determine depth
      DEPTH=$(echo "$file" | tr -cd '/' | wc -c)
      
      # Build relative path (depth - 1 because file is at ./something)
      REL_PATH=""
      for ((i=1; i<DEPTH; i++)); do
        REL_PATH="../$REL_PATH"
      done
      REL_PATH="${REL_PATH}services/logger.js"
      
      # Find last import line
      LAST_IMPORT=$(grep -n "^import\|^const.*require" "$file" | tail -1 | cut -d: -f1)
      
      if [ -z "$LAST_IMPORT" ]; then
        # No imports, add at top
        {
          echo "import { logger } from './${REL_PATH}';"
          cat "$file"
        } > "$file.tmp" && mv "$file.tmp" "$file"
      else
        # Add after last import
        sed -i "${LAST_IMPORT}a import { logger } from './${REL_PATH}';" "$file"
      fi
      
      echo "✅ Added import to: $file"
      ADDED=$((ADDED + 1))
    else
      SKIPPED=$((SKIPPED + 1))
    fi
  fi
done

echo ""
echo "📊 Summary:"
echo "   Added imports: $ADDED"
echo "   Skipped (already had import): $SKIPPED"
echo ""
echo "✨ Done!"
