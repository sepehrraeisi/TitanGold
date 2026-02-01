#!/usr/bin/env python3
"""
INFRA-005: Migrate console.* to structured logger
Replaces console.log/error/warn/info/debug with logger.* across backend
"""

import os
import re
from pathlib import Path

BACKEND_DIR = Path("/home/ubuntu/webapp/TitanGold/backend")
EXCLUDE_DIRS = {'node_modules', '__tests__', 'coverage', 'scripts', '.git'}
EXCLUDE_FILES = {'logger.js'}

def calculate_relative_path(file_path, target_path):
    """Calculate relative import path from file to target"""
    try:
        relative = os.path.relpath(target_path, file_path.parent)
        if not relative.startswith('.'):
            relative = './' + relative
        return relative.replace(os.sep, '/')
    except:
        return '../services/logger.js'

def has_logger_import(content):
    """Check if file already imports logger"""
    patterns = [
        r"import.*logger.*from.*['\"].*logger",
        r"const.*logger.*=.*require\(['\"].*logger",
    ]
    return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)

def add_logger_import(content, file_path):
    """Add logger import at appropriate location"""
    lines = content.split('\n')
    
    # Find last import/require line
    last_import_idx = -1
    for i, line in enumerate(lines):
        if re.match(r'^import\s+|^const\s+.*require\(', line.strip()):
            last_import_idx = i
    
    if last_import_idx == -1:
        # No imports found, add at top
        logger_import = "import { logger } from './services/logger.js';"
        lines.insert(0, logger_import)
    else:
        # Add after last import
        relative_path = calculate_relative_path(file_path, BACKEND_DIR / 'services' / 'logger.js')
        logger_import = f"import {{ logger }} from '{relative_path}';"
        lines.insert(last_import_idx + 1, logger_import)
    
    return '\n'.join(lines)

def replace_console_calls(content):
    """Replace console.* with logger.* calls"""
    replacements = []
    
    # Pattern to match console calls
    console_pattern = r'console\.(log|error|warn|info|debug)\s*\('
    
    for match in re.finditer(console_pattern, content):
        level = match.group(1)
        start = match.start()
        
        # Find matching closing paren
        open_count = 1
        i = match.end()
        while i < len(content) and open_count > 0:
            if content[i] == '(':
                open_count += 1
            elif content[i] == ')':
                open_count -= 1
            i += 1
        
        if open_count == 0:
            # Extract full console call
            full_call = content[start:i]
            
            # Map console level to logger level
            logger_level = 'info' if level == 'log' else level
            
            # Replace console with logger
            new_call = full_call.replace(f'console.{level}', f'logger.{logger_level}')
            
            replacements.append((start, i, new_call))
    
    # Apply replacements in reverse order to preserve indices
    for start, end, new_call in reversed(replacements):
        content = content[:start] + new_call + content[end:]
    
    return content

def process_file(file_path):
    """Process a single JavaScript file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if file has console calls
        if not re.search(r'console\.(log|error|warn|info|debug)', content):
            return 0
        
        original_count = len(re.findall(r'console\.(log|error|warn|info|debug)', content))
        
        # Add logger import if not present
        if not has_logger_import(content):
            content = add_logger_import(content, file_path)
        
        # Replace console calls
        content = replace_console_calls(content)
        
        # Write back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        new_count = len(re.findall(r'logger\.(error|warn|info|debug)', content))
        
        print(f"✅ {file_path.relative_to(BACKEND_DIR)}: {original_count} console → {new_count} logger")
        return 1
    
    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")
        return 0

def main():
    """Main migration function"""
    print("🔄 Starting console.log → logger migration...")
    print(f"📁 Backend directory: {BACKEND_DIR}")
    print()
    
    modified_count = 0
    total_files = 0
    
    # Find all JS files
    for root, dirs, files in os.walk(BACKEND_DIR):
        # Remove excluded directories
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        
        for file in files:
            if file.endswith('.js') and file not in EXCLUDE_FILES:
                file_path = Path(root) / file
                total_files += 1
                modified_count += process_file(file_path)
    
    print()
    print(f"✨ Migration complete!")
    print(f"📊 Modified {modified_count} / {total_files} files")

if __name__ == '__main__':
    main()
