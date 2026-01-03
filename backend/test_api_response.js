import fetch from 'node-fetch';

async function testAPIResponse() {
  try {
    console.log('\n🔍 Testing API response structure...\n');
    
    // First, login to get token
    console.log('1️⃣ Login...');
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
    console.log('Login Status:', loginResponse.status);
    
    if (!loginData.token) {
      console.log('❌ Login failed!');
      console.log('Response:', JSON.stringify(loginData, null, 2));
      return;
    }
    
    console.log('✅ Login successful!');
    console.log('Token:', loginData.token.substring(0, 20) + '...');
    
    // Get AI Agents list
    console.log('\n2️⃣ Get AI Agents...');
    const agentsResponse = await fetch('https://titan.zala.ir/api/ai-agents', {
      headers: {
        'Authorization': `Bearer ${loginData.token}`,
      }
    });
    
    const agentsData = await agentsResponse.json();
    console.log('Agents Status:', agentsResponse.status);
    console.log('Agents Count:', agentsData.agents?.length || 0);
    
    if (agentsData.agents && agentsData.agents.length > 0) {
      const technicalAgent = agentsData.agents.find(a => 
        a.agent_key === 'technical' || a.type === 'technical'
      );
      
      if (technicalAgent) {
        console.log('\n3️⃣ Run Technical Analysis Agent...');
        console.log('Agent ID:', technicalAgent.id);
        console.log('Agent Key:', technicalAgent.agent_key);
        
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
        console.log('\n📊 Run Response:');
        console.log('Status:', runResponse.status);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(JSON.stringify(runData, null, 2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Check critical fields
        console.log('\n🔬 Response Analysis:');
        console.log('✓ response.ok:', runData.ok);
        console.log('✓ response.indicators:', Array.isArray(runData.indicators) ? `Array[${runData.indicators.length}]` : typeof runData.indicators);
        console.log('✓ response.result:', typeof runData.result);
        console.log('✓ response.result.indicators:', runData.result ? (Array.isArray(runData.result.indicators) ? `Array[${runData.result.indicators?.length}]` : typeof runData.result.indicators) : 'N/A');
        
        if (!Array.isArray(runData.indicators)) {
          console.log('\n❌ PROBLEM: indicators is not an array!');
          console.log('Type:', typeof runData.indicators);
          console.log('Value:', runData.indicators);
        } else {
          console.log('\n✅ indicators is Array - UI should work!');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAPIResponse();
