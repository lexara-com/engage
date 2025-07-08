#!/usr/bin/env node

/**
 * Test script to verify conversations page authentication is working
 */

const https = require('https');

// Test data
const testSession = {
  userId: "test_user_" + Date.now(),
  email: "test@example.com",
  name: "Test User",
  firmId: "test_firm_" + Date.now(),
  firmName: "Test Firm",
  roles: ["FirmAdmin"],
  isAuthenticated: true,
  exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours from now (Unix timestamp)
};

// Encode session as cookie
const sessionCookie = `firm_session=${encodeURIComponent(JSON.stringify(testSession))}`;

console.log("Testing conversations page with session:", testSession);

// Test both custom domain and direct deployment URL
const cacheBuster = Date.now();
const tests = [
  {
    name: 'Custom domain (dev.console.lexara.app)',
    hostname: 'dev.console.lexara.app',
    path: `/firm/conversations?_cb=${cacheBuster}`
  },
  {
    name: 'Direct deployment URL',
    hostname: 'c12e903c.lexara-firm-portal-dev.pages.dev',
    path: `/firm/conversations?_cb=${cacheBuster}`
  }
];

// Test function
function testUrl(config) {
  const options = {
    hostname: config.hostname,
    path: config.path,
    method: 'GET',
    headers: {
      'Cookie': sessionCookie,
      'User-Agent': 'Mozilla/5.0 (Test Script)',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  };

  https.get(options, (res) => {
    console.log('\n' + config.name + ':');
    console.log('Status:', res.statusCode);
    console.log('Location:', res.headers.location);
    
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        // Check if we got the conversations page
        if (body.includes('Conversations') && body.includes('v3-no-cache')) {
          console.log('✅ SUCCESS: Conversations page loaded with new version');
          console.log('Found version marker: v3-no-cache');
          
          // Check for conversation data
          if (body.includes('Sarah Johnson')) {
            console.log('✅ Mock conversation data is displayed');
          } else if (body.includes('No conversations found')) {
            console.log('✅ Page loaded but no conversations (expected for new session)');
          } else if (body.includes('Authentication required')) {
            console.log('❌ FAIL: Authentication error on page');
          }
        } else if (body.includes('Conversations') && !body.includes('v3-no-cache')) {
          console.log('⚠️  WARNING: Old version still being served (cache issue)');
          // Look for version marker
          const versionMatch = body.match(/"version":\s*"([^"]+)"/);
          if (versionMatch) {
            console.log('Current version:', versionMatch[1]);
          }
        } else {
          console.log('❌ FAIL: Did not get conversations page');
        }
      } else if (res.statusCode === 302) {
        console.log('❌ FAIL: Redirected to login (authentication failed)');
      } else {
        console.log('❌ FAIL: Unexpected status code');
      }
      
      // Show first 500 chars of response
      console.log('\nResponse preview:');
      console.log(body.substring(0, 500) + '...');
    });
  }).on('error', (err) => {
    console.error('Request error:', err);
  });
}

// Run tests sequentially
testUrl(tests[0]);
setTimeout(() => testUrl(tests[1]), 2000);