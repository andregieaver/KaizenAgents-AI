"""
Error Tracking Service

Centralized error logging and tracking for production monitoring.
Integrates with external services (Sentry) when configured.
"""
import logging
import traceback
import os
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from functools import wraps

logger = logging.getLogger(__name__)

# Sentry integration (optional)
SENTRY_DSN = os.environ.get("SENTRY_DSN")
sentry_sdk = None

if SENTRY_DSN:
    try:
        import sentry_sdk as _sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
        
        _sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[
                FastApiIntegration(),
                StarletteIntegration(),
            ],
            traces_sample_rate=0.1,  # 10% of transactions for performance monitoring
            profiles_sample_rate=0.1,
            environment=os.environ.get("ENVIRONMENT", "development"),
        )
        sentry_sdk = _sentry_sdk
        logger.info("Sentry error tracking initialized")
    except ImportError:
        logger.warning("Sentry SDK not installed. Run: pip install sentry-sdk[fastapi]")
    except Exception as e:
        logger.warning(f"Failed to initialize Sentry: {e}")


class ErrorTracker:
    """Centralized error tracking and logging"""
    
    def __init__(self):
        self.error_counts: Dict[str, int] = {}
        self.recent_errors: list = []
        self.max_recent_errors = 100
    
    def capture_exception(
        self,
        error: Exception,
        context: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> str:
        """
        Capture and log an exception
        
        Returns:
            Error ID for reference
        """
        error_id = f"err_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
        error_type = type(error).__name__
        
        # Build error record
        error_record = {
            "id": error_id,
            "type": error_type,
            "message": str(error),
            "traceback": traceback.format_exc(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "context": context or {},
            "user_id": user_id,
            "tenant_id": tenant_id,
        }
        
        # Update counts
        self.error_counts[error_type] = self.error_counts.get(error_type, 0) + 1
        
        # Store recent error
        self.recent_errors.append(error_record)
        if len(self.recent_errors) > self.max_recent_errors:
            self.recent_errors.pop(0)
        
        # Log the error
        logger.error(
            f"[{error_id}] {error_type}: {error}",
            extra={
                "error_id": error_id,
                "error_type": error_type,
                "user_id": user_id,
                "tenant_id": tenant_id,
                "context": context,
            }
        )
        
        # Send to Sentry if configured
        if sentry_sdk:
            with sentry_sdk.push_scope() as scope:
                if user_id:
                    scope.set_user({"id": user_id})
                if tenant_id:
                    scope.set_tag("tenant_id", tenant_id)
                if context:
                    for key, value in context.items():
                        scope.set_extra(key, value)
                sentry_sdk.capture_exception(error)
        
        return error_id
    
    def capture_message(
        self,
        message: str,
        level: str = "info",
        context: Optional[Dict[str, Any]] = None
    ):
        """Capture a message for logging"""
        log_func = getattr(logger, level, logger.info)
        log_func(message, extra={"context": context})
        
        if sentry_sdk and level in ["warning", "error"]:
            sentry_sdk.capture_message(message, level=level)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get error statistics"""
        return {
            "total_errors": sum(self.error_counts.values()),
            "error_counts_by_type": self.error_counts.copy(),
            "recent_errors_count": len(self.recent_errors),
        }
    
    def get_recent_errors(self, limit: int = 10) -> list:
        """Get recent errors (without full traceback for API response)"""
        return [
            {
                "id": e["id"],
                "type": e["type"],
                "message": e["message"][:200],  # Truncate message
                "timestamp": e["timestamp"],
                "tenant_id": e.get("tenant_id"),
            }
            for e in self.recent_errors[-limit:]
        ]


# Global error tracker instance
error_tracker = ErrorTracker()


def track_errors(func):
    """Decorator to automatically track errors in async functions"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            error_tracker.capture_exception(
                e,
                context={"function": func.__name__, "args": str(args)[:100]}
            )
            raise
    return wrapper


def track_errors_sync(func):
    """Decorator to automatically track errors in sync functions"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            error_tracker.capture_exception(
                e,
                context={"function": func.__name__, "args": str(args)[:100]}
            )
            raise
    return wrapper
