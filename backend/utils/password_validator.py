"""
Password validation utilities with strong security requirements
"""
import re
from typing import Tuple

def validate_password(password: str) -> Tuple[bool, str]:
    """
    Validate password against security requirements.

    Requirements:
    - Minimum 12 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character

    Returns:
        Tuple of (is_valid, error_message)
    """
    if len(password) < 12:
        return False, "Password must be at least 12 characters long"

    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"

    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"

    if not re.search(r'\d', password):
        return False, "Password must contain at least one digit"

    if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;`~]', password):
        return False, "Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>_-+=[]\\\/;`~)"

    return True, ""

def get_password_requirements() -> str:
    """
    Get password requirements as a human-readable string.
    """
    return (
        "Password must:\n"
        "- Be at least 12 characters long\n"
        "- Contain at least one uppercase letter\n"
        "- Contain at least one lowercase letter\n"
        "- Contain at least one digit\n"
        "- Contain at least one special character"
    )
