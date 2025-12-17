# Stripe Subscription Debugging Guide

## Issue: Transactions Not Coming Through

The payment appears successful but the subscription is not being activated in the database.

## Enhanced Logging Added

I've added comprehensive logging to help identify where the issue is occurring:

### Backend Logs Now Include:
1. Session ID verification start
2. Stripe initialization status
3. Checkout session retrieval from Stripe
4. Payment status check
5. Subscription details retrieval
6. Database update confirmation
7. Full error tracebacks

### Frontend Console Logs Now Include:
1. Session ID detection on return
2. Verify endpoint call confirmation
3. Response data
4. Detailed error messages

## How to Debug on Production

### 1. Check Browser Console
After completing payment and returning to the site:

**Open DevTools Console (F12) and look for:**
```
Stripe return detected. Session ID: cs_test_...
Calling verify-checkout endpoint...
Verify response: {...}
```

**Key Questions:**
- Is the session ID present?
- Is the verify endpoint being called?
- What's the response?
- Are there any errors?

### 2. Check Network Tab
**In DevTools Network tab:**
- Look for request to `/api/subscriptions/verify-checkout?session_id=...`
- Check the status code (should be 200)
- Click on the request and view the Response tab
- Look for error details

### 3. Check Backend Logs
**In your deployment platform:**
```bash
# View recent logs
tail -100 /var/log/backend.log

# Or filter for verification logs
grep "verify-checkout\|Verifying checkout" /var/log/backend.log
```

**Look for these log entries:**
```
Verifying checkout session - session_id: cs_test_..., tenant_id: ...
Stripe initialized from database - success: True/False
Retrieving checkout session from Stripe - session_id: ...
Checkout session retrieved - payment_status: paid, subscription_id: sub_...
Subscription saved to database - tenant_id: ..., modified_count: 1
```

## Common Issues and Solutions

### Issue 1: Session ID Not Stored
**Symptom:** Console shows `Session ID: null`

**Cause:** Session ID not saved before redirect

**Solution:** 
- Check if localStorage is working
- Verify the checkout response includes `session_id`
- Try clearing browser cache

### Issue 2: Stripe Not Initialized
**Symptom:** Backend log shows `Stripe initialized from database - success: False`

**Cause:** Stripe keys not configured in database

**Solution:**
1. Go to `/dashboard/integrations`
2. Enter your Stripe API keys
3. Click "Save Stripe Settings"
4. Click "Test Connection" to verify

### Issue 3: Invalid Session ID
**Symptom:** Error: "Stripe error: No such checkout.session"

**Cause:** Using test session ID in live mode or vice versa

**Solution:**
- Ensure "Use Live Mode" toggle matches your Stripe dashboard
- Verify you're using the correct Stripe keys (test vs live)

### Issue 4: Subscription Not Created
**Symptom:** `subscription_id` is null in logs

**Cause:** Checkout session completed but subscription wasn't created

**Solution:**
- Check Stripe Dashboard → Payments → Recent
- Verify the payment actually succeeded
- Check if subscription exists in Stripe Dashboard → Subscriptions

### Issue 5: Database Update Fails
**Symptom:** `modified_count: 0` in logs

**Cause:** Database connection or permission issue

**Solution:**
- Check MongoDB connection
- Verify user has write permissions
- Check database name is correct

## Testing Checklist

Before each test:
1. ✅ Open browser DevTools Console
2. ✅ Open Network tab
3. ✅ Clear localStorage (Application → Local Storage → Clear)
4. ✅ Have backend logs ready

During test:
1. ✅ Click "Upgrade" on pricing page
2. ✅ Verify session_id is stored (check localStorage)
3. ✅ Complete payment on Stripe test card: `4242 4242 4242 4242`
4. ✅ Note if you're redirected back
5. ✅ Check console logs immediately
6. ✅ Check network requests
7. ✅ Take screenshots of any errors

After test:
1. ✅ Check backend logs
2. ✅ Check database for subscription record
3. ✅ Check Stripe Dashboard for subscription
4. ✅ Save all error messages

## What to Report

If issue persists, provide:
1. **Browser Console Logs** (entire console output after return)
2. **Network Request Details** (verify-checkout request/response)
3. **Backend Logs** (grep for "verify-checkout")
4. **Stripe Dashboard** (screenshot of payment/subscription)
5. **Error Messages** (any toast/alert messages shown)

## Quick Fixes to Try

### Fix 1: Force Verification
If session ID is in localStorage but verify didn't work:
```javascript
// In browser console:
const sessionId = localStorage.getItem('stripe_session_id');
console.log('Session ID:', sessionId);

// Then manually reload the page with success param:
window.location.href = '/dashboard/billing?success=true';
```

### Fix 2: Clear and Retry
```javascript
// In browser console:
localStorage.removeItem('stripe_session_id');
// Then try the upgrade flow again
```

### Fix 3: Check Stripe Keys
1. Go to Integrations page
2. Click "Test Connection"
3. Should show: "Successfully connected to Stripe (test mode)"
4. If error, re-enter keys and save

## Expected Successful Flow

1. **User clicks Upgrade**
   - Console: `Storing session: cs_test_...`
   
2. **Redirects to Stripe**
   - URL: `https://checkout.stripe.com/...`
   
3. **Completes Payment**
   - Stripe shows "Payment successful"
   
4. **Redirects back**
   - URL: `https://kaizenagents.ai/dashboard/billing?success=true`
   - Console: `Stripe return detected. Session ID: cs_test_...`
   - Console: `Calling verify-checkout endpoint...`
   
5. **Verification succeeds**
   - Console: `Verify response: {status: "active", ...}`
   - Toast: "Payment successful! Your subscription is now active."
   - Backend: `Subscription saved to database - modified_count: 1`
   
6. **Page refreshes**
   - Billing page shows new plan
   - Status shows "Active"

If any step fails, note which one and the error message.
