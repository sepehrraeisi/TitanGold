#!/bin/bash
# INFRA-005: Replace console.log with structured logger
# This script replaces console.* calls with logger.* calls across backend

set -e

BACKEND_DIR="/home/ubuntu/webapp/TitanGold/backend"
cd "$BACKEND_DIR"

echo "🔄 Starting console.log replacement with structured logger..."
echo ""

# Exclude directories
EXCLUDE_DIRS="-path ./node_modules -o -path ./__tests__ -o -path ./coverage -o -path ./scripts"

# Find all JS files
FILES=$(find . -name "*.js" -type f ! \( $EXCLUDE_DIRS \) | grep -v "services/logger.js")

TOTAL_FILES=$(echo "$FILES" | wc -l)
MODIFIED_COUNT=0

echo "📊 Found $TOTAL_FILES files to process"
echo ""

# Process each file
for file in $FILES; do
    # Check if file contains console.* calls
    if grep -q "console\.\(log\|error\|warn\|info\|debug\)" "$file"; then
        # Backup original file
        cp "$file" "$file.bak"
        
        # Count original console calls
        ORIGINAL_COUNT=$(grep -c "console\.\(log\|error\|warn\|info\|debug\)" "$file" || echo "0")
        
        # Check if logger is already imported
        HAS_LOGGER_IMPORT=$(grep -c "from.*['\"].*logger" "$file" || echo "0")
        
        # Add logger import if not present (at the top after other imports)
        if [ "$HAS_LOGGER_IMPORT" = "0" ]; then
            # Find the last import statement
            LAST_IMPORT_LINE=$(grep -n "^import\|^const.*require" "$file" | tail -1 | cut -d: -f1)
            
            if [ ! -z "$LAST_IMPORT_LINE" ]; then
                # Calculate relative path to logger
                FILE_DEPTH=$(echo "$file" | tr -cd '/' | wc -c)
                RELATIVE_PATH=$(printf '../%.0s' $(seq 1 $((FILE_DEPTH - 1))))
                LOGGER_IMPORT="import { logger } from '${RELATIVE_PATH}services/logger.js';"
                
                # Insert logger import after last import
                sed -i "${LAST_IMPORT_LINE}a\\${LOGGER_IMPORT}" "$file"
            fi
        fi
        
        # Replace console.* with logger.*
        sed -i 's/console\.log(/logger.info(/g' "$file"
        sed -i 's/console\.error(/logger.error(/g' "$file"
        sed -i 's/console\.warn(/logger.warn(/g' "$file"
        sed -i 's/console\.info(/logger.info(/g' "$file"
        sed -i 's/console\.debug(/logger.debug(/g' "$file"
        
        # Count new logger calls
        NEW_COUNT=$(grep -c "logger\.\(error\|warn\|info\|debug\)" "$file" || echo "0")
        
        # Remove backup if successful
        rm "$file.bak"
        
        MODIFIED_COUNT=$((MODIFIED_COUNT + 1))
        echo "✅ $file: $ORIGINAL_COUNT console calls → $NEW_COUNT logger calls"
    fi
done

echo ""
echo "✨ Replacement complete!"
echo "📊 Modified files: $MODIFIED_COUNT / $TOTAL_FILES"
echo ""
echo "⚠️  Next steps:"
echo "1. Review changes: git diff"
echo "2. Test the application"
echo "3. Run tests: npm test"
echo "4. Commit changes: git add -A && git commit -m 'feat(logging): Replace console with structured logger [INFRA-005]'"
