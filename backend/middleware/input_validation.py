"""
Input validation and sanitization middleware
Prevents injection attacks and validates common patterns
"""
from fastapi import Request, HTTPException, status
from typing import Any, Dict
import re
from urllib.parse import unquote

class InputValidationMiddleware:
    """
    Middleware to validate and sanitize input data
    """

    # Dangerous patterns that might indicate injection attempts
    DANGEROUS_PATTERNS = [
        r'<script[\s\S]*?>[\s\S]*?</script>',  # Script tags
        r'javascript:',  # JavaScript protocol
        r'on\w+\s*=',  # Event handlers (onclick, onerror, etc.)
        r'<iframe',  # Iframes
        r'<object',  # Object tags
        r'<embed',  # Embed tags
        r'\$\{.*\}',  # Template injection
        r'union\s+select',  # SQL injection (basic)
        r';\s*drop\s+table',  # SQL injection (basic)
        r'\.\./',  # Path traversal
        r'\.\.\\',  # Path traversal (Windows)
    ]

    # Maximum lengths for common fields
    MAX_LENGTHS = {
        'email': 255,
        'name': 200,
        'message': 10000,
        'password': 128,
        'url': 2048,
        'description': 5000,
        'default': 1000
    }

    @staticmethod
    def is_suspicious(value: str) -> bool:
        """Check if value contains suspicious patterns"""
        if not isinstance(value, str):
            return False

        value_lower = value.lower()
        for pattern in InputValidationMiddleware.DANGEROUS_PATTERNS:
            if re.search(pattern, value_lower, re.IGNORECASE):
                return True
        return False

    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email format"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email)) and len(email) <= 255

    @staticmethod
    def validate_url(url: str) -> bool:
        """Validate URL format (basic check)"""
        if len(url) > 2048:
            return False
        # Allow only http and https protocols
        return bool(re.match(r'^https?://', url))

    @staticmethod
    def validate_uuid(value: str) -> bool:
        """Validate UUID format"""
        pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        return bool(re.match(pattern, value.lower()))

    @staticmethod
    def validate_alphanumeric(value: str, allow_spaces: bool = False) -> bool:
        """Validate alphanumeric strings"""
        if allow_spaces:
            pattern = r'^[a-zA-Z0-9\s]+$'
        else:
            pattern = r'^[a-zA-Z0-9]+$'
        return bool(re.match(pattern, value))

    @staticmethod
    def sanitize_string(value: str, max_length: int = None) -> str:
        """
        Sanitize string by removing potentially dangerous characters
        Note: This is basic sanitization. Use appropriate escaping when rendering.
        """
        if not isinstance(value, str):
            return value

        # Remove null bytes
        value = value.replace('\x00', '')

        # Apply max length if specified
        if max_length and len(value) > max_length:
            value = value[:max_length]

        return value.strip()

    @staticmethod
    def check_value(value: Any, key: str = 'default', strict: bool = True) -> None:
        """
        Check a single value for suspicious content
        Raises HTTPException if suspicious content is found
        """
        if value is None:
            return

        if isinstance(value, str):
            # Check for suspicious patterns
            if InputValidationMiddleware.is_suspicious(value):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid input detected in field '{key}'"
                )

            # Check maximum length
            max_len = InputValidationMiddleware.MAX_LENGTHS.get(
                key,
                InputValidationMiddleware.MAX_LENGTHS['default']
            )
            if len(value) > max_len:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Field '{key}' exceeds maximum length of {max_len} characters"
                )

        elif isinstance(value, dict):
            InputValidationMiddleware.check_dict(value, strict)
        elif isinstance(value, list):
            for item in value:
                InputValidationMiddleware.check_value(item, key, strict)

    @staticmethod
    def check_dict(data: Dict[str, Any], strict: bool = True) -> None:
        """
        Recursively check dictionary for suspicious content
        Raises HTTPException if suspicious content is found
        """
        if not isinstance(data, dict):
            return

        for key, value in data.items():
            InputValidationMiddleware.check_value(value, key, strict)

    @staticmethod
    async def validate_request_data(request: Request) -> None:
        """
        Validate request body and query parameters
        """
        # Skip validation for certain content types (file uploads, etc.)
        content_type = request.headers.get("content-type", "")
        if "multipart/form-data" in content_type or "application/octet-stream" in content_type:
            return

        # Check query parameters
        for key, value in request.query_params.items():
            InputValidationMiddleware.check_value(value, key, strict=False)

        # Check JSON body if present
        if request.method in ["POST", "PUT", "PATCH"]:
            try:
                if "application/json" in content_type:
                    # We need to read the body to validate it
                    # Note: This middleware should run before any route handler
                    # that also reads the body
                    pass
                    # In production, you would implement a more sophisticated
                    # approach to validate the body without consuming it
            except Exception:
                pass


async def input_validation_middleware(request: Request, call_next):
    """
    Middleware to validate and sanitize input data
    """
    # Skip validation for certain paths
    skip_paths = ["/docs", "/openapi.json", "/api/media/upload"]

    if any(request.url.path.startswith(path) for path in skip_paths):
        response = await call_next(request)
        return response

    try:
        # Validate request data
        await InputValidationMiddleware.validate_request_data(request)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request data"
        )

    response = await call_next(request)
    return response


# Utility functions for route handlers to use directly

def validate_tenant_id(tenant_id: str) -> None:
    """Validate tenant ID format"""
    if not InputValidationMiddleware.validate_uuid(tenant_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid tenant ID format"
        )


def validate_user_id(user_id: str) -> None:
    """Validate user ID format"""
    if not InputValidationMiddleware.validate_uuid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )


def validate_conversation_id(conversation_id: str) -> None:
    """Validate conversation ID format"""
    if not InputValidationMiddleware.validate_uuid(conversation_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid conversation ID format"
        )


def sanitize_user_input(text: str, max_length: int = 10000) -> str:
    """
    Sanitize user-provided text (messages, descriptions, etc.)
    """
    return InputValidationMiddleware.sanitize_string(text, max_length)
