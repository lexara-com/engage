/**
 * Extract Auth0 Token from Browser Session
 * 
 * Run this script in Chrome DevTools Console on any Lexara page
 * where you're logged in to get your current Auth0 token
 */

(async function extractAuth0Token() {
  console.log('🔍 Extracting Auth0 token from browser session...');
  
  try {
    // Method 1: Check localStorage for Auth0 cache
    const auth0Keys = Object.keys(localStorage).filter(key => 
      key.includes('auth0') || key.includes('@@auth0spajs@@')
    );
    
    if (auth0Keys.length > 0) {
      console.log('📦 Found Auth0 cache keys:', auth0Keys);
      
      for (const key of auth0Keys) {
        try {
          const cacheData = JSON.parse(localStorage.getItem(key));
          if (cacheData && cacheData.body && cacheData.body.access_token) {
            console.log('✅ Found access token in cache!');
            console.log('🔑 Token:', cacheData.body.access_token);
            console.log('⏰ Expires:', new Date(cacheData.body.expires_in * 1000 + Date.now()));
            return cacheData.body.access_token;
          }
        } catch (e) {
          console.log('⚠️ Could not parse cache entry:', key);
        }
      }
    }
    
    // Method 2: Try to get token from global auth0Client if available
    if (typeof auth0Client !== 'undefined' && auth0Client) {
      console.log('🔧 Found global auth0Client, attempting to get token...');
      try {
        const token = await auth0Client.getTokenSilently();
        console.log('✅ Got token from auth0Client!');
        console.log('🔑 Token:', token);
        return token;
      } catch (error) {
        console.log('❌ Failed to get token from auth0Client:', error.message);
      }
    }
    
    // Method 3: Initialize Auth0 client and get token
    if (typeof auth0 !== 'undefined') {
      console.log('🔧 Initializing Auth0 client to get fresh token...');
      try {
        const client = await auth0.createAuth0Client({
          domain: 'dev-sv0pf6cz2530xz0o.us.auth0.com',
          clientId: 'OjsR6To3nDqYDLVHtRjDFpk7wRcCfrfi',
          authorizationParams: {
            redirect_uri: window.location.origin + '/firm/callback'
          },
          cacheLocation: 'localstorage',
          useRefreshTokens: false
        });
        
        const isAuth = await client.isAuthenticated();
        if (isAuth) {
          const token = await client.getTokenSilently();
          console.log('✅ Got fresh token!');
          console.log('🔑 Token:', token);
          return token;
        } else {
          console.log('❌ User is not authenticated');
        }
      } catch (error) {
        console.log('❌ Failed to initialize Auth0 client:', error.message);
      }
    }
    
    // Method 4: Check sessionStorage
    console.log('📦 Checking sessionStorage...');
    const sessionKeys = Object.keys(sessionStorage).filter(key => 
      key.includes('auth0') || key.includes('token')
    );
    
    if (sessionKeys.length > 0) {
      console.log('📦 Found session keys:', sessionKeys);
      for (const key of sessionKeys) {
        const value = sessionStorage.getItem(key);
        console.log(`📝 ${key}:`, value);
      }
    }
    
    console.log('❌ Could not find Auth0 token in browser session');
    console.log('💡 Try navigating to https://dev-www.lexara.app/firm/settings and running this script again');
    
  } catch (error) {
    console.error('❌ Error extracting token:', error);
  }
})();

// Alternative: Copy this one-liner to console
console.log(`
🔄 Quick one-liner (copy and paste this):

Object.keys(localStorage).filter(k=>k.includes('auth0')).forEach(k=>{try{const d=JSON.parse(localStorage[k]);if(d.body?.access_token)console.log('Token:',d.body.access_token)}catch(e){}})
`);