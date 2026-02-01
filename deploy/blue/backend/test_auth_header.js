import http from 'http';
import { logger } from './services/logger.js';

logger.info('🧪 Testing Authorization Header Forwarding\n');

// Simulate request WITH Authorization header
const options = {
  hostname: 'localhost',
  port: 5002,
  path: '/api/health',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer test-token-123'
  }
};

logger.info('📤 Sending request to backend (direct, bypassing Nginx):');
logger.info('   URL: http://localhost:5002/api/health');
logger.info('   Header: Authorization: Bearer test-token-123\n');

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    logger.info('📥 Response received:');
    logger.info('   Status:', res.statusCode);
    logger.info('   Body:', data);
    
    if (res.statusCode === 200) {
      logger.info('\n✅ Backend is accepting requests directly');
      logger.info('✅ No auth required for /health (expected)\n');
      
      logger.info('🎯 Next: Test from browser with real token');
      logger.info('   1. Open https://titan.zala.ir');
      logger.info('   2. Login');
      logger.info('   3. DevTools → Network → POST /api/ai-agents/.../run');
      logger.info('   4. Check Request Headers for: Authorization: Bearer ...');
      logger.info('   5. Check Response status (should be 200, not 401)\n');
    } else {
      logger.info('\n❌ Unexpected status code');
    }
  });
});

req.on('error', (err) => {
  logger.error('❌ Request failed:', err.message);
});

req.end();
