# AI Agent Tool Use & Browser Automation - Technical Implementation Plan

## Overview
This document outlines the complete technical implementation for AI agent function calling capabilities including browser automation, form filling, scheduled tasks, and website audits.

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Tool Config  │  │  Scheduled   │  │  Execution   │  │  Credential  │    │
│  │    Panel     │  │    Tasks     │  │     Logs     │  │   Manager    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND API (FastAPI)                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        Tool Orchestrator                              │  │
│  │  - Tool Registry          - Function Call Parser                      │  │
│  │  - Execution Dispatcher   - Result Processor                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│  ┌─────────────┐  ┌─────────────┐   │   ┌─────────────┐  ┌─────────────┐  │
│  │   Rate      │  │  Feature    │   │   │  Credential │  │   Task      │  │
│  │  Limiter    │  │   Gates     │   │   │   Service   │  │  Scheduler  │  │
│  └─────────────┘  └─────────────┘   │   └─────────────┘  └─────────────┘  │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │ Redis Queue
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      WORKER SERVICE (Separate Process)                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     Browser Worker Pool                               │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │  │
│  │  │  Browser   │  │  Browser   │  │  Browser   │  │  Browser   │     │  │
│  │  │ Instance 1 │  │ Instance 2 │  │ Instance 3 │  │ Instance N │     │  │
│  │  │(Playwright)│  │(Playwright)│  │(Playwright)│  │(Playwright)│     │  │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Browser    │  │    Form     │  │    Audit    │  │   Session    │   │
│  │    Tools     │  │    Tools    │  │    Tools    │  │   Manager    │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   MongoDB    │  │    Redis    │  │  File Store  │  │   Secrets    │   │
│  │  (Primary)   │  │   (Queue)   │  │(Screenshots) │  │   (Creds)    │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. File Structure

```
/app/backend/
├── services/
│   ├── tool_orchestrator.py          # Main tool coordination service
│   ├── tool_registry.py              # Tool definitions and schemas
│   ├── credential_service.py         # Encrypted credential management
│   ├── task_scheduler_service.py     # APScheduler integration
│   └── tool_rate_limiter.py          # Rate limiting per tenant/tier
│
├── routes/
│   ├── agent_tools.py                # Tool configuration API
│   ├── scheduled_tasks.py            # Task scheduling API
│   ├── tool_executions.py            # Execution history API
│   └── agent_credentials.py          # Credential management API
│
├── workers/
│   ├── browser_worker.py             # Main worker process
│   ├── browser_pool.py               # Playwright browser pool manager
│   └── tools/
│       ├── __init__.py
│       ├── browser_tools.py          # Navigate, click, extract, screenshot
│       ├── form_tools.py             # Fill forms, submit, login
│       ├── audit_tools.py            # SEO, accessibility, performance, security
│       └── session_tools.py          # Cookie/session management
│
├── models/
│   └── tool_models.py                # Pydantic models for tools
│
└── config/
    └── tool_config.py                # Tool feature flags and limits

/app/frontend/src/
├── pages/
│   ├── AgentTools.js                 # Tool configuration page
│   ├── ScheduledTasks.js             # Task scheduler UI
│   └── ToolExecutions.js             # Execution logs viewer
│
└── components/
    ├── ToolSelector.js               # Enable/disable tools per agent
    ├── CredentialManager.js          # Manage stored credentials
    ├── TaskScheduler.js              # Create/edit scheduled tasks
    └── ExecutionLog.js               # View execution results
```

---

## 3. Database Schema

### 3.1 agent_tool_configs
```javascript
{
  _id: ObjectId,
  id: "uuid",
  tenant_id: "uuid",
  agent_id: "uuid",
  enabled_tools: [
    "browse_website",
    "click_element", 
    "fill_form",
    "submit_form",
    "take_screenshot",
    "extract_text",
    "login_to_website",
    "audit_seo",
    "audit_accessibility",
    "audit_performance",
    "audit_security"
  ],
  tool_settings: {
    browser: {
      default_timeout: 30000,
      viewport: { width: 1920, height: 1080 },
      user_agent: "custom_ua_string"
    },
    rate_limits: {
      max_per_hour: 100,      // Overridable by plan
      max_concurrent: 3
    }
  },
  allowed_domains: ["*"],     // Domain allowlist, empty = all
  created_at: ISODate,
  updated_at: ISODate
}
```

### 3.2 agent_credentials
```javascript
{
  _id: ObjectId,
  id: "uuid",
  tenant_id: "uuid",
  name: "My WordPress Login",
  site_domain: "mysite.com",
  login_url: "https://mysite.com/wp-admin",
  credentials_encrypted: "AES-256-GCM encrypted blob",
  credential_fields: {
    username_selector: "#user_login",
    password_selector: "#user_pass",
    submit_selector: "#wp-submit"
  },
  last_used: ISODate,
  created_at: ISODate,
  updated_at: ISODate
}
```

### 3.3 scheduled_tasks
```javascript
{
  _id: ObjectId,
  id: "uuid",
  tenant_id: "uuid",
  agent_id: "uuid",
  name: "Daily Price Monitor",
  description: "Check competitor prices every morning",
  enabled: true,
  schedule: {
    type: "cron",           // cron | interval | one_time
    cron_expression: "0 9 * * *",
    timezone: "America/New_York"
  },
  task_definition: {
    tool: "browse_website",
    params: {
      url: "https://competitor.com/products",
      extract_selectors: {
        prices: ".product-price",
        names: ".product-name"
      }
    },
    on_complete: {
      action: "send_notification",
      params: { channel: "slack", webhook_url: "..." }
    }
  },
  last_execution: {
    id: "uuid",
    status: "success",
    completed_at: ISODate
  },
  next_run: ISODate,
  execution_count: 145,
  created_at: ISODate,
  updated_at: ISODate
}
```

### 3.4 tool_executions
```javascript
{
  _id: ObjectId,
  id: "uuid",
  tenant_id: "uuid",
  agent_id: "uuid",
  task_id: "uuid",           // null if ad-hoc execution
  conversation_id: "uuid",   // null if scheduled
  tool_name: "browse_website",
  tool_params: {
    url: "https://example.com",
    extract_selectors: { title: "h1" }
  },
  status: "pending | running | success | failed | timeout",
  started_at: ISODate,
  completed_at: ISODate,
  duration_ms: 3450,
  result: {
    success: true,
    data: { title: "Example Domain" },
    screenshot_url: "/api/screenshots/abc123.png"
  },
  error: null,
  metadata: {
    browser_version: "chromium-120",
    worker_id: "worker-1"
  }
}
```

### 3.5 tool_usage_tracking (for rate limiting)
```javascript
{
  _id: ObjectId,
  tenant_id: "uuid",
  date: "2024-12-30",
  hour: 14,
  tool_counts: {
    browse_website: 45,
    fill_form: 12,
    take_screenshot: 23
  },
  total_executions: 80,
  quota_limit: 100,
  quota_used_percent: 80
}
```

---

## 4. API Endpoints

### 4.1 Tool Configuration
```
GET    /api/agents/{agent_id}/tools           # Get enabled tools
PUT    /api/agents/{agent_id}/tools           # Update enabled tools
GET    /api/tools/available                    # List all available tools
GET    /api/tools/{tool_name}/schema          # Get tool JSON schema
```

### 4.2 Credentials Management
```
GET    /api/credentials                        # List stored credentials
POST   /api/credentials                        # Store new credential
PUT    /api/credentials/{id}                   # Update credential
DELETE /api/credentials/{id}                   # Delete credential
POST   /api/credentials/{id}/test              # Test credential login
```

### 4.3 Scheduled Tasks
```
GET    /api/scheduled-tasks                    # List tasks
POST   /api/scheduled-tasks                    # Create task
GET    /api/scheduled-tasks/{id}               # Get task details
PUT    /api/scheduled-tasks/{id}               # Update task
DELETE /api/scheduled-tasks/{id}               # Delete task
POST   /api/scheduled-tasks/{id}/run           # Trigger immediate run
POST   /api/scheduled-tasks/{id}/enable        # Enable task
POST   /api/scheduled-tasks/{id}/disable       # Disable task
```

### 4.4 Tool Executions
```
GET    /api/tool-executions                    # List executions (paginated)
GET    /api/tool-executions/{id}               # Get execution details
GET    /api/tool-executions/{id}/screenshot    # Get execution screenshot
POST   /api/tools/execute                      # Execute tool ad-hoc
GET    /api/tools/usage                        # Get usage stats
```

---

## 5. Tool Definitions (OpenAI Function Calling Format)

### 5.1 Browser Tools

```python
BROWSER_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "browse_website",
            "description": "Navigate to a website and extract content. Can take screenshots and extract text from specific elements.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The URL to navigate to"
                    },
                    "extract_selectors": {
                        "type": "object",
                        "description": "CSS selectors to extract text from. Keys are field names, values are selectors.",
                        "additionalProperties": {"type": "string"}
                    },
                    "take_screenshot": {
                        "type": "boolean",
                        "description": "Whether to capture a screenshot",
                        "default": False
                    },
                    "wait_for_selector": {
                        "type": "string",
                        "description": "CSS selector to wait for before extracting content"
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Timeout in milliseconds",
                        "default": 30000
                    }
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "click_element",
            "description": "Click on an element on the current page",
            "parameters": {
                "type": "object",
                "properties": {
                    "selector": {
                        "type": "string",
                        "description": "CSS selector of element to click"
                    },
                    "text": {
                        "type": "string",
                        "description": "Text content of element to click (alternative to selector)"
                    },
                    "wait_after_click": {
                        "type": "integer",
                        "description": "Milliseconds to wait after clicking",
                        "default": 1000
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "fill_form",
            "description": "Fill out a form on a webpage with provided values",
            "parameters": {
                "type": "object",
                "properties": {
                    "fields": {
                        "type": "object",
                        "description": "Form fields to fill. Keys are CSS selectors, values are the text to enter.",
                        "additionalProperties": {"type": "string"}
                    },
                    "submit_selector": {
                        "type": "string",
                        "description": "CSS selector of submit button (optional)"
                    },
                    "submit_after_fill": {
                        "type": "boolean",
                        "description": "Whether to submit the form after filling",
                        "default": False
                    }
                },
                "required": ["fields"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "take_screenshot",
            "description": "Take a screenshot of the current page",
            "parameters": {
                "type": "object",
                "properties": {
                    "full_page": {
                        "type": "boolean",
                        "description": "Capture full scrollable page",
                        "default": False
                    },
                    "selector": {
                        "type": "string",
                        "description": "Only capture a specific element"
                    }
                }
            }
        }
    }
]
```

### 5.2 Authentication Tools

```python
AUTH_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "login_to_website",
            "description": "Log into a website using stored credentials",
            "parameters": {
                "type": "object",
                "properties": {
                    "credential_id": {
                        "type": "string",
                        "description": "ID of stored credential to use"
                    },
                    "credential_name": {
                        "type": "string",
                        "description": "Name of stored credential (alternative to ID)"
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "logout_from_website",
            "description": "Log out from current session",
            "parameters": {
                "type": "object",
                "properties": {
                    "logout_url": {
                        "type": "string",
                        "description": "URL to navigate to for logout (optional)"
                    }
                }
            }
        }
    }
]
```

### 5.3 Audit Tools

```python
AUDIT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "audit_seo",
            "description": "Perform SEO audit on a webpage - checks meta tags, headings, images, links",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "URL to audit"
                    },
                    "checks": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Specific checks to run: meta_tags, headings, images, links, structured_data",
                        "default": ["meta_tags", "headings", "images", "links"]
                    }
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "audit_accessibility",
            "description": "Check webpage for accessibility issues (WCAG compliance)",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "URL to audit"
                    },
                    "standard": {
                        "type": "string",
                        "enum": ["WCAG2A", "WCAG2AA", "WCAG2AAA"],
                        "description": "WCAG standard to check against",
                        "default": "WCAG2AA"
                    }
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "audit_performance",
            "description": "Measure page load performance metrics",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "URL to audit"
                    },
                    "metrics": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Metrics to measure: load_time, first_paint, largest_contentful_paint, total_blocking_time",
                        "default": ["load_time", "first_paint", "largest_contentful_paint"]
                    }
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "audit_security",
            "description": "Check security headers and basic security configuration",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "URL to audit"
                    },
                    "checks": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Security checks: headers, ssl, cookies, mixed_content",
                        "default": ["headers", "ssl", "cookies"]
                    }
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_broken_links",
            "description": "Find broken links on a webpage",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "URL to check"
                    },
                    "max_links": {
                        "type": "integer",
                        "description": "Maximum number of links to check",
                        "default": 100
                    },
                    "check_external": {
                        "type": "boolean",
                        "description": "Also check external links",
                        "default": True
                    }
                },
                "required": ["url"]
            }
        }
    }
]
```

### 5.4 Scheduled Task Tools

```python
SCHEDULER_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_scheduled_task",
            "description": "Create a scheduled task to run automatically",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Name for this scheduled task"
                    },
                    "tool": {
                        "type": "string",
                        "description": "Tool to execute (e.g., browse_website, audit_seo)"
                    },
                    "tool_params": {
                        "type": "object",
                        "description": "Parameters for the tool"
                    },
                    "schedule": {
                        "type": "string",
                        "description": "Cron expression (e.g., '0 9 * * *' for daily at 9am)"
                    },
                    "timezone": {
                        "type": "string",
                        "description": "Timezone for schedule",
                        "default": "UTC"
                    }
                },
                "required": ["name", "tool", "tool_params", "schedule"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_scheduled_tasks",
            "description": "List all scheduled tasks",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["all", "enabled", "disabled"],
                        "default": "all"
                    }
                }
            }
        }
    }
]
```

---

## 6. Worker Service Architecture

### 6.1 Message Queue (Redis)

```python
# Job format pushed to Redis queue
{
    "job_id": "uuid",
    "tenant_id": "uuid",
    "agent_id": "uuid",
    "tool_name": "browse_website",
    "tool_params": {...},
    "priority": 1,  # 1=high, 5=low
    "created_at": "ISO timestamp",
    "timeout_ms": 30000,
    "callback_url": "/api/internal/tool-callback"
}
```

### 6.2 Browser Pool Management

```python
class BrowserPool:
    """Manages pool of Playwright browser instances"""
    
    def __init__(self, pool_size: int = 5):
        self.pool_size = pool_size
        self.browsers: List[Browser] = []
        self.available: asyncio.Queue = asyncio.Queue()
        
    async def initialize(self):
        """Create browser pool on startup"""
        playwright = await async_playwright().start()
        for _ in range(self.pool_size):
            browser = await playwright.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-dev-shm-usage']
            )
            self.browsers.append(browser)
            await self.available.put(browser)
    
    async def acquire(self) -> Browser:
        """Get available browser from pool"""
        return await self.available.get()
    
    async def release(self, browser: Browser):
        """Return browser to pool"""
        await self.available.put(browser)
```

---

## 7. Feature Gating Integration

### 7.1 Tool Feature Gates

```python
TOOL_FEATURE_GATES = {
    # Browser tools
    "browse_website": {
        "feature_key": "agent_browser_tools",
        "tiers": ["professional", "enterprise"],
        "limits": {
            "free": 0,
            "starter": 50,      # per hour
            "professional": 200,
            "enterprise": 1000
        }
    },
    "fill_form": {
        "feature_key": "agent_form_tools",
        "tiers": ["professional", "enterprise"],
        "limits": {
            "free": 0,
            "starter": 0,
            "professional": 100,
            "enterprise": 500
        }
    },
    # Audit tools
    "audit_seo": {
        "feature_key": "agent_audit_tools",
        "tiers": ["starter", "professional", "enterprise"],
        "limits": {
            "free": 0,
            "starter": 10,
            "professional": 50,
            "enterprise": 200
        }
    },
    # Scheduled tasks
    "scheduled_tasks": {
        "feature_key": "agent_scheduled_tasks",
        "tiers": ["professional", "enterprise"],
        "limits": {
            "free": 0,
            "starter": 0,
            "professional": 10,   # max active tasks
            "enterprise": 100
        }
    }
}
```

---

## 8. Security Implementation

### 8.1 Credential Encryption

```python
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64, os

class CredentialEncryption:
    def __init__(self, master_key: str):
        # Derive key from master key
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b'agent_credentials_salt',  # In prod, use unique salt per tenant
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(master_key.encode()))
        self.fernet = Fernet(key)
    
    def encrypt(self, plaintext: str) -> str:
        return self.fernet.encrypt(plaintext.encode()).decode()
    
    def decrypt(self, ciphertext: str) -> str:
        return self.fernet.decrypt(ciphertext.encode()).decode()
```

### 8.2 Domain Allowlist

```python
def validate_url_access(url: str, allowed_domains: List[str], tenant_id: str) -> bool:
    """Check if URL is allowed for this tenant"""
    if not allowed_domains or "*" in allowed_domains:
        return True
    
    parsed = urlparse(url)
    domain = parsed.netloc.lower()
    
    for allowed in allowed_domains:
        if allowed.startswith("*."):
            # Wildcard subdomain match
            if domain.endswith(allowed[1:]):
                return True
        elif domain == allowed.lower():
            return True
    
    return False
```

---

## 9. Implementation Phases

### Phase 1: Core Infrastructure (3-4 days) ✅ COMPLETE
- [x] Create tool registry and schemas
- [x] Implement tool orchestrator service
- [x] Set up Redis queue for worker communication
- [x] Create basic browser worker with Playwright
- [x] Implement `browse_website` and `take_screenshot` tools
- [x] Add tool execution logging

### Phase 2: Form & Auth Tools (2-3 days) ✅ COMPLETE
- [x] Implement credential encryption service (Fernet AES-128-CBC)
- [x] Create credentials API endpoints (CRUD + lookup by name)
- [x] Build `fill_form` and `submit_form` tools
- [x] Implement `login_to_website` with stored credentials
- [x] Implement `logout_from_website` tool
- [x] Implement `check_login_status` tool
- [x] Add session/cookie management

### Phase 3: Scheduling System (2-3 days) ✅ COMPLETE
- [x] Integrate APScheduler for task scheduling
- [x] Create scheduled tasks API
- [x] Build task execution engine
- [x] Add task history tracking
- [x] Implement task enable/disable

### Phase 4: Audit Tools (2-3 days) ✅ COMPLETE
- [x] Implement SEO audit tool
- [x] Build accessibility checker (WCAG 2.1 basic checks)
- [x] Create performance metrics tool
- [x] Add security headers checker
- [x] Build broken links checker

### Phase 5: UI & Integration (3-4 days) ✅ COMPLETE
- [x] Agent tools configuration panel (`AgentTools.js`)
- [x] Credentials manager UI (`CredentialsManager.js`)
- [x] Scheduled tasks dashboard (`ScheduledTasks.js`)
- [x] Execution logs viewer (`ExecutionLogs.js`)
- [x] Navigation integration in DashboardLayout
- [x] Feature gate integration (quota warnings)

### Phase 6: Testing & Polish (2-3 days)
- [ ] End-to-end testing
- [ ] Rate limiting verification
- [ ] Security audit
- [ ] Documentation
- [ ] Performance optimization

---

## 10. Dependencies to Install

### Backend
```
# requirements.txt additions
playwright>=1.40.0
apscheduler>=3.10.0
redis>=5.0.0
cryptography>=41.0.0
axe-playwright-python>=0.1.0  # For accessibility audits
aiohttp>=3.9.0  # For async HTTP requests
```

### Worker Service
```
# worker_requirements.txt
playwright>=1.40.0
redis>=5.0.0
asyncio
aiohttp>=3.9.0
```

---

## Summary

This implementation provides:
- ✅ Scalable worker architecture for browser automation
- ✅ Complete tool suite (browser, forms, auth, audits, scheduling)
- ✅ Secure credential storage with encryption
- ✅ Feature-gated access with tier-based limits
- ✅ Comprehensive execution logging and monitoring
- ✅ Native OpenAI function calling integration

Total estimated time: **2-3 weeks** for full implementation

Ready to proceed with Phase 1?
