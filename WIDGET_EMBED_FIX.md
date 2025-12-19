# Widget Embed Code Hardcoded URL Fix

## Issue
The widget embed code in production shows:
```html
<script src="https://customer-chat-ai.emergent.host/widget.js" ...>
```

Instead of your actual production domain.

## Root Cause
The code is **NOT hardcoded** - it correctly uses `process.env.REACT_APP_BACKEND_URL`:

**File**: `/app/frontend/src/pages/Settings.js` (Lines 537 & 158)
```javascript
const code = `<script src="${process.env.REACT_APP_BACKEND_URL?.replace('/api', '')}/widget.js" data-tenant-id="${user?.tenant_id}" async></script>`;
```

**The problem**: Your production build was created with:
```
REACT_APP_BACKEND_URL=https://customer-chat-ai.emergent.host/api
```

This environment variable gets **baked into the JavaScript bundle** at build time, not runtime.

## Solution: Rebuild Frontend

### Step 1: Update Production Environment Variable

Create or update `/app/frontend/.env.production`:
```env
REACT_APP_BACKEND_URL=https://your-actual-domain.com/api
```

**Important**: Replace `your-actual-domain.com` with your actual production domain (e.g., `kaizenagents.ai`)

### Step 2: Rebuild Frontend

```bash
cd /app/frontend

# Install dependencies (if needed)
yarn install

# Build with production environment
NODE_ENV=production yarn build
```

### Step 3: Verify Build

Check that the build uses the correct URL:

```bash
# Search for old URL in build files
grep -r "customer-chat-ai" /app/frontend/build

# Should return nothing if successful
```

### Step 4: Deploy

Deploy the new build to your production environment.

## Quick Fix for Emergent Platform Deployment

If using Emergent's native deployment:

1. **Go to Emergent Dashboard**
2. **Settings → Environment Variables**
3. **Update**:
   ```
   REACT_APP_BACKEND_URL=https://your-production-domain.com/api
   ```
4. **Trigger New Deployment** (this rebuilds with correct env vars)

## Verification

After redeployment:

1. Log into your production admin panel
2. Go to **Settings → Integration** tab
3. Check the **Embed Code** section
4. The URL should now show your correct domain:
   ```html
   <script src="https://your-actual-domain.com/widget.js" ...>
   ```

## Why This Happens

React apps (Create React App, Vite, etc.) use **build-time environment variables**:

- ✅ **Correct**: Environment variables are read during `yarn build`
- ❌ **Wrong**: Thinking you can change `.env` on the server and it will update

**Key Point**: You must **rebuild the frontend** whenever you change `REACT_APP_*` variables.

## Additional Checks

### 1. Check Current .env File

**Development** (preview/local):
```bash
cat /app/frontend/.env
# Should show: REACT_APP_BACKEND_URL=https://billing-quota-system.preview.emergentagent.com
```

**Production**:
```bash
cat /app/frontend/.env.production
# Should show: REACT_APP_BACKEND_URL=https://your-actual-domain.com/api
```

### 2. Test Widget After Fix

```html
<!-- This is what users should embed -->
<script src="https://your-actual-domain.com/widget.js" 
        data-tenant-id="YOUR_TENANT_ID" 
        async>
</script>
```

Test on a demo page to ensure it loads correctly.

## Related Files

All these files correctly use environment variables (no hardcoding):

- `/app/frontend/src/pages/Settings.js` - Generates embed code
- `/app/frontend/src/components/GlobalHeader.js` - Uses `REACT_APP_BACKEND_URL`
- `/app/frontend/src/components/GlobalFooter.js` - Uses `REACT_APP_BACKEND_URL`
- `/app/frontend/src/pages/PricingPage.js` - Uses `REACT_APP_BACKEND_URL`

**No code changes needed** - just rebuild with correct environment variables.

## Widget.js File

The actual widget file is served from:
```
/app/frontend/public/widget.js
```

This file also uses the backend URL, so ensure it's deployed correctly with your frontend.

## Troubleshooting

### Issue: Still showing old URL after rebuild
**Solution**: Clear browser cache or open incognito window

### Issue: Widget doesn't load on external site
**Solution**: 
1. Check CORS settings in backend
2. Verify widget.js is accessible: `curl https://your-domain.com/widget.js`
3. Check browser console for errors

### Issue: Cannot rebuild locally
**Solution**: Use Emergent platform deployment which automatically rebuilds

## Summary

1. ✅ **Code is correct** - uses environment variables properly
2. ❌ **Build is wrong** - created with old environment variable
3. 🔧 **Fix**: Rebuild frontend with correct `REACT_APP_BACKEND_URL`
4. 🚀 **Deploy**: Push new build to production

No code changes required - only rebuild with updated environment variables!
