// Test dashboard components
const https = require('https');

console.log('🧪 Testing Dashboard Components...');

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

// Test dashboard page
const dashboardUrl = 'https://dev.console.lexara.app/firm/dashboard';

const dashboardOptions = {
  method: 'GET',
  headers: {
    'Cookie': sessionCookie,
    'User-Agent': 'Lexara-Dashboard-Test/1.0'
  }
};

const dashboardReq = https.request(dashboardUrl, dashboardOptions, (res) => {
  console.log('\n📊 Dashboard Response:');
  console.log('Status:', res.statusCode);
  console.log('Location:', res.headers.location);
  
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
      
      // Check for user personalization
      if (data.includes(sessionData.name)) {
        console.log('✅ User personalization working');
      } else {
        console.log('❌ User personalization not working');
      }
      
      // Check for responsive classes
      const responsivePatterns = [
        'grid-cols-1',
        'md:grid-cols-2', 
        'lg:grid-cols-4',
        'lg:col-span-2'
      ];
      
      console.log('\n📱 Responsive Design:');
      responsivePatterns.forEach(pattern => {
        if (data.includes(pattern)) {
          console.log(`✅ ${pattern} - Found`);
        } else {
          console.log(`❌ ${pattern} - Missing`);
        }
      });
      
    } else if (res.statusCode === 302 || res.statusCode === 307) {
      console.log('❌ Dashboard redirected - authentication issue');
    } else {
      console.log('❌ Dashboard returned unexpected status:', res.statusCode);
    }
    
    console.log('\n✨ Dashboard test complete!');
  });
});

dashboardReq.on('error', (error) => {
  console.error('❌ Dashboard request error:', error);
});

dashboardReq.end();