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
    PROJECT = "project"


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
            "name": "logout_from_website",
            "description": "Log out from the current website session",
            "parameters": {
                "type": "object",
                "properties": {
                    "logout_url": {
                        "type": "string",
                        "description": "URL to navigate to for logout (optional)"
                    },
                    "logout_selector": {
                        "type": "string",
                        "description": "CSS selector for logout button/link (optional)"
                    },
                    "clear_cookies": {
                        "type": "boolean",
                        "description": "Clear all session cookies",
                        "default": True
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
# PROJECT MANAGEMENT TOOLS
# =============================================================================

PROJECT_TOOLS = [
    # Space Management
    {
        "type": "function",
        "function": {
            "name": "create_space",
            "description": "Create a new space (workspace) to organize projects. Spaces are top-level containers for projects.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Name of the space (e.g., 'Marketing', 'Development', 'HR')"
                    },
                    "description": {
                        "type": "string",
                        "description": "Description of the space's purpose"
                    },
                    "color": {
                        "type": "string",
                        "description": "Hex color code for the space (e.g., '#6366F1')"
                    }
                },
                "required": ["name"]
            }
        },
        "category": ToolCategory.PROJECT,
        "feature_key": "agent_project_tools"
    },
    {
        "type": "function",
        "function": {
            "name": "list_spaces",
            "description": "List all spaces (workspaces) in the system with their project counts",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        },
        "category": ToolCategory.PROJECT,
        "feature_key": "agent_project_tools"
    },
    {
        "type": "function",
        "function": {
            "name": "get_space",
            "description": "Get details of a specific space including its projects",
            "parameters": {
                "type": "object",
                "properties": {
                    "space_id": {
                        "type": "string",
                        "description": "ID of the space"
                    },
                    "space_name": {
                        "type": "string",
                        "description": "Name of the space (alternative to ID)"
                    }
                }
            }
        },
        "category": ToolCategory.PROJECT,
        "feature_key": "agent_project_tools"
    },
    # Project Management
    {
        "type": "function",
        "function": {
            "name": "create_project",
            "description": "Create a new project within a space",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Name of the project"
                    },
                    "space_id": {
                        "type": "string",
                        "description": "ID of the space to create project in"
                    },
                    "space_name": {
                        "type": "string",
                        "description": "Name of the space (alternative to space_id)"
                    },
                    "description": {
                        "type": "string",
                        "description": "Project description"
                    },
                    "start_date": {
                        "type": "string",
                        "description": "Project start date (YYYY-MM-DD)"
                    },
                    "end_date": {
                        "type": "string",
                        "description": "Project end date (YYYY-MM-DD)"
                    },
                    "color": {
                        "type": "string",
                        "description": "Hex color code for the project"
                    }
                },
                "required": ["name"]
            }
        },
        "category": ToolCategory.PROJECT,
        "feature_key": "agent_project_tools"
    },
    {
        "type": "function",
        "function": {
            "name": "list_projects",
            "description": "List all projects, optionally filtered by space",
            "parameters": {
                "type": "object",
                "properties": {
                    "space_id": {
                        "type": "string",
                        "description": "Filter by space ID"
                    },
                    "space_name": {
                        "type": "string",
                        "description": "Filter by space name"
                    },
                    "status": {
                        "type": "string",
                        "description": "Filter by status (active, completed, on_hold, archived)"
                    }
                }
            }
        },
        "category": ToolCategory.PROJECT,
        "feature_key": "agent_project_tools"
    },
    {
        "type": "function",
        "function": {
            "name": "get_project",
            "description": "Get full details of a project including lists, tasks, and progress",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "ID of the project"
                    },
                    "project_name": {
                        "type": "string",
                        "description": "Name of the project (alternative to ID)"
                    }
                }
            }
        },
        "category": ToolCategory.PROJECT,
        "feature_key": "agent_project_tools"
    },
    {
        "type": "function",
        "function": {
            "name": "update_project",
            "description": "Update a project's details (name, description, status, dates)",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "ID of the project to update"
                    },
                    "project_name": {
                        "type": "string",
                        "description": "Name of the project (alternative to ID)"
                    },
                    "name": {
                        "type": "string",
                        "description": "New name for the project"
                    },
                    "description": {
                        "type": "string",
                        "description": "New description"
                    },
                    "status": {
                        "type": "string",
                        "description": "New status (planning, active, on_hold, completed, archived)"
                    },
                    "start_date": {
                        "type": "string",
                        "description": "New start date (YYYY-MM-DD)"
                    },
                    "end_date": {
                        "type": "string",
                        "description": "New end date (YYYY-MM-DD)"
                    }
                }
            }
        },
        "category": ToolCategory.PROJECT,
        "feature_key": "agent_project_tools"
    },
    # List Management
    {
        "type": "function",
        "function": {
            "name": "create_list",
            "description": "Create a new list (task group/section) in a project",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "ID of the project"
                    },
                    "project_name": {
                        "type": "string",
                        "description": "Name of the project (alternative to ID)"
                    },
                    "name": {
                        "type": "string",
                        "description": "Name of the list (e.g., 'Backlog', 'In Review', 'Blocked')"
                    },
                    "color": {
                        "type": "string",
                        "description": "Hex color code for the list"
                    }
                },
                "required": ["name"]
            }
        },
        "category": ToolCategory.PROJECT,
        "feature_key": "agent_project_tools"
    },
    # Task Management
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": "Create a new task in a project",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "ID of the project"
                    },
                    "project_name": {
                        "type": "string",
                        "description": "Name of the project (alternative to ID)"
                    },
                    "list_id": {
                        "type": "string",
                        "description": "ID of the list to add task to"
                    },
                    "list_name": {
                        "type": "string",
                        "description": "Name of the list (alternative to ID)"
                    },
                    "title": {
                        "type": "string",
                        "description": "Task title"
                    },
                    "description": {
                        "type": "string",
                        "description": "Task description"
                    },
                    "status": {
                        "type": "string",
                        "description": "Task status (todo, in_progress, review, done)"
                    },
                    "priority": {
                        "type": "string",
                        "description": "Task priority (low, medium, high, urgent)"
                    },
                    "due_date": {
                        "type": "string",
                        "description": "Due date (YYYY-MM-DD)"
                    },
                    "start_date": {
                        "type": "string",
                        "description": "Start date (YYYY-MM-DD)"
                    },
                    "estimated_hours": {
                        "type": "number",
                        "description": "Estimated hours to complete"
                    },
                    "assignee_id": {
                        "type": "string",
                        "description": "ID of the user to assign"
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Tags for categorization"
                    }
                },
                "required": ["title"]
            }
        },
        "category": ToolCategory.PROJECT,
        "feature_key": "agent_project_tools"
    },
    {
        "type": "function",
        "function": {
            "name": "update_task",
            "description": "Update an existing task",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "ID of the project"
                    },
                    "task_id": {
                        "type": "string",
                        "description": "ID of the task to update"
                    },
                    "task_title": {
                        "type": "string",
                        "description": "Title of the task (alternative to ID)"
                    },
                    "title": {
                        "type": "string",
                        "description": "New title"
                    },
                    "description": {
                        "type": "string",
                        "description": "New description"
                    },
                    "status": {
                        "type": "string",
                        "description": "New status"
                    },
                    "priority": {
                        "type": "string",
                        "description": "New priority"
                    },
                    "due_date": {
                        "type": "string",
                        "description": "New due date"
                    },
                    "list_id": {
                        "type": "string",
                        "description": "Move to different list"
                    }
                }
            }
        },
        "category": ToolCategory.PROJECT,
        "feature_key": "agent_project_tools"
    },
    {
        "type": "function",
        "function": {
            "name": "complete_task",
            "description": "Mark a task as completed (set status to 'done')",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "ID of the project"
                    },
                    "task_id": {
                        "type": "string",
                        "description": "ID of the task"
                    },
                    "task_title": {
                        "type": "string",
                        "description": "Title of the task (alternative to ID)"
                    }
                }
            }
        },
        "category": ToolCategory.PROJECT,
        "feature_key": "agent_project_tools"
    },
    {
        "type": "function",
        "function": {
            "name": "delete_task",
            "description": "Delete a task from a project",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "ID of the project"
                    },
                    "task_id": {
                        "type": "string",
                        "description": "ID of the task"
                    },
                    "task_title": {
                        "type": "string",
                        "description": "Title of the task (alternative to ID)"
                    }
                }
            }
        },
        "category": ToolCategory.PROJECT,
        "feature_key": "agent_project_tools"
    },
    # Subtask Management
    {
        "type": "function",
        "function": {
            "name": "create_subtask",
            "description": "Create a subtask under a parent task",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "ID of the project"
                    },
                    "parent_task_id": {
                        "type": "string",
                        "description": "ID of the parent task"
                    },
                    "parent_task_title": {
                        "type": "string",
                        "description": "Title of parent task (alternative to ID)"
                    },
                    "title": {
                        "type": "string",
                        "description": "Subtask title"
                    },
                    "description": {
                        "type": "string",
                        "description": "Subtask description"
                    },
                    "priority": {
                        "type": "string",
                        "description": "Priority (low, medium, high, urgent)"
                    },
                    "due_date": {
                        "type": "string",
                        "description": "Due date (YYYY-MM-DD)"
                    }
                },
                "required": ["title"]
            }
        },
        "category": ToolCategory.PROJECT,
        "feature_key": "agent_project_tools"
    },
    # Checklist Management
    {
        "type": "function",
        "function": {
            "name": "add_checklist",
            "description": "Add a checklist to a task",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "ID of the project"
                    },
                    "task_id": {
                        "type": "string",
                        "description": "ID of the task"
                    },
                    "task_title": {
                        "type": "string",
                        "description": "Title of the task (alternative to ID)"
                    },
                    "checklist_name": {
                        "type": "string",
                        "description": "Name of the checklist (e.g., 'Requirements', 'Testing Steps')"
                    },
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "text": {"type": "string"},
                                "is_completed": {"type": "boolean"}
                            }
                        },
                        "description": "Checklist items"
                    }
                },
                "required": ["checklist_name"]
            }
        },
        "category": ToolCategory.PROJECT,
        "feature_key": "agent_project_tools"
    },
    {
        "type": "function",
        "function": {
            "name": "update_checklist_item",
            "description": "Mark a checklist item as completed or not completed",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "ID of the project"
                    },
                    "task_id": {
                        "type": "string",
                        "description": "ID of the task"
                    },
                    "checklist_id": {
                        "type": "string",
                        "description": "ID of the checklist"
                    },
                    "checklist_name": {
                        "type": "string",
                        "description": "Name of the checklist (alternative to ID)"
                    },
                    "item_text": {
                        "type": "string",
                        "description": "Text of the item to update"
                    },
                    "is_completed": {
                        "type": "boolean",
                        "description": "Whether the item is completed"
                    }
                },
                "required": ["is_completed"]
            }
        },
        "category": ToolCategory.PROJECT,
        "feature_key": "agent_project_tools"
    },
    # Task Dependencies
    {
        "type": "function",
        "function": {
            "name": "add_task_dependency",
            "description": "Add a dependency between tasks (task B depends on task A completing first)",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "ID of the project"
                    },
                    "task_id": {
                        "type": "string",
                        "description": "ID of the task that has the dependency"
                    },
                    "depends_on_task_id": {
                        "type": "string",
                        "description": "ID of the task that must be completed first"
                    },
                    "task_title": {
                        "type": "string",
                        "description": "Title of the dependent task (alternative to task_id)"
                    },
                    "depends_on_task_title": {
                        "type": "string",
                        "description": "Title of the prerequisite task (alternative to depends_on_task_id)"
                    }
                }
            }
        },
        "category": ToolCategory.PROJECT,
        "feature_key": "agent_project_tools"
    }
]


# =============================================================================
# REGISTRY
# =============================================================================

# All tools combined
ALL_TOOLS = BROWSER_TOOLS + FORM_TOOLS + AUTH_TOOLS + AUDIT_TOOLS + SCHEDULER_TOOLS + PROJECT_TOOLS

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
        "tools": ["login_to_website", "logout_from_website", "check_login_status"],
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
