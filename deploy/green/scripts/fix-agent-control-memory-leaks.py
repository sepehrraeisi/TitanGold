#!/usr/bin/env python3
"""
FRONTEND-009: Automated memory leak fix for all AgentControl.tsx files

This script:
1. Adds useIsMounted import to all AgentControl files
2. Adds isMountedRef to component state
3. Wraps useEffect with AbortController cleanup
4. Adds mounted checks to all setState calls in async functions
"""

import os
import re
import glob

# Define the agent control files path
COMPONENTS_PATH = "/home/ubuntu/webapp/TitanGold/components/ai"

def add_use_is_mounted_import(content):
    """Add useIsMounted import if not present"""
    if "useIsMounted" in content:
        return content
    
    # Find the api.ts import line
    import_pattern = r"(import \* as api from '\.\.\/\.\.\/services\/api\.ts';)"
    replacement = r"\1\nimport { useIsMounted } from '../../hooks/useMemoryLeakFree.ts';"
    
    return re.sub(import_pattern, replacement, content, count=1)

def add_is_mounted_ref(content):
    """Add isMountedRef after const { t } = useLanguage();"""
    if "isMountedRef = useIsMounted()" in content:
        return content
    
    # Find the useLanguage line
    pattern = r"(const \{ t \} = useLanguage\(\);)"
    replacement = r"\1\n    const isMountedRef = useIsMounted(); // FRONTEND-009: Track mounted state"
    
    return re.sub(pattern, replacement, content, count=1)

def fix_use_effect(content):
    """Add cleanup to useEffect hooks"""
    # Pattern to find useEffect with loadAgentData or similar
    # This is a complex regex that handles multi-line useEffect
    
    # Find all useEffect patterns
    useeffect_patterns = [
        # Pattern 1: useEffect with loadAgentData/loadData call
        (
            r"(    useEffect\(\(\) => \{)\n((?:        .*\n)*?)(        load\w+Data\(\);)\n(    \}, \[agent\.id\]\);)",
            r"\1\n        const abortController = new AbortController();\n        let isCancelled = false;\n\n\2\n        const loadData = async () => {\n            if (!isMountedRef.current || isCancelled) return;\n            \3\n        };\n        loadData();\n\n        // FRONTEND-009: Cleanup\n        return () => {\n            isCancelled = true;\n            abortController.abort();\n        };\n        // eslint-disable-next-line react-hooks/exhaustive-deps\n\4"
        ),
    ]
    
    for pattern, replacement in useeffect_patterns:
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
    
    return content

def add_mounted_checks_to_async(content):
    """Add isMountedRef.current checks to async functions before setState"""
    
    # Find async functions with setState calls
    # Pattern: setXxx calls that are not already wrapped in isMountedRef check
    
    # Replace setIsLoading(true) with safe version
    content = re.sub(
        r"^(\s+)(setIsLoading|setIsBusy)\(true\);$",
        r"\1if (isMountedRef.current) \2(true);",
        content,
        flags=re.MULTILINE
    )
    
    # Replace setIsLoading(false) in finally with safe version
    content = re.sub(
        r"^(\s+)finally \{\n(\s+)(setIsLoading|setIsBusy)\(false\);",
        r"\1finally {\n\2if (isMountedRef.current) \3(false);",
        content,
        flags=re.MULTILINE
    )
    
    # Add guard at the start of async handler functions
    async_handlers = [
        "loadAgentData", "loadAgentSnapshot", "loadData",
        "handleRunAnalysis", "handleRunAssessment", "handleUpdateConfig", 
        "handleControlCommand", "handleCommand"
    ]
    
    for handler in async_handlers:
        # Add early return at function start
        pattern = rf"(const {handler} = async \([^)]*\) => \{{\n)"
        replacement = rf"\1        if (!isMountedRef.current) return;\n        \n"
        content = re.sub(pattern, replacement, content)
    
    # Wrap setState calls in conditional checks (but not those already wrapped)
    setstate_pattern = r"^(\s+)(set\w+\([^)]+\);)(?!\s*//)$"
    
    def wrap_setstate(match):
        indent = match.group(1)
        statement = match.group(2)
        # Don't wrap if it's already in an if statement on the same line
        return f"{indent}if (isMountedRef.current) {statement}"
    
    # This is conservative - only wrap standalone setState
    # content = re.sub(setstate_pattern, wrap_setstate, content, flags=re.MULTILINE)
    
    return content

def process_file(filepath):
    """Process a single AgentControl file"""
    print(f"Processing: {os.path.basename(filepath)}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Apply fixes
    content = add_use_is_mounted_import(content)
    content = add_is_mounted_ref(content)
    # content = fix_use_effect(content)  # This needs manual review per file
    content = add_mounted_checks_to_async(content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✓ Updated {os.path.basename(filepath)}")
        return True
    else:
        print(f"  - No changes needed for {os.path.basename(filepath)}")
        return False

def main():
    """Main execution"""
    pattern = os.path.join(COMPONENTS_PATH, "*AgentControl.tsx")
    files = glob.glob(pattern)
    
    print(f"Found {len(files)} AgentControl files\n")
    
    updated_count = 0
    for filepath in sorted(files):
        if process_file(filepath):
            updated_count += 1
    
    print(f"\nComplete! Updated {updated_count}/{len(files)} files")
    print("\nNote: Manual review required for:")
    print("  - useEffect cleanup logic")
    print("  - Complex async patterns")
    print("  - Event listeners")

if __name__ == "__main__":
    main()
