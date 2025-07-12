// Test dashboard with cache busting
const https = require('https');

console.log('🧪 Testing Dashboard with Cache Busting...');
console.log('=====================================\n');

// Create a test session
const sessionData = {
  userId: 'test_user_' + Date.now(),
  email: 'cache-test@example.com',
  name: 'Cache Test User',
  firmId: 'test_firm_' + Date.now(),
  firmName: 'Test Law Firm',
  roles: ['FirmAdmin'],
  isAuthenticated: true,
  exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours from now
};

const sessionCookie = `firm_session=${encodeURIComponent(JSON.stringify(sessionData))}`;
const timestamp = Date.now();

// Test URLs
const testUrls = [
  {
    name: 'Custom Domain with Cache Bust',
    url: `https://dev.console.lexara.app/firm/dashboard?_cb=${timestamp}`
  },
  {
    name: 'Direct URL Latest',
    url: `https://56e0cd67.lexara-firm-portal-dev.pages.dev/firm/dashboard`
  }
];

let testsCompleted = 0;
const totalTests = testUrls.length;

testUrls.forEach((testConfig, index) => {
  setTimeout(() => {
    console.log(`🔍 Test ${index + 1}: ${testConfig.name}`);
    console.log(`URL: ${testConfig.url}`);
    
    const urlObj = new URL(testConfig.url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Cookie': sessionCookie,
        'User-Agent': 'Lexara-Cache-Test/1.0',
        'Accept': 'text/html,application/xhtml+xml',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    };
    
    const req = https.request(options, (res) => {
      console.log(`Status: ${res.statusCode}`);
      console.log(`Cache Status: ${res.headers['cf-cache-status'] || 'N/A'}`);
      console.log(`Cache Control: ${res.headers['cache-control'] || 'N/A'}`);
      console.log(`X-Dashboard-Version: ${res.headers['x-dashboard-version'] || 'N/A'}`);
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        // Check for key indicators
        const checks = [
          { name: 'New Components', indicator: 'metric-card' },
          { name: 'Recent Conversations', indicator: 'Recent Conversations' },
          { name: 'System Status', indicator: 'System Status' },
          { name: 'Grid Layout', indicator: 'lg:col-span-2' }
        ];
        
        console.log('\nComponent checks:');
        checks.forEach(check => {
          if (data.includes(check.indicator)) {
            console.log(`  ✅ ${check.name}`);
          } else {
            console.log(`  ❌ ${check.name}`);
          }
        });
        
        console.log('\n' + '-'.repeat(50) + '\n');
        
        testsCompleted++;
        if (testsCompleted === totalTests) {
          console.log('✨ All tests complete!\n');
          console.log('💡 Recommendations:');
          console.log('1. If custom domain still shows old version, use Cloudflare dashboard to:');
          console.log('   - Enable Development Mode (3 hours cache bypass)');
          console.log('   - Or create a Page Rule to bypass cache for dev.console.lexara.app/*');
          console.log('2. Direct deployment URL should always show the latest version');
          console.log('3. Use cache-busting parameters (?_cb=timestamp) for immediate access');
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`❌ Error: ${error.message}`);
      testsCompleted++;
    });
    
    req.end();
  }, index * 1000); // Stagger requests
});