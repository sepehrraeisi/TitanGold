#!/usr/bin/env node

/**
 * Audit Backend API Routes
 * Lists all Express routes under /api/*
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ROUTES_DIR = path.join(PROJECT_ROOT, 'backend', 'routes');

const results = {
  routes: [],
  byCategory: {}
};

function scanRoutes() {
  const files = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js'));

  files.forEach(file => {
    const filePath = path.join(ROUTES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Extract route definitions
    const routePattern = /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    
    const routeName = file.replace('.js', '');
    const routes = [];
    
    while ((match = routePattern.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const path = match[2];
      
      routes.push({
        method,
        path,
        fullPath: `/api/${routeName}${path}`
      });
    }
    
    if (routes.length > 0) {
      results.routes.push({
        file,
        routeName,
        count: routes.length,
        routes
      });
      
      results.byCategory[routeName] = routes;
    }
  });
}

function generateReport() {
  console.log('=== Backend API Routes Audit ===\n');
  
  const totalRoutes = results.routes.reduce((sum, r) => sum + r.count, 0);
  console.log(`Found ${results.routes.length} route files with ${totalRoutes} endpoints\n`);

  // AI-related routes
  const aiRoutes = results.routes.filter(r => 
    r.routeName.includes('ai') || 
    r.routeName.includes('agent') ||
    r.routeName.includes('artemis') ||
    r.routeName.includes('autopilot') ||
    r.routeName.includes('training') ||
    r.routeName.includes('backtest')
  );

  console.log('## AI-Related Routes\n');
  aiRoutes.forEach(r => {
    console.log(`### ${r.file} (${r.count} endpoints)`);
    r.routes.forEach(route => {
      console.log(`  ${route.method.padEnd(7)} ${route.fullPath}`);
    });
    console.log('');
  });

  // All routes summary
  console.log('\n## All Routes Summary\n');
  results.routes
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
    .forEach(r => {
      console.log(`  ${r.routeName.padEnd(25)} ${r.count} endpoints`);
    });

  // Save JSON
  const outputPath = path.join(PROJECT_ROOT, 'BACKEND_ROUTES.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Full report saved to: BACKEND_ROUTES.json`);
}

scanRoutes();
generateReport();
