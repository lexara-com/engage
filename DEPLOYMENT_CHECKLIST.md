# Deployment Verification Checklist

## Pre-Deployment Checks
1. **Identify target environment and branch**
   - [ ] Confirm which branch the custom domain points to (usually main/production)
   - [ ] Verify if deploying to correct branch for the environment
   - [ ] Check DNS/domain configuration in Cloudflare dashboard if uncertain

2. **Build verification**
   - [ ] Run build locally first
   - [ ] Check for any build warnings or errors
   - [ ] Verify all new files are included in the build output

## Deployment Process
1. **Deploy to correct branch**
   ```bash
   # For production/custom domains - deploy to main
   npx wrangler pages deploy dist --project-name=lexara-firm-portal-dev --branch=main
   
   # For testing - deploy to feature branch
   npx wrangler pages deploy dist --project-name=lexara-firm-portal-dev
   ```

2. **Record deployment details**
   - [ ] Note the deployment URL
   - [ ] Note which branch was deployed
   - [ ] Check if this is Preview or Production deployment

## Post-Deployment Verification

### 1. Test the ACTUAL custom domain (not preview URL)
```bash
# Test the specific feature on the custom domain
curl -I https://dev.console.lexara.app/[new-endpoint]

# Don't just test the preview URL - it's on a different branch!
# ❌ BAD: Only testing https://abc123.project.pages.dev
# ✅ GOOD: Testing https://dev.console.lexara.app
```

### 2. Verify critical paths
- [ ] Test the new feature/endpoint on custom domain
- [ ] Verify authentication still works (if applicable)
- [ ] Check that existing features weren't broken
- [ ] Test both success and error cases

### 3. Check deployment status
```bash
# List recent deployments to verify which is active
npx wrangler pages deployment list --project-name=lexara-firm-portal-dev

# Check which deployment the custom domain is using
# This requires checking Cloudflare dashboard or asking user
```

## Common Pitfalls to Avoid

1. **Branch Mismatch**
   - Custom domains usually point to main/production branch
   - Feature branch deployments get preview URLs only
   - Always deploy to the branch that the custom domain uses

2. **Assuming Deployment = Live**
   - Successful deployment ≠ Live on custom domain
   - Always verify on the actual URL users will access
   - Test the specific endpoints that were changed

3. **Not Testing Authentication-Required Features**
   - Pages.dev URLs won't work with Auth0 (different domain)
   - Must test through proper custom domain
   - Verify cookies/sessions work correctly

## Communication Standards

When reporting deployment status:
- ❌ "Deployed successfully!" (too vague)
- ✅ "Deployed to main branch. The logout page is now live at https://dev.console.lexara.app/firm/logout. Verified it returns 302 redirect and clears cookies."

Always include:
1. Which branch was deployed to
2. The actual URL where changes are live
3. What was specifically tested and verified
4. Any limitations (e.g., "Auth0 only works on custom domain")

## Senior Engineer Mindset

1. **Think about the full system**
   - How do deployments map to domains?
   - What are the authentication constraints?
   - Which branch serves production traffic?

2. **Verify, don't assume**
   - Test the actual user-facing URL
   - Verify the specific feature deployed
   - Check edge cases and error conditions

3. **Communicate precisely**
   - State exactly what was deployed where
   - Be explicit about what will and won't work
   - Proactively mention any constraints

This checklist ensures deployments are properly verified and prevents confusion about what is actually live.