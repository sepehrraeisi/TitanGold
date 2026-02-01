#!/usr/bin/env python3
"""Add logger imports to files that use logger but don't import it"""

import os
import re
from pathlib import Path

BACKEND_DIR = Path("/home/ubuntu/webapp/TitanGold/backend")

def has_logger_usage(content):
    """Check if file uses logger"""
    return bool(re.search(r'\blogger\.(error|warn|info|debug|http)\(', content))

def has_logger_import(content):
    """Check if file already imports logger"""
    return bool(re.search(r"import.*logger.*from.*['\"].*logger", content, re.MULTILINE))

def calculate_relative_path(file_path):
    """Calculate relative path from file to logger.js"""
    try:
        # Count directory depth
        parts = file_path.relative_to(BACKEND_DIR).parts
        depth = len(parts) - 1  # -1 because last part is the filename
        
        if depth == 0:
            # File is in backend root
            return "./services/logger.js"
        else:
            # File is in subdirectory
            return f"{'../' * depth}services/logger.js"
    except:
        return "../services/logger.js"

def add_logger_import(content, file_path):
    """Add logger import after existing imports"""
    lines = content.split('\n')
    
    # Find last import line
    last_import_idx = -1
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('import ') or (stripped.startswith('const ') and 'require(' in stripped):
            last_import_idx = i
    
    relative_path = calculate_relative_path(file_path)
    logger_import = f"import {{ logger }} from '{relative_path}';"
    
    if last_import_idx == -1:
        # No imports found, add at top (after any comments)
        insert_idx = 0
        for i, line in enumerate(lines):
            if line.strip() and not line.strip().startswith('//') and not line.strip().startswith('/*') and not line.strip().startswith('*'):
                insert_idx = i
                break
        lines.insert(insert_idx, logger_import)
    else:
        # Insert after last import
        lines.insert(last_import_idx + 1, logger_import)
    
    return '\n'.join(lines)

def process_file(file_path):
    """Process a single file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if file uses logger
        if not has_logger_usage(content):
            return False
        
        # Check if already has import
        if has_logger_import(content):
            return False
        
        # Add logger import
        new_content = add_logger_import(content, file_path)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"✅ {file_path.relative_to(BACKEND_DIR)}")
        return True
    
    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")
        return False

def main():
    print("🔄 Adding logger imports...")
    print()
    
    count = 0
    exclude_dirs = {'node_modules', '__tests__', 'coverage', 'scripts', '.git'}
    exclude_files = {'logger.js'}
    
    for root, dirs, files in os.walk(BACKEND_DIR):
        # Remove excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            if file.endswith('.js') and file not in exclude_files:
                file_path = Path(root) / file
                if process_file(file_path):
                    count += 1
    
    print()
    print(f"✨ Done! Added imports to {count} files")

if __name__ == '__main__':
    main()
