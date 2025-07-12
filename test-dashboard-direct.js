// Test dashboard components against direct deployment URL
const https = require('https');

console.log('🧪 Testing Dashboard Components (Direct URL)...');

// Create a test session
const sessionData = {
  userId: 'test_user_' + Date.now(),
  email: 'dashboard-test@example.com',
  name: 'Dashboard Test User',
  firmId: 'test_firm_' + Date.now(),
  firmName: 'Test Law Firm',
  roles: ['FirmAdmin'],
  isAuthenticated: true,
  exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours from now
};

const sessionCookie = `firm_session=${encodeURIComponent(JSON.stringify(sessionData))}`;

// Test against direct deployment URL
const directUrl = 'https://da4a8324.lexara-firm-portal-dev.pages.dev/firm/dashboard';

const options = {
  method: 'GET',
  headers: {
    'Cookie': sessionCookie,
    'User-Agent': 'Lexara-Dashboard-Test/1.0',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
};

const req = https.request(directUrl, options, (res) => {
  console.log('\n📊 Dashboard Response (Direct URL):');
  console.log('Status:', res.statusCode);
  console.log('URL:', directUrl);
  
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Dashboard loaded successfully');
      
      // Check for key components
      const components = [
        { name: 'WelcomeSection', indicator: 'Welcome back' },
        { name: 'MetricsCards', indicator: 'metric-card' },
        { name: 'RecentConversations', indicator: 'Recent Conversations' },
        { name: 'CustomizeIntake', indicator: 'Customize Intake' },
        { name: 'QuickActions', indicator: 'Quick Actions' },
        { name: 'SystemStatus', indicator: 'System Status' }
      ];
      
      console.log('\n🔍 Component Verification:');
      components.forEach(component => {
        if (data.includes(component.indicator)) {
          console.log(`✅ ${component.name} - Found`);
        } else {
          console.log(`❌ ${component.name} - Not found`);
        }
      });
      
      // Check for specific component HTML
      console.log('\n🎯 Detailed Component Check:');
      if (data.includes('class="metric-card"')) {
        console.log('✅ Metric cards HTML found');
      }
      if (data.includes('Recent Conversations')) {
        console.log('✅ Recent Conversations text found');
      }
      if (data.includes('lg:col-span-2')) {
        console.log('✅ Grid layout classes found');
      }
      
      // Save a snippet of the response for debugging
      const snippet = data.substring(0, 500);
      console.log('\n📝 Response preview:');
      console.log(snippet + '...');
      
    } else {
      console.log('❌ Dashboard returned unexpected status:', res.statusCode);
    }
    
    console.log('\n✨ Dashboard test complete!');
  });
});

req.on('error', (error) => {
  console.error('❌ Dashboard request error:', error);
});

req.end();