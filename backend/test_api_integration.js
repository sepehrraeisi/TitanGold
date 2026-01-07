// Test API Integration - GET /api/ai-agents
import http from 'http';
import { logger } from './services/logger.js';

async function testAPI() {
  logger.info('🧪 Testing GET /api/ai-agents (without auth)...\n');
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5002,
      path: '/api/ai-agents',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        logger.info(`📊 Status: ${res.statusCode}`);
        
        if (res.statusCode === 401) {
          logger.info('✅ Authentication required (expected)');
          logger.info('   Response:', data.substring(0, 100));
          resolve();
          return;
        }
        
        try {
          const agents = JSON.parse(data);
          logger.info(`✅ Agents received: ${agents.length}`);
          
          if (agents.length > 0) {
            const agent = agents[0];
            logger.info('\n📋 First Agent:');
            logger.info(`   ID: ${agent.id}`);
            logger.info(`   Agent Key: ${agent.agent_key || 'MISSING'}`);
            logger.info(`   Name: ${agent.name}`);
            logger.info(`   Role: ${agent.role || 'MISSING'}`);
            logger.info(`   Status: ${agent.status}`);
            logger.info(`   Capabilities: ${agent.capabilities?.length || 0}`);
          }
          
          resolve();
        } catch (err) {
          logger.error('❌ Failed to parse response:', err.message);
          reject(err);
        }
      });
    });
    
    req.on('error', (err) => {
      logger.error('❌ Request failed:', err.message);
      reject(err);
    });
    
    req.end();
  });
}

testAPI()
  .then(() => {
    logger.info('\n✅ API test complete');
    process.exit(0);
  })
  .catch((err) => {
    logger.error('\n❌ API test failed:', err);
    process.exit(1);
  });
