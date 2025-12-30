"""
Tool Registry - Defines all available tools for AI agents
Each tool follows OpenAI function calling format
"""
from typing import Dict, List, Any, Optional
from enum import Enum


class ToolCategory(str, Enum):
    BROWSER = "browser"
    FORM = "form"
    AUTH = "auth"
    AUDIT = "audit"
    SCHEDULER = "scheduler"


# =============================================================================
# BROWSER TOOLS
# =============================================================================

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
        },
        "category": ToolCategory.BROWSER,
        "feature_key": "agent_browser_tools"
    },
    {
        "type": "function",
        "function": {
            "name": "click_element",
            "description": "Click on an element on the current page by CSS selector or text content",
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
        },
        "category": ToolCategory.BROWSER,
        "feature_key": "agent_browser_tools"
    },
    {
        "type": "function",
        "function": {
            "name": "extract_text",
            "description": "Extract text content from elements on the current page",
            "parameters": {
                "type": "object",
                "properties": {
                    "selectors": {
                        "type": "object",
                        "description": "CSS selectors to extract text from. Keys are field names, values are selectors.",
                        "additionalProperties": {"type": "string"}
                    },
                    "include_html": {
                        "type": "boolean",
                        "description": "Include raw HTML in results",
                        "default": False
                    }
                },
                "required": ["selectors"]
            }
        },
        "category": ToolCategory.BROWSER,
        "feature_key": "agent_browser_tools"
    },
    {
        "type": "function",
        "function": {
            "name": "take_screenshot",
            "description": "Take a screenshot of the current page or a specific element",
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
                        "description": "Only capture a specific element (CSS selector)"
                    },
                    "quality": {
                        "type": "integer",
                        "description": "JPEG quality (1-100)",
                        "default": 80
                    }
                }
            }
        },
        "category": ToolCategory.BROWSER,
        "feature_key": "agent_browser_tools"
    },
    {
        "type": "function",
        "function": {
            "name": "scroll_page",
            "description": "Scroll the page up, down, or to a specific element",
            "parameters": {
                "type": "object",
                "properties": {
                    "direction": {
                        "type": "string",
                        "enum": ["up", "down", "top", "bottom"],
                        "description": "Direction to scroll"
                    },
                    "pixels": {
                        "type": "integer",
                        "description": "Number of pixels to scroll (for up/down)"
                    },
                    "to_selector": {
                        "type": "string",
                        "description": "Scroll to bring this element into view"
                    }
                }
            }
        },
        "category": ToolCategory.BROWSER,
        "feature_key": "agent_browser_tools"
    },
    {
        "type": "function",
        "function": {
            "name": "get_page_info",
            "description": "Get information about the current page (URL, title, meta tags)",
            "parameters": {
                "type": "object",
                "properties": {
                    "include_meta": {
                        "type": "boolean",
                        "description": "Include meta tags",
                        "default": True
                    },
                    "include_links": {
                        "type": "boolean",
                        "description": "Include all links on page",
                        "default": False
                    }
                }
            }
        },
        "category": ToolCategory.BROWSER,
        "feature_key": "agent_browser_tools"
    }
]


# =============================================================================
# FORM TOOLS
# =============================================================================

FORM_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "fill_form",
            "description": "Fill out form fields on a webpage with provided values",
            "parameters": {
                "type": "object",
                "properties": {
                    "fields": {
                        "type": "object",
                        "description": "Form fields to fill. Keys are CSS selectors, values are the text to enter.",
                        "additionalProperties": {"type": "string"}
                    },
                    "clear_first": {
                        "type": "boolean",
                        "description": "Clear existing values before filling",
                        "default": True
                    }
                },
                "required": ["fields"]
            }
        },
        "category": ToolCategory.FORM,
        "feature_key": "agent_form_tools"
    },
    {
        "type": "function",
        "function": {
            "name": "submit_form",
            "description": "Submit a form by clicking the submit button",
            "parameters": {
                "type": "object",
                "properties": {
                    "submit_selector": {
                        "type": "string",
                        "description": "CSS selector of submit button",
                        "default": "button[type='submit'], input[type='submit']"
                    },
                    "wait_for_navigation": {
                        "type": "boolean",
                        "description": "Wait for page navigation after submit",
                        "default": True
                    }
                }
            }
        },
        "category": ToolCategory.FORM,
        "feature_key": "agent_form_tools"
    },
    {
        "type": "function",
        "function": {
            "name": "select_option",
            "description": "Select an option from a dropdown/select element",
            "parameters": {
                "type": "object",
                "properties": {
                    "selector": {
                        "type": "string",
                        "description": "CSS selector of the select element"
                    },
                    "value": {
                        "type": "string",
                        "description": "Option value to select"
                    },
                    "label": {
                        "type": "string",
                        "description": "Option label/text to select (alternative to value)"
                    }
                },
                "required": ["selector"]
            }
        },
        "category": ToolCategory.FORM,
        "feature_key": "agent_form_tools"
    }
]


# =============================================================================
# AUTHENTICATION TOOLS
# =============================================================================

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
        },
        "category": ToolCategory.AUTH,
        "feature_key": "agent_auth_tools"
    },
    {
        "type": "function",
        "function": {
            "name": "check_login_status",
            "description": "Check if currently logged into a website",
            "parameters": {
                "type": "object",
                "properties": {
                    "success_indicator": {
                        "type": "string",
                        "description": "CSS selector that indicates successful login"
                    },
                    "logout_indicator": {
                        "type": "string",
                        "description": "CSS selector that indicates logged out state"
                    }
                }
            }
        },
        "category": ToolCategory.AUTH,
        "feature_key": "agent_auth_tools"
    }
]


# =============================================================================
# AUDIT TOOLS
# =============================================================================

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
                        "description": "Specific checks: meta_tags, headings, images, links, structured_data",
                        "default": ["meta_tags", "headings", "images", "links"]
                    }
                },
                "required": ["url"]
            }
        },
        "category": ToolCategory.AUDIT,
        "feature_key": "agent_audit_tools"
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
        },
        "category": ToolCategory.AUDIT,
        "feature_key": "agent_audit_tools"
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
                    }
                },
                "required": ["url"]
            }
        },
        "category": ToolCategory.AUDIT,
        "feature_key": "agent_audit_tools"
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
                    }
                },
                "required": ["url"]
            }
        },
        "category": ToolCategory.AUDIT,
        "feature_key": "agent_audit_tools"
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
                        "default": 50
                    },
                    "check_external": {
                        "type": "boolean",
                        "description": "Also check external links",
                        "default": True
                    }
                },
                "required": ["url"]
            }
        },
        "category": ToolCategory.AUDIT,
        "feature_key": "agent_audit_tools"
    }
]


# =============================================================================
# SCHEDULER TOOLS
# =============================================================================

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
        },
        "category": ToolCategory.SCHEDULER,
        "feature_key": "agent_scheduled_tasks"
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
        },
        "category": ToolCategory.SCHEDULER,
        "feature_key": "agent_scheduled_tasks"
    },
    {
        "type": "function",
        "function": {
            "name": "delete_scheduled_task",
            "description": "Delete a scheduled task",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {
                        "type": "string",
                        "description": "ID of the task to delete"
                    },
                    "task_name": {
                        "type": "string",
                        "description": "Name of the task to delete (alternative to ID)"
                    }
                }
            }
        },
        "category": ToolCategory.SCHEDULER,
        "feature_key": "agent_scheduled_tasks"
    }
]


# =============================================================================
# REGISTRY
# =============================================================================

# All tools combined
ALL_TOOLS = BROWSER_TOOLS + FORM_TOOLS + AUTH_TOOLS + AUDIT_TOOLS + SCHEDULER_TOOLS

# Tool lookup by name
TOOL_REGISTRY: Dict[str, Dict[str, Any]] = {
    tool["function"]["name"]: tool for tool in ALL_TOOLS
}

# Tools by category
TOOLS_BY_CATEGORY: Dict[ToolCategory, List[Dict[str, Any]]] = {
    ToolCategory.BROWSER: BROWSER_TOOLS,
    ToolCategory.FORM: FORM_TOOLS,
    ToolCategory.AUTH: AUTH_TOOLS,
    ToolCategory.AUDIT: AUDIT_TOOLS,
    ToolCategory.SCHEDULER: SCHEDULER_TOOLS,
}

# Feature gate mappings
TOOL_FEATURE_GATES = {
    "agent_browser_tools": {
        "tools": ["browse_website", "click_element", "extract_text", "take_screenshot", "scroll_page", "get_page_info"],
        "default_limit": 50,  # per hour
        "tier_limits": {
            "free": 0,
            "starter": 25,
            "professional": 100,
            "enterprise": 500
        }
    },
    "agent_form_tools": {
        "tools": ["fill_form", "submit_form", "select_option"],
        "default_limit": 25,
        "tier_limits": {
            "free": 0,
            "starter": 0,
            "professional": 50,
            "enterprise": 250
        }
    },
    "agent_auth_tools": {
        "tools": ["login_to_website", "check_login_status"],
        "default_limit": 10,
        "tier_limits": {
            "free": 0,
            "starter": 0,
            "professional": 25,
            "enterprise": 100
        }
    },
    "agent_audit_tools": {
        "tools": ["audit_seo", "audit_accessibility", "audit_performance", "audit_security", "check_broken_links"],
        "default_limit": 20,
        "tier_limits": {
            "free": 5,
            "starter": 15,
            "professional": 50,
            "enterprise": 200
        }
    },
    "agent_scheduled_tasks": {
        "tools": ["create_scheduled_task", "list_scheduled_tasks", "delete_scheduled_task"],
        "default_limit": 5,  # max active tasks
        "tier_limits": {
            "free": 0,
            "starter": 0,
            "professional": 10,
            "enterprise": 50
        }
    }
}


def get_tool_schema(tool_name: str) -> Optional[Dict[str, Any]]:
    """Get the schema for a specific tool"""
    return TOOL_REGISTRY.get(tool_name)


def get_tools_for_openai(tool_names: List[str]) -> List[Dict[str, Any]]:
    """Get tool definitions in OpenAI format for specified tools"""
    tools = []
    for name in tool_names:
        tool = TOOL_REGISTRY.get(name)
        if tool:
            # Return only the OpenAI-compatible part
            tools.append({
                "type": tool["type"],
                "function": tool["function"]
            })
    return tools


def get_all_tool_names() -> List[str]:
    """Get list of all available tool names"""
    return list(TOOL_REGISTRY.keys())


def get_tools_by_feature(feature_key: str) -> List[str]:
    """Get tool names enabled by a feature key"""
    gate = TOOL_FEATURE_GATES.get(feature_key, {})
    return gate.get("tools", [])


def get_feature_for_tool(tool_name: str) -> Optional[str]:
    """Get the feature key required for a tool"""
    tool = TOOL_REGISTRY.get(tool_name)
    if tool:
        return tool.get("feature_key")
    return None
