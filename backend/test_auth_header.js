import http from 'http';

console.log('🧪 Testing Authorization Header Forwarding\n');

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

console.log('📤 Sending request to backend (direct, bypassing Nginx):');
console.log('   URL: http://localhost:5002/api/health');
console.log('   Header: Authorization: Bearer test-token-123\n');

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📥 Response received:');
    console.log('   Status:', res.statusCode);
    console.log('   Body:', data);
    
    if (res.statusCode === 200) {
      console.log('\n✅ Backend is accepting requests directly');
      console.log('✅ No auth required for /health (expected)\n');
      
      console.log('🎯 Next: Test from browser with real token');
      console.log('   1. Open https://titan.zala.ir');
      console.log('   2. Login');
      console.log('   3. DevTools → Network → POST /api/ai-agents/.../run');
      console.log('   4. Check Request Headers for: Authorization: Bearer ...');
      console.log('   5. Check Response status (should be 200, not 401)\n');
    } else {
      console.log('\n❌ Unexpected status code');
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Request failed:', err.message);
});

req.end();
