#!/usr/bin/env node

/**
 * Test authentication flow for dev.console.lexara.app
 */

async function testAuth() {
  const baseUrl = 'https://dev.console.lexara.app';
  
  console.log('🔍 Testing authentication flow...\n');
  
  // Test 1: Access protected route without auth
  console.log('1️⃣ Testing access to /firm/conversations without auth...');
  try {
    const response = await fetch(`${baseUrl}/firm/conversations`, {
      redirect: 'manual'
    });
    
    if (response.status === 302 || response.status === 303) {
      const location = response.headers.get('location');
      console.log(`✅ Correctly redirected to: ${location}`);
      console.log(`   Expected: /firm/login?returnTo=...`);
    } else {
      console.log(`❌ Unexpected response: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Test 2: Access API without auth
  console.log('\n2️⃣ Testing API access without auth...');
  try {
    const response = await fetch(`${baseUrl}/api/firm/conversations`);
    const data = await response.json();
    
    if (response.status === 401) {
      console.log(`✅ API correctly returned 401 Unauthorized`);
      console.log(`   Response: ${JSON.stringify(data)}`);
    } else {
      console.log(`❌ Unexpected response: ${response.status}`);
      console.log(`   Data: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Test 3: Check if login page is accessible
  console.log('\n3️⃣ Testing access to login page...');
  try {
    const response = await fetch(`${baseUrl}/firm/login`);
    
    if (response.ok) {
      console.log(`✅ Login page accessible: ${response.status}`);
    } else {
      console.log(`❌ Login page not accessible: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Test 4: Check dashboard redirect
  console.log('\n4️⃣ Testing dashboard redirect without auth...');
  try {
    const response = await fetch(`${baseUrl}/firm/dashboard`, {
      redirect: 'manual'
    });
    
    if (response.status === 302 || response.status === 303) {
      const location = response.headers.get('location');
      console.log(`✅ Dashboard correctly redirected to: ${location}`);
    } else {
      console.log(`❌ Unexpected response: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  console.log('\n✨ Authentication flow test complete!');
}

// Run the test
testAuth().catch(console.error);