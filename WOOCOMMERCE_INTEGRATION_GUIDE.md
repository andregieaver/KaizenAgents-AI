# WooCommerce Integration Guide

## Overview
Your agents now have the ability to interact with WooCommerce stores on behalf of customers. This enables:
- **Order Status Checks**: Search and view order details
- **Refund Processing**: Create refunds directly from conversations
- **Complaint Handling**: AI-powered complaint management with actionable resolutions

## Architecture

### Backend Components
1. **WooCommerce Service** (`/app/backend/services/woocommerce_service.py`)
   - Handles all WooCommerce REST API interactions
   - Encrypts/decrypts API credentials
   - Provides methods for:
     - `search_orders_by_email()`
     - `get_order_details()`
     - `create_refund()`

2. **AI Function Calling** (`/app/backend/services/ai_function_calling.py`)
   - Implements function calling pattern for AI
   - Detects when AI wants to use WooCommerce tools
   - Executes functions and returns results to AI

3. **Agent Routes** (`/app/backend/routes/agents.py`)
   - New endpoints:
     - `POST /api/agents/{id}/woocommerce-config` - Configure WooCommerce
     - `GET /api/agents/{id}/woocommerce-config` - Get configuration
     - `POST /api/agents/{id}/woocommerce-test` - Test connection

### Frontend Components
1. **Agents Page** (`/app/frontend/src/pages/Agents.js`)
   - WooCommerce configuration dialog
   - Connection test functionality
   - Store credentials management

## Setup Guide

### Step 1: Get WooCommerce API Credentials
1. Log in to your WordPress admin panel
2. Go to **WooCommerce → Settings → Advanced → REST API**
3. Click **"Add key"**
4. Select a user (admin recommended)
5. Set permissions to **"Read/Write"**
6. Click **"Generate API key"**
7. Copy the **Consumer Key** and **Consumer Secret**

### Step 2: Configure Agent
1. Navigate to **Agents** page
2. Click **"WooCommerce"** button on the agent card
3. Fill in:
   - **Store URL**: Your WooCommerce store URL (e.g., `https://yourstore.com`)
   - **Consumer Key**: The key from Step 1
   - **Consumer Secret**: The secret from Step 1
4. Click **"Test Connection"** to verify
5. Click **"Save Configuration"**

### Step 3: Test the Integration
The agent can now handle customer requests like:
- "Where is my order?"
- "I want a refund for order #1234"
- "Can you check the status of my last order?"

## How It Works

### AI Function Calling Flow
1. Customer sends a message
2. AI analyzes intent and decides if WooCommerce action is needed
3. AI responds with a JSON function call:
   ```json
   {"function": "search_orders", "parameters": {"email": "customer@example.com"}}
   ```
4. Backend executes the function via WooCommerce API
5. Results are sent back to AI
6. AI formulates a natural response for the customer

### Available Functions

#### 1. search_orders
**Purpose**: Find customer orders by email
**Parameters**:
- `email` (required): Customer's email address

**Example AI Response**:
```json
{"function": "search_orders", "parameters": {"email": "john@example.com"}}
```

#### 2. get_order_details
**Purpose**: Get detailed information about a specific order
**Parameters**:
- `order_id` (required): WooCommerce order ID

**Example AI Response**:
```json
{"function": "get_order_details", "parameters": {"order_id": "1234"}}
```

#### 3. create_refund
**Purpose**: Process a refund for an order
**Parameters**:
- `order_id` (required): WooCommerce order ID
- `amount` (optional): Refund amount (full refund if not specified)
- `reason` (optional): Reason for refund

**Example AI Response**:
```json
{"function": "create_refund", "parameters": {"order_id": "1234", "reason": "Customer request"}}
```

## Security

### Credential Encryption
- Consumer keys and secrets are encrypted using Fernet (symmetric encryption)
- Encryption key is stored securely in environment variables
- Credentials are never exposed in API responses

### Authentication
- Customer email verification before order access
- Store owner credentials grant elevated permissions
- All actions are logged for audit trail

### Best Practices
1. Use **Read/Write** permissions (not Read-only)
2. Create a dedicated WordPress user for API access
3. Rotate API keys periodically
4. Monitor API usage in WooCommerce logs

## Troubleshooting

### Connection Test Fails
**Problem**: "Connection test failed"
**Solutions**:
1. Verify store URL includes `https://`
2. Check that pretty permalinks are enabled in WordPress
3. Confirm API keys have Read/Write permissions
4. Ensure SSL certificate is valid

### Orders Not Found
**Problem**: "Found 0 orders"
**Solutions**:
1. Verify customer email matches WooCommerce records
2. Check that orders exist for that customer
3. Confirm API user has access to order data

### Refund Fails
**Problem**: "Failed to create refund"
**Solutions**:
1. Verify order is in refundable status
2. Check payment gateway supports refunds
3. Ensure sufficient funds in gateway account
4. Confirm API user has refund permissions

## Example Conversations

### Order Status Check
**Customer**: "Hi, where is my order?"
**Agent**: "I'd be happy to help! Can you provide your email address?"
**Customer**: "john@example.com"
**Agent**: *[Searches orders]* "I found 2 orders for john@example.com:
- Order #1234 - $49.99 - Completed (delivered on Dec 1)
- Order #1235 - $89.99 - Processing (estimated delivery Dec 15)"

### Refund Request
**Customer**: "I want a refund for order 1234"
**Agent**: *[Retrieves order details]* "I can see order #1234 for $49.99. Can you tell me the reason for the refund?"
**Customer**: "Product arrived damaged"
**Agent**: *[Processes refund]* "I've processed a full refund of $49.99 for order #1234. The refund should appear in your account within 5-7 business days. I'm sorry about the damaged product!"

## API Endpoints

### Configure WooCommerce
```bash
POST /api/agents/{agent_id}/woocommerce-config
Authorization: Bearer {token}

{
  "store_url": "https://yourstore.com",
  "consumer_key": "ck_xxxxx",
  "consumer_secret": "cs_xxxxx",
  "enabled": true
}
```

### Get Configuration
```bash
GET /api/agents/{agent_id}/woocommerce-config
Authorization: Bearer {token}

Response:
{
  "enabled": true,
  "store_url": "https://yourstore.com",
  "has_credentials": true
}
```

### Test Connection
```bash
POST /api/agents/{agent_id}/woocommerce-test
Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "Successfully connected to WooCommerce"
}
```

## Technical Details

### Dependencies
- **Python**: `woocommerce` (v3.0.0)
- **Encryption**: `cryptography` (Fernet)

### Database Schema
Agent configuration includes:
```json
{
  "config": {
    "woocommerce": {
      "enabled": true,
      "store_url": "https://yourstore.com",
      "consumer_key_encrypted": "encrypted_value",
      "consumer_secret_encrypted": "encrypted_value"
    }
  }
}
```

### Environment Variables
```bash
ENCRYPTION_KEY=<your-fernet-key>
```

## Future Enhancements
1. **Webhooks**: Proactive order status notifications
2. **Advanced Analytics**: Order trends and customer insights
3. **Multi-Store Support**: Manage multiple WooCommerce stores
4. **Custom Actions**: Additional WooCommerce operations
5. **Order Creation**: Allow agents to create orders on behalf of customers

## Support
For issues or questions:
1. Check WooCommerce REST API docs: https://woocommerce.github.io/woocommerce-rest-api-docs/
2. Verify API credentials in WordPress admin
3. Review backend logs: `tail -f /var/log/supervisor/backend.err.log`
