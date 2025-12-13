"""
Observability middleware for request/response logging and performance tracking
"""
from fastapi import Request
from datetime import datetime, timezone
import time
import uuid
from typing import Dict, List
from collections import defaultdict
from utils.logger import RequestLogger, log_info, log_error

# Performance metrics storage (in-memory)
class PerformanceMetrics:
    def __init__(self):
        self.request_counts: Dict[str, int] = defaultdict(int)
        self.response_times: Dict[str, List[float]] = defaultdict(list)
        self.error_counts: Dict[str, int] = defaultdict(int)
        self.slow_requests: List[Dict] = []
        self.max_slow_requests = 100
    
    def record_request(self, method: str, path: str, duration: float, status_code: int):
        """Record request metrics"""
        endpoint = f"{method} {path}"
        
        # Increment request count
        self.request_counts[endpoint] += 1
        
        # Record response time
        self.response_times[endpoint].append(duration)
        
        # Keep only last 1000 response times per endpoint
        if len(self.response_times[endpoint]) > 1000:
            self.response_times[endpoint] = self.response_times[endpoint][-1000:]
        
        # Track errors
        if status_code >= 400:
            self.error_counts[endpoint] += 1
        
        # Track slow requests (> 1 second)
        if duration > 1.0:
            self.slow_requests.append({
                "endpoint": endpoint,
                "duration": duration,
                "status_code": status_code,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
            # Keep only last N slow requests
            if len(self.slow_requests) > self.max_slow_requests:
                self.slow_requests = self.slow_requests[-self.max_slow_requests:]
    
    def get_endpoint_stats(self, endpoint: str) -> Dict:
        """Get statistics for a specific endpoint"""
        response_times = self.response_times.get(endpoint, [])
        
        if not response_times:
            return {
                "request_count": 0,
                "avg_response_time": 0,
                "min_response_time": 0,
                "max_response_time": 0,
                "error_count": 0
            }
        
        return {
            "request_count": self.request_counts.get(endpoint, 0),
            "avg_response_time": sum(response_times) / len(response_times),
            "min_response_time": min(response_times),
            "max_response_time": max(response_times),
            "error_count": self.error_counts.get(endpoint, 0),
            "p95_response_time": sorted(response_times)[int(len(response_times) * 0.95)] if len(response_times) > 0 else 0,
            "p99_response_time": sorted(response_times)[int(len(response_times) * 0.99)] if len(response_times) > 0 else 0
        }
    
    def get_all_stats(self) -> Dict:
        """Get all endpoint statistics"""
        stats = {}
        for endpoint in self.request_counts.keys():
            stats[endpoint] = self.get_endpoint_stats(endpoint)
        
        return {
            "endpoints": stats,
            "total_requests": sum(self.request_counts.values()),
            "total_errors": sum(self.error_counts.values()),
            "slow_requests_count": len(self.slow_requests),
            "slow_requests": self.slow_requests[-10:]  # Last 10 slow requests
        }

# Global metrics instance
metrics = PerformanceMetrics()

async def observability_middleware(request: Request, call_next):
    """
    Middleware for request/response logging and performance tracking
    """
    # Generate request ID
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    # Get user context if available
    user_id = getattr(request.state, "user_id", None)
    tenant_id = getattr(request.state, "tenant_id", None)
    
    # Create request logger
    req_logger = RequestLogger(request_id, user_id, tenant_id)
    
    # Skip logging for health check and static files
    skip_paths = ["/health", "/docs", "/openapi.json", "/api/media"]
    should_log = not any(request.url.path.startswith(path) for path in skip_paths)
    
    # Log incoming request
    if should_log:
        req_logger.info(
            "Incoming request",
            method=request.method,
            path=request.url.path,
            query_params=str(request.query_params),
            client_ip=request.client.host if request.client else "unknown"
        )
    
    # Record start time
    start_time = time.time()
    
    # Process request
    try:
        response = await call_next(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Add custom headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{duration:.3f}s"
        
        # Record metrics
        metrics.record_request(
            request.method,
            request.url.path,
            duration,
            response.status_code
        )
        
        # Log response
        if should_log:
            log_level = "warning" if response.status_code >= 400 else "info"
            log_method = getattr(req_logger, log_level)
            
            log_method(
                "Request completed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=round(duration * 1000, 2)
            )
        
        # Log slow requests
        if duration > 1.0 and should_log:
            req_logger.warning(
                "Slow request detected",
                method=request.method,
                path=request.url.path,
                duration_ms=round(duration * 1000, 2),
                threshold_ms=1000
            )
        
        return response
        
    except Exception as e:
        # Calculate duration
        duration = time.time() - start_time
        
        # Record error metrics
        metrics.record_request(
            request.method,
            request.url.path,
            duration,
            500
        )
        
        # Log error
        req_logger.error(
            "Request failed with exception",
            error=e,
            method=request.method,
            path=request.url.path,
            duration_ms=round(duration * 1000, 2)
        )
        
        # Re-raise the exception
        raise

def get_metrics():
    """Get current performance metrics"""
    return metrics.get_all_stats()

def reset_metrics():
    """Reset all metrics"""
    global metrics
    metrics = PerformanceMetrics()
