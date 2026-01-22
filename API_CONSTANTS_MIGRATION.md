# Migrating to Centralized API Constants

## Why Migrate?

Currently, API endpoints are defined inconsistently across 53+ files:

```javascript
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const response = await axios.get(`${API}/conversations`);
```

**Problems:**
- ❌ Duplicated code in every file
- ❌ Inconsistent endpoint construction
- ❌ Hard to update endpoints globally
- ❌ No single source of truth
- ❌ Error-prone (typos in endpoint paths)

## New Centralized Solution

We've created `/frontend/src/config/constants.js` with:
- ✅ Single source of truth for all API endpoints
- ✅ Organized by feature area
- ✅ Type-safe (no typos)
- ✅ Easy to update globally
- ✅ Includes helper functions for dynamic endpoints

## Migration Guide

### Step 1: Import the Constants

**Before:**
```javascript
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
```

**After:**
```javascript
import { API_BASE_URL, API_ENDPOINTS } from '@/config/constants';
```

### Step 2: Replace Endpoint Definitions

#### Simple Endpoints

**Before:**
```javascript
const response = await axios.get(`${API}/conversations`, { ... });
```

**After:**
```javascript
const response = await axios.get(API_ENDPOINTS.conversations.base, { ... });
```

#### Dynamic Endpoints (with IDs)

**Before:**
```javascript
const response = await axios.get(`${API}/conversations/${id}`, { ... });
```

**After:**
```javascript
const response = await axios.get(API_ENDPOINTS.conversations.byId(id), { ... });
```

### Step 3: Remove Local API Constant

After updating all usages, remove the local constant:
```javascript
// DELETE THIS LINE
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
```

## Available Endpoints

### Authentication
```javascript
API_ENDPOINTS.auth.login
API_ENDPOINTS.auth.register
API_ENDPOINTS.auth.forgotPassword
API_ENDPOINTS.auth.resetPassword
```

### Users
```javascript
API_ENDPOINTS.users.base
API_ENDPOINTS.users.me
API_ENDPOINTS.users.byId(userId)
```

### Conversations
```javascript
API_ENDPOINTS.conversations.base
API_ENDPOINTS.conversations.byId(id)
API_ENDPOINTS.conversations.messages(id)
API_ENDPOINTS.conversations.close(id)
API_ENDPOINTS.conversations.transfer(id)
```

### Settings
```javascript
API_ENDPOINTS.settings.base
API_ENDPOINTS.settings.widget
API_ENDPOINTS.settings.integration
```

### Profile
```javascript
API_ENDPOINTS.profile.base
API_ENDPOINTS.profile.password
API_ENDPOINTS.profile.avatar
```

### Agents
```javascript
API_ENDPOINTS.agents.base
API_ENDPOINTS.agents.byId(id)
API_ENDPOINTS.agents.active
```

### Providers
```javascript
API_ENDPOINTS.providers.base
API_ENDPOINTS.providers.models(provider)
```

### Subscriptions
```javascript
API_ENDPOINTS.subscriptions.base
API_ENDPOINTS.subscriptions.plans
API_ENDPOINTS.subscriptions.checkout
API_ENDPOINTS.subscriptions.portal
```

### Tenants
```javascript
API_ENDPOINTS.tenants.base
API_ENDPOINTS.tenants.byId(id)
API_ENDPOINTS.tenants.switch
```

### Analytics
```javascript
API_ENDPOINTS.analytics.base
API_ENDPOINTS.analytics.dashboard
```

### Admin
```javascript
API_ENDPOINTS.admin.base
API_ENDPOINTS.admin.users
API_ENDPOINTS.admin.tenants
API_ENDPOINTS.admin.stats
```

### Media
```javascript
API_ENDPOINTS.media.upload
```

### Widget
```javascript
API_ENDPOINTS.widget.base
API_ENDPOINTS.widget.session
API_ENDPOINTS.widget.message
```

## Complete Example

### Before:
```javascript
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function ConversationList() {
  const { token } = useAuth();
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    const fetchConversations = async () => {
      const response = await axios.get(`${API}/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(response.data);
    };
    fetchConversations();
  }, [token]);

  const closeConversation = async (id) => {
    await axios.post(`${API}/conversations/${id}/close`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
  };

  return (/* ... */);
}
```

### After:
```javascript
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { API_ENDPOINTS } from '@/config/constants';

function ConversationList() {
  const { token } = useAuth();
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    const fetchConversations = async () => {
      const response = await axios.get(API_ENDPOINTS.conversations.base, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(response.data);
    };
    fetchConversations();
  }, [token]);

  const closeConversation = async (id) => {
    await axios.post(API_ENDPOINTS.conversations.close(id), {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
  };

  return (/* ... */);
}
```

## Files to Migrate

The following files currently define local API constants and should be migrated:

### High Priority (Frequently Used)
1. `pages/Conversations.js`
2. `pages/ConversationDetail.js`
3. `pages/Settings.js`
4. `pages/Team.js`
5. `pages/Agents.js`
6. `pages/Providers.js`
7. `pages/Profile.js`
8. `pages/Analytics.js`

### Medium Priority
9. `pages/Billing.js`
10. `pages/Pricing.js`
11. `pages/PlanManagement.js`
12. `pages/RateLimits.js`
13. `pages/Marketplace.js`
14. `pages/Observability.js`
15. `pages/StorageConfig.js`
16. `pages/Integrations.js`
17. `pages/DiscountCodes.js`
18. `pages/EmailTemplates.js`
19. `pages/SuperAdmin.js`

### Lower Priority
20. `pages/AdminPagesList.js`
21. `pages/PageEditor.js`
22. `pages/CustomPage.js`
23. `pages/GlobalComponents.js`
24. `pages/ComponentEditor.js`
25. `pages/MenusList.js`
26. `pages/MenuEditor.js`
27. `pages/WaitlistAdmin.js`
28. `pages/CustomEmailsAdmin.js`
29. `pages/Affiliates.js`
30. `components/OnboardingProgress.js`
... and more

## Benefits

- ✅ **Consistency**: All components use the same endpoint paths
- ✅ **Maintainability**: Update endpoints in one place
- ✅ **Type Safety**: Catch typos at development time
- ✅ **Discoverability**: Easy to find all available endpoints
- ✅ **Refactoring**: Easy to rename or reorganize endpoints
- ✅ **Testing**: Easier to mock API calls

## Adding New Endpoints

When adding a new API endpoint:

1. Add it to `/frontend/src/config/constants.js`:
```javascript
export const API_ENDPOINTS = {
  // ... existing endpoints

  // New feature
  myNewFeature: {
    base: `${API_BASE_URL}/my-new-feature`,
    byId: (id) => `${API_BASE_URL}/my-new-feature/${id}`,
    action: (id) => `${API_BASE_URL}/my-new-feature/${id}/action`,
  },
};
```

2. Use it in your component:
```javascript
import { API_ENDPOINTS } from '@/config/constants';

// Usage
const response = await axios.get(API_ENDPOINTS.myNewFeature.base);
```

## See Also

- `/frontend/src/config/constants.js` - Full API endpoint definitions
- `/frontend/src/pages/Dashboard.js` - Example migration (completed)

## Questions?

If you encounter an endpoint that doesn't exist in the constants file, add it following the pattern above, then use it in your component.
