#!/usr/bin/env node

// Script to purge Cloudflare cache for dev.console.lexara.app
// This uses the Cloudflare API to purge specific URLs

const https = require('https');

console.log('🧹 Cloudflare Cache Purge Script');
console.log('================================\n');

// URLs to purge
const urlsToPurge = [
  'https://dev.console.lexara.app/firm/dashboard',
  'https://dev.console.lexara.app/firm/dashboard/',
  'https://dev.console.lexara.app/*'
];

console.log('URLs to purge:');
urlsToPurge.forEach(url => console.log(`  - ${url}`));
console.log('');

// Note: In production, you'd need Cloudflare API credentials
console.log('⚠️  Note: To use the Cloudflare API for cache purging, you need:');
console.log('   1. Zone ID from Cloudflare dashboard');
console.log('   2. API Token with "Zone:Cache Purge" permission');
console.log('');
console.log('Alternative methods to clear cache immediately:\n');

console.log('1️⃣  Manual URL Parameters:');
console.log(`   https://dev.console.lexara.app/firm/dashboard?_cb=${Date.now()}`);
console.log(`   https://dev.console.lexara.app/firm/dashboard?v=${Date.now()}`);
console.log('');

console.log('2️⃣  Cloudflare Dashboard:');
console.log('   1. Go to Cloudflare dashboard → Your domain');
console.log('   2. Navigate to Caching → Configuration');
console.log('   3. Click "Purge Cache" → "Custom Purge"');
console.log('   4. Enter: https://dev.console.lexara.app/*');
console.log('');

console.log('3️⃣  Development Mode:');
console.log('   1. In Cloudflare dashboard → Caching → Configuration');
console.log('   2. Enable "Development Mode" (bypasses cache for 3 hours)');
console.log('');

console.log('4️⃣  Page Rules (Permanent Solution):');
console.log('   1. Go to Rules → Page Rules');
console.log('   2. Create rule for: dev.console.lexara.app/*');
console.log('   3. Set "Cache Level" to "Bypass"');
console.log('');

console.log('5️⃣  Transform Rules (Modern Alternative):');
console.log('   1. Go to Rules → Transform Rules → Modify Response Header');
console.log('   2. Create rule for hostname equals "dev.console.lexara.app"');
console.log('   3. Set header "Cache-Control" to "no-cache, no-store, max-age=0"');
console.log('');

console.log('6️⃣  Browser Testing:');
console.log('   - Hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)');
console.log('   - Open in Incognito/Private mode');
console.log('   - Clear browser cache for the domain');
console.log('');

console.log('✅ For immediate testing, use this URL:');
console.log(`   https://dev.console.lexara.app/firm/dashboard?_cb=${Date.now()}`);
console.log('');

// If you have Cloudflare API credentials, uncomment and use this:
/*
const ZONE_ID = 'your-zone-id';
const API_TOKEN = 'your-api-token';

const data = JSON.stringify({
  files: urlsToPurge
});

const options = {
  hostname: 'api.cloudflare.com',
  port: 443,
  path: `/client/v4/zones/${ZONE_ID}/purge_cache`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => responseData += chunk);
  res.on('end', () => {
    const result = JSON.parse(responseData);
    if (result.success) {
      console.log('✅ Cache purged successfully!');
    } else {
      console.log('❌ Cache purge failed:', result.errors);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error);
});

req.write(data);
req.end();
*/