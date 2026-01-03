// Test API Integration - GET /api/ai-agents
import http from 'http';

async function testAPI() {
  console.log('🧪 Testing GET /api/ai-agents (without auth)...\n');
  
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
        console.log(`📊 Status: ${res.statusCode}`);
        
        if (res.statusCode === 401) {
          console.log('✅ Authentication required (expected)');
          console.log('   Response:', data.substring(0, 100));
          resolve();
          return;
        }
        
        try {
          const agents = JSON.parse(data);
          console.log(`✅ Agents received: ${agents.length}`);
          
          if (agents.length > 0) {
            const agent = agents[0];
            console.log('\n📋 First Agent:');
            console.log(`   ID: ${agent.id}`);
            console.log(`   Agent Key: ${agent.agent_key || 'MISSING'}`);
            console.log(`   Name: ${agent.name}`);
            console.log(`   Role: ${agent.role || 'MISSING'}`);
            console.log(`   Status: ${agent.status}`);
            console.log(`   Capabilities: ${agent.capabilities?.length || 0}`);
          }
          
          resolve();
        } catch (err) {
          console.error('❌ Failed to parse response:', err.message);
          reject(err);
        }
      });
    });
    
    req.on('error', (err) => {
      console.error('❌ Request failed:', err.message);
      reject(err);
    });
    
    req.end();
  });
}

testAPI()
  .then(() => {
    console.log('\n✅ API test complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ API test failed:', err);
    process.exit(1);
  });
