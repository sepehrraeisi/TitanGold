import { readFileSync, writeFileSync } from 'fs';

const filePath = './server.js';
let content = readFileSync(filePath, 'utf8');

// Add import after other route imports
const importLine = `import marketProxyRoutes from './routes/market-proxy.js';`;
const afterImport = `import securityRoutes from './routes/security.js';`;

if (!content.includes(importLine)) {
  content = content.replace(afterImport, `${afterImport}\n${importLine}`);
  console.log('✅ Added market-proxy import');
} else {
  console.log('⚠️ Import already exists');
}

// Add route registration after other routes
const routeLine = `app.use('/api/market', marketProxyRoutes);`;
const afterRoute = `app.use('/api/ai-agents', aiAgentRoutes);`;

if (!content.includes(routeLine)) {
  content = content.replace(afterRoute, `${afterRoute}\n${routeLine}`);
  console.log('✅ Added market-proxy route');
} else {
  console.log('⚠️ Route already exists');
}

writeFileSync(filePath, content, 'utf8');
console.log('✅ server.js updated');
