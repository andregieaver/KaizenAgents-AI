"""
Structured logging utility for the application
"""
import logging
import json
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import traceback

class StructuredLogger:
    """Custom structured logger with JSON formatting"""
    
    def __init__(self, name: str = "app"):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.INFO)
        
        # Avoid duplicate handlers
        if not self.logger.handlers:
            # Console handler with JSON formatting
            console_handler = logging.StreamHandler(sys.stdout)
            console_handler.setLevel(logging.INFO)
            console_handler.setFormatter(JSONFormatter())
            self.logger.addHandler(console_handler)
            
            # File handler for all logs
            try:
                file_handler = logging.FileHandler('/var/log/app.log')
                file_handler.setLevel(logging.INFO)
                file_handler.setFormatter(JSONFormatter())
                self.logger.addHandler(file_handler)
            except Exception as e:
                print(f"Warning: Could not create file handler: {e}")
            
            # Error file handler
            try:
                error_handler = logging.FileHandler('/var/log/app_errors.log')
                error_handler.setLevel(logging.ERROR)
                error_handler.setFormatter(JSONFormatter())
                self.logger.addHandler(error_handler)
            except Exception as e:
                print(f"Warning: Could not create error file handler: {e}")
    
    def _log(self, level: str, message: str, extra: Optional[Dict[str, Any]] = None):
        """Internal log method with structured data"""
        log_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "message": message,
        }
        
        if extra:
            log_data.update(extra)
        
        log_method = getattr(self.logger, level.lower())
        log_method(json.dumps(log_data))
    
    def info(self, message: str, **kwargs):
        """Log info level message"""
        self._log("INFO", message, kwargs)
    
    def warning(self, message: str, **kwargs):
        """Log warning level message"""
        self._log("WARNING", message, kwargs)
    
    def error(self, message: str, error: Optional[Exception] = None, **kwargs):
        """Log error level message with optional exception"""
        extra = kwargs.copy()
        
        if error:
            extra["error_type"] = type(error).__name__
            extra["error_message"] = str(error)
            extra["traceback"] = traceback.format_exc()
        
        self._log("ERROR", message, extra)
    
    def debug(self, message: str, **kwargs):
        """Log debug level message"""
        self._log("DEBUG", message, kwargs)

class JSONFormatter(logging.Formatter):
    """Custom formatter to output logs as JSON"""
    
    def format(self, record):
        # If the message is already JSON, return it as-is
        try:
            json.loads(record.getMessage())
            return record.getMessage()
        except (json.JSONDecodeError, ValueError):
            # Otherwise, create a JSON structure
            log_data = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "level": record.levelname,
                "message": record.getMessage(),
                "module": record.module,
                "function": record.funcName,
                "line": record.lineno,
            }
            
            if record.exc_info:
                log_data["exception"] = self.formatException(record.exc_info)
            
            return json.dumps(log_data)

# Global logger instance
logger = StructuredLogger()

# Convenience functions
def log_info(message: str, **kwargs):
    """Log info message"""
    logger.info(message, **kwargs)

def log_warning(message: str, **kwargs):
    """Log warning message"""
    logger.warning(message, **kwargs)

def log_error(message: str, error: Optional[Exception] = None, **kwargs):
    """Log error message"""
    logger.error(message, error=error, **kwargs)

def log_debug(message: str, **kwargs):
    """Log debug message"""
    logger.debug(message, **kwargs)

# Request context logger
class RequestLogger:
    """Logger with request context"""
    
    def __init__(self, request_id: str, user_id: Optional[str] = None, tenant_id: Optional[str] = None):
        self.request_id = request_id
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.base_logger = logger
    
    def _add_context(self, extra: Dict[str, Any]) -> Dict[str, Any]:
        """Add request context to log data"""
        context = {
            "request_id": self.request_id,
        }
        if self.user_id:
            context["user_id"] = self.user_id
        if self.tenant_id:
            context["tenant_id"] = self.tenant_id
        
        return {**context, **extra}
    
    def info(self, message: str, **kwargs):
        self.base_logger.info(message, **self._add_context(kwargs))
    
    def warning(self, message: str, **kwargs):
        self.base_logger.warning(message, **self._add_context(kwargs))
    
    def error(self, message: str, error: Optional[Exception] = None, **kwargs):
        self.base_logger.error(message, error=error, **self._add_context(kwargs))
    
    def debug(self, message: str, **kwargs):
        self.base_logger.debug(message, **self._add_context(kwargs))
