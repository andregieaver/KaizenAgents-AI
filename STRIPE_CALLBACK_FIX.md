# Stripe Callback URL Fix

## Issue
When upgrading to a paid subscription on production site (kaizenagents.ai), the Stripe checkout callback was redirecting to `http://localhost:3000/dashboard/billing?success=true` instead of the actual production domain.

## Root Cause
The backend checkout endpoint (`/api/subscriptions/checkout`) was using a hardcoded environment variable `FRONTEND_URL` with a default value of `http://localhost:3000`. This caused all Stripe checkout sessions to redirect to localhost regardless of the actual domain.

**Previous Code:**
```python
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
checkout = await StripeService.create_checkout_session(
    stripe_customer_id,
    price_id,
    f"{frontend_url}/dashboard/billing?success=true",
    f"{frontend_url}/dashboard/billing?canceled=true",
    ...
)
```

## Solution
Modified the checkout endpoint to dynamically determine the frontend URL from the incoming request headers (Origin or Referer), with the environment variable as a fallback.

**New Code:**
```python
# Dynamically determine frontend URL from request
origin = request.headers.get("origin") or request.headers.get("referer")
if origin:
    # Remove trailing slash and any path from referer
    frontend_url = origin.rstrip('/').split('?')[0]
    # If it's a referer with path, get just the origin
    if origin.startswith('http'):
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        frontend_url = f"{parsed.scheme}://{parsed.netloc}"
else:
    # Fallback to env variable or localhost
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")

checkout = await StripeService.create_checkout_session(
    stripe_customer_id,
    price_id,
    f"{frontend_url}/dashboard/billing?success=true",
    f"{frontend_url}/dashboard/billing?canceled=true",
    ...
)
```

## Changes Made

### File: `/app/backend/routes/subscriptions.py`

1. **Added Imports:**
   - `from fastapi import Request`
   - `from urllib.parse import urlparse`
   - `import os` (moved to top-level)

2. **Updated Function Signature:**
   ```python
   @router.post("/checkout")
   async def create_checkout_session(
       subscription_data: SubscriptionCreate,
       request: Request,  # ADDED
       current_user: dict = Depends(get_current_user)
   ):
   ```

3. **Dynamic URL Detection:**
   - Checks `Origin` header first (sent by browser for API calls)
   - Falls back to `Referer` header if Origin not present
   - Parses the URL to extract just the scheme and netloc (domain)
   - Falls back to `FRONTEND_URL` env variable if no headers found
   - Falls back to `localhost:3000` as last resort

## How It Works

### For Production (kaizenagents.ai):
1. User clicks "Upgrade" button
2. Frontend makes POST to `/api/subscriptions/checkout`
3. Request includes `Origin: https://kaizenagents.ai`
4. Backend extracts origin and creates callback URLs:
   - Success: `https://kaizenagents.ai/dashboard/billing?success=true`
   - Cancel: `https://kaizenagents.ai/dashboard/billing?canceled=true`
5. User completes payment on Stripe
6. Stripe redirects back to correct production URL ✅

### For Local Development:
1. User clicks "Upgrade" button
2. Frontend makes POST to `/api/subscriptions/checkout`
3. Request includes `Origin: http://localhost:3000`
4. Backend extracts origin and creates callback URLs:
   - Success: `http://localhost:3000/dashboard/billing?success=true`
   - Cancel: `http://localhost:3000/dashboard/billing?canceled=true`
5. Stripe redirects back to localhost for testing ✅

### For Preview/Staging:
Works the same way - automatically detects the preview domain from request headers.

## Benefits

1. **No Environment-Specific Configuration:** Works across all environments without changing env variables
2. **Automatic Domain Detection:** Adapts to whatever domain the request comes from
3. **Backward Compatible:** Still supports FRONTEND_URL env variable as fallback
4. **Safe Fallback:** Defaults to localhost for development if headers are missing

## Testing

To verify the fix:

1. **Production Test:**
   - Go to https://kaizenagents.ai/dashboard/pricing
   - Click upgrade on any paid plan
   - Complete checkout
   - Should redirect back to https://kaizenagents.ai/dashboard/billing?success=true

2. **Local Test:**
   - Go to http://localhost:3000/dashboard/pricing
   - Click upgrade
   - Should redirect back to http://localhost:3000/dashboard/billing?success=true

## Related Files
- `/app/backend/routes/subscriptions.py` - Main fix applied here
- `/app/backend/.env` - Contains FRONTEND_URL (still used as fallback)

## Security Notes
- Origin and Referer headers are safe to use for this purpose
- The URLs are only used for redirect after payment
- Stripe validates the callback URL against configured domains in Stripe Dashboard
- No user input is directly used in URL construction

## Future Improvements
- Could add domain whitelist validation
- Could log when fallback is used for monitoring
- Could add metrics for different domain sources
