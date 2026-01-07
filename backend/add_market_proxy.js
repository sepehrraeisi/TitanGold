import { readFileSync, writeFileSync } from 'fs';
import { logger } from './services/logger.js';

const filePath = './server.js';
let content = readFileSync(filePath, 'utf8');

// Add import after other route imports
const importLine = `import marketProxyRoutes from './routes/market-proxy.js';`;
const afterImport = `import securityRoutes from './routes/security.js';`;

if (!content.includes(importLine)) {
  content = content.replace(afterImport, `${afterImport}\n${importLine}`);
  logger.info('✅ Added market-proxy import');
} else {
  logger.info('⚠️ Import already exists');
}

// Add route registration after other routes
const routeLine = `app.use('/api/market', marketProxyRoutes);`;
const afterRoute = `app.use('/api/ai-agents', aiAgentRoutes);`;

if (!content.includes(routeLine)) {
  content = content.replace(afterRoute, `${afterRoute}\n${routeLine}`);
  logger.info('✅ Added market-proxy route');
} else {
  logger.info('⚠️ Route already exists');
}

writeFileSync(filePath, content, 'utf8');
logger.info('✅ server.js updated');
