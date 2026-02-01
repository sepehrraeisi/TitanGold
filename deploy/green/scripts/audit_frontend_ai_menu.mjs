#!/usr/bin/env node

/**
 * Audit Frontend AI Menu
 * Scans components directory for AI-related menus and navigation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const COMPONENTS_DIR = path.join(PROJECT_ROOT, 'components');

// Patterns to identify AI menu items
const AI_PATTERNS = [
  'AI',
  'Agent',
  'Autopilot',
  'Prediction',
  'Training',
  'Artemis',
  'Decision',
  'Backtesting'
];

const results = {
  aiComponents: [],
  menuItems: [],
  routes: []
};

function scanDirectory(dir, prefix = '') {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    const relativePath = path.relative(COMPONENTS_DIR, fullPath);

    if (stat.isDirectory()) {
      scanDirectory(fullPath, relativePath + '/');
    } else if (item.endsWith('.tsx') || item.endsWith('.jsx')) {
      // Check if filename matches AI patterns
      const isAIRelated = AI_PATTERNS.some(pattern => 
        item.includes(pattern) || relativePath.includes(pattern)
      );

      if (isAIRelated) {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        results.aiComponents.push({
          file: relativePath,
          path: fullPath,
          size: stat.size,
          hasAPI: content.includes('/api/'),
          hasState: content.includes('useState') || content.includes('useEffect'),
          imports: extractImports(content)
        });
      }
    }
  }
}

function extractImports(content) {
  const imports = [];
  const importRegex = /import\s+.*from\s+['"](.+)['"]/g;
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return imports.filter(imp => 
    imp.startsWith('./') || imp.startsWith('../') || imp.startsWith('/')
  );
}

function generateReport() {
  console.log('=== AI Menu Audit Report ===\n');
  console.log(`Found ${results.aiComponents.length} AI-related components\n`);

  const byCategory = {};
  results.aiComponents.forEach(comp => {
    const category = comp.file.split('/')[0];
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push(comp);
  });

  for (const [category, components] of Object.entries(byCategory)) {
    console.log(`\n## ${category.toUpperCase()}`);
    components.forEach(comp => {
      console.log(`  - ${comp.file}`);
      console.log(`    API: ${comp.hasAPI ? 'YES' : 'NO'} | State: ${comp.hasState ? 'YES' : 'NO'}`);
    });
  }

  // Save JSON
  const outputPath = path.join(PROJECT_ROOT, 'AI_MENU_COMPONENTS.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Full report saved to: AI_MENU_COMPONENTS.json`);
}

// Run scan
scanDirectory(COMPONENTS_DIR);
generateReport();
