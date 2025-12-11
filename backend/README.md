# Backend Architecture

## Directory Structure

```
/app/backend/
├── server.py                # Main FastAPI application (2599 lines - refactored)
├── models/                  # Pydantic models for validation
│   ├── __init__.py         # Export all models
│   ├── user.py             # User models
│   ├── tenant.py           # Tenant models
│   ├── settings.py         # Settings models
│   ├── conversation.py     # Conversation & Message models
│   ├── provider.py         # AI Provider models
│   ├── agent.py            # AI Agent models
│   ├── storage.py          # Storage configuration models
│   └── agent_config.py     # Company agent configuration models
├── middleware/             # Authentication & dependencies
│   ├── __init__.py        # Export middleware
│   ├── auth.py            # JWT auth, password hashing
│   └── database.py        # MongoDB connection
├── utils/                 # Utility functions
│   ├── __init__.py
│   └── helpers.py         # Helper functions (mask_api_key, etc.)
├── rag_service.py         # RAG: Document processing & retrieval
├── scraping_service.py    # Web scraping for knowledge base
├── storage_service.py     # File storage abstraction (local/GCS)
└── routes/                # API route handlers (future)
    └── __init__.py        # Router definitions

```

## Refactoring Progress

### ✅ Completed
- **Models** (9 files): All Pydantic models extracted into separate files
- **Middleware** (2 files): Authentication and database connection
- **Utils** (1 file): Helper functions

### 🚧 In Progress  
- **Routes**: Still in server.py (~2500 lines of route handlers remain)

### 📋 Future Improvements
1. Extract route handlers into separate files:
   - `routes/auth.py` - Authentication routes
   - `routes/agents.py` - Agent management
   - `routes/providers.py` - Provider management
   - `routes/conversations.py` - Conversation routes
   - `routes/settings.py` - Settings & agent config
   - `routes/users.py` - User management
   - `routes/admin.py` - Admin routes
   - `routes/widget.py` - Widget API

2. Create service layer:
   - `services/ai_service.py` - AI response generation logic
   - `services/conversation_service.py` - Conversation business logic

## Benefits of Refactoring

1. **Modularity**: Code is organized by concern
2. **Reusability**: Models and middleware can be imported anywhere
3. **Maintainability**: Easier to find and update specific functionality
4. **Testability**: Individual modules can be tested in isolation
5. **Scalability**: Clear structure for adding new features

## Import Examples

```python
# Import models
from models import UserCreate, AgentResponse, ProviderCreate

# Import middleware
from middleware import get_current_user, get_super_admin_user
from middleware.database import db

# Import auth functions
from middleware.auth import create_token, hash_password

# Import utils
from utils import mask_api_key, get_provider_models
```

## Key Changes

- **Before**: 2899 lines in single file
- **After**: 2599 lines in server.py + 402 lines in modules (18% reduction in server.py)
- **Models**: Extracted to 9 dedicated files
- **Authentication**: Centralized in middleware/auth.py
- **Database**: Centralized in middleware/database.py
