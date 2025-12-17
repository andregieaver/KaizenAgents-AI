# Production Hardcoded URL Fix

## Issue
The production build is making API calls to `https://customer-chat-ai.emergent.host` instead of your actual production domain, causing SSL certificate errors.

## Root Cause
The production build was created with an old `.env` file that had:
```
REACT_APP_BACKEND_URL=https://customer-chat-ai.emergent.host
```

React apps bake environment variables into the JavaScript bundle at **build time**, not runtime. This means you need to rebuild the frontend with the correct environment variables.

## Solution

### Option 1: Rebuild Locally with Correct Environment Variables

1. **Update your `.env` file** (or create `.env.production`):
```bash
# /app/frontend/.env.production
REACT_APP_BACKEND_URL=https://your-actual-domain.com
WDS_SOCKET_PORT=443
```

2. **Rebuild the frontend**:
```bash
cd /app/frontend
yarn build
```

3. **Deploy the new build** to your production server

### Option 2: Use Emergent Platform Deployment

If you're using Emergent's native deployment:

1. **Go to your Emergent Dashboard**
2. **Navigate to Settings or Deployment**
3. **Update Environment Variables**:
   - Key: `REACT_APP_BACKEND_URL`
   - Value: `https://your-actual-domain.com` (your production domain)
4. **Trigger a new deployment** (this will rebuild with the correct env vars)

### Option 3: Manual Environment Variable Check

Check your current environment variables:

```bash
# In your local development
cat /app/frontend/.env

# Check what's being used
echo $REACT_APP_BACKEND_URL
```

If deploying via Vercel, Netlify, or similar:
- Go to your deployment platform settings
- Update the `REACT_APP_BACKEND_URL` environment variable
- Redeploy

## Verification

After redeployment, check the browser console:
1. Open your production site
2. Open DevTools (F12) → Network tab
3. Visit the pricing page
4. Check the API calls - they should now go to your correct domain, not `customer-chat-ai.emergent.host`

## Important Notes

### For React Apps:
- **Build-time variables**: `REACT_APP_*` variables are embedded during build
- You MUST rebuild the app when changing these variables
- Simply updating the `.env` file on the server won't work without a rebuild

### Current Development Environment:
Your local development environment is correctly configured:
```
REACT_APP_BACKEND_URL=https://quota-manager-4.preview.emergentagent.com
```

This is why you don't see the issue locally - only in production.

## Testing the Fix

After rebuilding and deploying:

1. **Clear browser cache** (or open incognito window)
2. Visit your production pricing page
3. Check browser console - should see no `customer-chat-ai.emergent.host` errors
4. API calls should succeed (no SSL errors)

## Additional Check: Verify All Components

The error mentions these components are affected:
- ✅ `PricingPage.js` - Already uses `process.env.REACT_APP_BACKEND_URL`
- ✅ `GlobalHeader.js` - Already uses `process.env.REACT_APP_BACKEND_URL`
- ✅ `GlobalFooter.js` - Already uses `process.env.REACT_APP_BACKEND_URL`

All components are correctly using environment variables. The issue is definitely the build configuration.

## If Problem Persists

1. **Check build logs** for environment variable values
2. **Verify the correct .env file is being used** during build
3. **Clear CDN cache** if using a CDN (CloudFlare, etc.)
4. **Hard refresh** browser (Ctrl+Shift+R or Cmd+Shift+R)

## Quick Command Reference

```bash
# View current env
cat /app/frontend/.env

# Build with production env
cd /app/frontend
NODE_ENV=production yarn build

# Check built files for hardcoded URL (shouldn't find any)
grep -r "customer-chat-ai" /app/frontend/build 2>/dev/null

# If found, rebuild with correct env vars
```

## Contact Support

If you need help with Emergent platform deployment:
- The `deployment_agent` can help with native Emergent deployments
- For external hosting (Vercel, Netlify), follow their environment variable documentation
