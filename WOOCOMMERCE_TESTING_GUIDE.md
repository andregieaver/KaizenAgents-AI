# WooCommerce Integration Testing Guide

## Quick Testing Steps

### 1. Backend API Testing

#### Test WooCommerce Service Installation
```bash
# Check if woocommerce package is installed
pip show woocommerce
```

#### Test Agent WooCommerce Configuration (with valid agent ID)
```bash
# Get auth token
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
TOKEN=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"andre@humanweb.no","password":"Pernilla66!"}' | \
  python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# List agents to get an agent_id
curl -s -X GET "$API_URL/api/agents/" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -20

# Configure WooCommerce for an agent (replace AGENT_ID)
curl -X POST "$API_URL/api/agents/AGENT_ID/woocommerce-config" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "store_url": "https://demo.woocommerce.com",
    "consumer_key": "ck_test_key",
    "consumer_secret": "cs_test_secret",
    "enabled": true
  }'

# Get WooCommerce configuration
curl -X GET "$API_URL/api/agents/AGENT_ID/woocommerce-config" \
  -H "Authorization: Bearer $TOKEN"

# Test WooCommerce connection
curl -X POST "$API_URL/api/agents/AGENT_ID/woocommerce-test" \
  -H "Authorization: Bearer $TOKEN"
```

### 2. Frontend UI Testing

1. **Login to Admin Panel**
   - Navigate to http://localhost:3000
   - Sign in with credentials: `andre@humanweb.no` / `Pernilla66!`

2. **Access Agents Page**
   - Click on "Agents" in the navigation menu
   - You should see a list of available agents

3. **Configure WooCommerce**
   - Find an agent card
   - Click the "WooCommerce" button
   - Fill in the configuration:
     - Store URL: `https://yourstore.com`
     - Consumer Key: `ck_xxxxx` (from WooCommerce settings)
     - Consumer Secret: `cs_xxxxx` (from WooCommerce settings)
     - Toggle "Enable WooCommerce Integration" ON
   - Click "Test Connection" to verify
   - Click "Save Configuration"

### 3. Test AI Function Calling

#### Setup a Test WooCommerce Store
Option 1: Use WooCommerce Demo
- URL: https://tastewp.org/create/NMS/ (temporary WooCommerce instance)
- Create a test site and note the credentials

Option 2: Local WooCommerce
- Install WordPress + WooCommerce locally
- Generate API keys from WooCommerce → Settings → Advanced → REST API

#### Test Order Search
```python
# Test the WooCommerce service directly
import asyncio
from services.woocommerce_service import WooCommerceService

async def test_order_search():
    wc = WooCommerceService(
        store_url="https://yourstore.com",
        consumer_key="ck_xxxxx",
        consumer_secret="cs_xxxxx"
    )
    
    # Test connection
    result = await wc.test_connection()
    print("Connection Test:", result)
    
    # Search orders
    orders = await wc.search_orders_by_email("customer@example.com")
    print("Orders Found:", len(orders))
    for order in orders:
        print(f"Order #{order['order_number']}: {order['status']} - ${order['total']}")

asyncio.run(test_order_search())
```

### 4. End-to-End Chat Testing

1. **Widget Test**
   - Embed the chat widget on a test page
   - Start a conversation as a customer
   - Test these scenarios:

   **Scenario 1: Order Status Check**
   ```
   Customer: Hi, where is my order?
   Agent: Can you provide your email address?
   Customer: john@example.com
   Agent: [Should search orders and display results]
   ```

   **Scenario 2: Refund Request**
   ```
   Customer: I want a refund for order 1234
   Agent: [Should retrieve order details and confirm]
   Customer: The product was damaged
   Agent: [Should process refund]
   ```

   **Scenario 3: General Complaint**
   ```
   Customer: I'm very disappointed with the service
   Agent: [Should handle empathetically and offer resolution]
   ```

## Expected Behavior

### Successful Configuration
- ✅ Configuration saves without errors
- ✅ Test connection returns "Successfully connected to WooCommerce"
- ✅ Agent card shows WooCommerce as enabled

### Failed Configuration
- ❌ Invalid URL: "Connection error: ..."
- ❌ Wrong credentials: "401 Unauthorized"
- ❌ Store offline: "Connection timeout"

### AI Function Calling
- When customer asks about orders, AI should:
  1. Ask for email if not provided
  2. Call `search_orders` function
  3. Display results conversationally
  
- When customer requests refund, AI should:
  1. Get order details
  2. Confirm with customer
  3. Call `create_refund` function
  4. Confirm completion

## Troubleshooting

### Backend Logs
```bash
# Check for errors
tail -f /var/log/supervisor/backend.err.log | grep -i woocommerce

# Check for function calling
tail -f /var/log/supervisor/backend.err.log | grep -i "function"
```

### Frontend Console
- Open browser DevTools (F12)
- Check Console tab for JavaScript errors
- Check Network tab for API call failures

### Common Issues

**Issue**: "Module not found: woocommerce"
**Solution**: 
```bash
pip install woocommerce
sudo supervisorctl restart backend
```

**Issue**: "Connection test failed"
**Solution**:
- Verify store URL includes https://
- Check API keys are correct
- Ensure pretty permalinks are enabled in WordPress

**Issue**: "AI not calling functions"
**Solution**:
- Check agent is using a supported model (GPT-4o, GPT-5, Claude)
- Verify WooCommerce is enabled in agent config
- Check backend logs for function calling errors

## Success Criteria

- [ ] WooCommerce package installed (`pip show woocommerce`)
- [ ] Backend API endpoints working (config, test, get)
- [ ] Frontend UI displays WooCommerce dialog
- [ ] Can save WooCommerce configuration
- [ ] Connection test succeeds with valid credentials
- [ ] AI can detect order-related questions
- [ ] AI calls WooCommerce functions
- [ ] Functions execute and return results
- [ ] AI formulates natural responses with function results

## Next Steps

After basic testing:
1. Test with real WooCommerce store
2. Create sample orders for testing
3. Test refund functionality
4. Test error handling (invalid order IDs, etc.)
5. Monitor function calling in production
6. Gather user feedback
