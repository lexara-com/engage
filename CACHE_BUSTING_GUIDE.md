# Cache-Busting Guide for Conversations Page

## Problem
When accessing `dev.console.lexara.app/firm/conversations`, Cloudflare caching may serve an outdated version of the page, resulting in authentication errors despite being logged in.

## Solution
The conversations page now includes automatic cache-busting functionality:

1. **All filter operations** (search, status, practice area, assigned to) automatically append a `_cb` parameter with the current timestamp
2. **Pagination** (Previous/Next buttons) also includes the cache-busting parameter
3. This ensures you always get the latest version of the page, bypassing any cached versions

## Manual Cache-Busting
If you need to manually access the page with cache-busting:

```
https://dev.console.lexara.app/firm/conversations?_cb=<timestamp>
```

Example:
```
https://dev.console.lexara.app/firm/conversations?_cb=1751971899
```

## Version Tracking
The current version with cache-busting support is: `v5-2025-01-08-cache-bust`

You can verify the version in the Debug Information section at the bottom of the conversations page.

## How It Works
- Every navigation action (filtering, pagination) appends `_cb=<timestamp>` to the URL
- This parameter forces Cloudflare to bypass its cache and fetch the latest page
- The timestamp ensures each request is unique, preventing any caching issues

## Testing
1. Log in to the firm portal
2. Navigate to Conversations
3. Use any filter or pagination - the URL will automatically include `_cb` parameter
4. Check the Debug Information section to verify you're on version `v5-2025-01-08-cache-bust`