import fetch from 'node-fetch';
import { logger } from './services/logger.js';

async function testAPIResponse() {
  try {
    logger.info('\n🔍 Testing API response structure...\n');
    
    // First, login to get token
    logger.info('1️⃣ Login...');
    const loginResponse = await fetch('https://titan.zala.ir/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'testuser',
        password: 'Test@123456'
      })
    });
    
    const loginData = await loginResponse.json();
    logger.info('Login Status:', loginResponse.status);
    
    if (!loginData.token) {
      logger.info('❌ Login failed!');
      logger.info('Response:', JSON.stringify(loginData, null, 2));
      return;
    }
    
    logger.info('✅ Login successful!');
    logger.info('Token:', loginData.token.substring(0, 20) + '...');
    
    // Get AI Agents list
    logger.info('\n2️⃣ Get AI Agents...');
    const agentsResponse = await fetch('https://titan.zala.ir/api/ai-agents', {
      headers: {
        'Authorization': `Bearer ${loginData.token}`,
      }
    });
    
    const agentsData = await agentsResponse.json();
    logger.info('Agents Status:', agentsResponse.status);
    logger.info('Agents Count:', agentsData.agents?.length || 0);
    
    if (agentsData.agents && agentsData.agents.length > 0) {
      const technicalAgent = agentsData.agents.find(a => 
        a.agent_key === 'technical' || a.type === 'technical'
      );
      
      if (technicalAgent) {
        logger.info('\n3️⃣ Run Technical Analysis Agent...');
        logger.info('Agent ID:', technicalAgent.id);
        logger.info('Agent Key:', technicalAgent.agent_key);
        
        const runResponse = await fetch(`https://titan.zala.ir/api/ai-agents/${technicalAgent.id}/run`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${loginData.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            symbol: 'BTC/USDT',
            timeframe: '1h'
          })
        });
        
        const runData = await runResponse.json();
        logger.info('\n📊 Run Response:');
        logger.info('Status:', runResponse.status);
        logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        logger.info(JSON.stringify(runData, null, 2));
        logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Check critical fields
        logger.info('\n🔬 Response Analysis:');
        logger.info('✓ response.ok:', runData.ok);
        logger.info('✓ response.indicators:', Array.isArray(runData.indicators) ? `Array[${runData.indicators.length}]` : typeof runData.indicators);
        logger.info('✓ response.result:', typeof runData.result);
        logger.info('✓ response.result.indicators:', runData.result ? (Array.isArray(runData.result.indicators) ? `Array[${runData.result.indicators?.length}]` : typeof runData.result.indicators) : 'N/A');
        
        if (!Array.isArray(runData.indicators)) {
          logger.info('\n❌ PROBLEM: indicators is not an array!');
          logger.info('Type:', typeof runData.indicators);
          logger.info('Value:', runData.indicators);
        } else {
          logger.info('\n✅ indicators is Array - UI should work!');
        }
      }
    }
    
  } catch (error) {
    logger.error('❌ Error:', error.message);
    logger.error('Stack:', error.stack);
  }
}

testAPIResponse();
