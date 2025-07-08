#!/usr/bin/env node

async function testAPI() {
  const baseUrl = 'https://dev.console.lexara.app';
  
  // Create a mock session
  const mockSession = {
    userId: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    firmId: 'test-firm-123',
    roles: ['User'],
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
    isAuthenticated: true
  };

  const sessionCookie = `firm_session=${encodeURIComponent(JSON.stringify(mockSession))}`;
  
  console.log('Testing API with session cookie...\n');
  console.log('Cookie:', sessionCookie.substring(0, 100) + '...\n');
  
  try {
    const response = await fetch(`${baseUrl}/api/firm/conversations`, {
      headers: {
        'Cookie': sessionCookie
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('\nResponse body:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPI();