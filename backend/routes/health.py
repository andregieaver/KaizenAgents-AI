"""
Health check and observability routes
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Dict, Any
import os

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

from middleware import get_super_admin_user
from middleware.database import db
from middleware.observability import get_metrics, reset_metrics

router = APIRouter(tags=["health"])

@router.get("/health")
async def health_check():
    """
    Public health check endpoint
    Returns system health status
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "AI Support Hub API",
        "version": "1.0.0"
    }
    
    # Check database connection
    try:
        await db.command("ping")
        health_status["database"] = "connected"
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["database"] = "disconnected"
        health_status["database_error"] = str(e)
    
    return health_status

@router.get("/health/detailed")
async def detailed_health_check(current_user: dict = Depends(get_super_admin_user)):
    """
    Detailed health check with system metrics (Super Admin only)
    """
    health_data = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "AI Support Hub API",
        "version": "1.0.0"
    }
    
    if PSUTIL_AVAILABLE:
        health_data["uptime_seconds"] = int(datetime.now().timestamp() - psutil.boot_time())
    
    # Database check
    try:
        db_ping_start = datetime.now()
        await db.command("ping")
        db_ping_duration = (datetime.now() - db_ping_start).total_seconds()
        
        # Get collection counts
        collections = {}
        for collection_name in ["users", "tenants", "conversations", "messages", "settings"]:
            try:
                count = await db[collection_name].count_documents({})
                collections[collection_name] = count
            except Exception:
                collections[collection_name] = "error"
        
        health_data["database"] = {
            "status": "connected",
            "ping_ms": round(db_ping_duration * 1000, 2),
            "collections": collections
        }
    except Exception as e:
        health_data["status"] = "degraded"
        health_data["database"] = {
            "status": "disconnected",
            "error": str(e)
        }
    
    # System metrics
    if PSUTIL_AVAILABLE:
        try:
            health_data["system"] = {
                "cpu_percent": psutil.cpu_percent(interval=0.1),
                "memory_percent": psutil.virtual_memory().percent,
                "memory_used_mb": psutil.virtual_memory().used / (1024 * 1024),
                "memory_total_mb": psutil.virtual_memory().total / (1024 * 1024),
                "disk_percent": psutil.disk_usage('/').percent,
                "disk_used_gb": psutil.disk_usage('/').used / (1024 * 1024 * 1024),
                "disk_total_gb": psutil.disk_usage('/').total / (1024 * 1024 * 1024)
            }
        except Exception as e:
            health_data["system"] = {"error": str(e)}
    else:
        health_data["system"] = {"available": False, "message": "psutil not installed"}
    
    return health_data

@router.get("/metrics")
async def get_performance_metrics(current_user: dict = Depends(get_super_admin_user)):
    """
    Get performance metrics (Super Admin only)
    Returns request counts, response times, and error rates
    """
    try:
        metrics_data = get_metrics()
        
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metrics": metrics_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get metrics: {str(e)}")

@router.post("/metrics/reset")
async def reset_performance_metrics(current_user: dict = Depends(get_super_admin_user)):
    """
    Reset performance metrics (Super Admin only)
    """
    try:
        reset_metrics()
        return {
            "message": "Metrics reset successfully",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset metrics: {str(e)}")

@router.get("/logs/recent")
async def get_recent_logs(
    limit: int = 100,
    level: str = "all",
    current_user: dict = Depends(get_super_admin_user)
):
    """
    Get recent log entries (Super Admin only)
    """
    try:
        logs = []
        log_file = "/var/log/app.log"
        
        if os.path.exists(log_file):
            with open(log_file, 'r') as f:
                # Read last N lines
                lines = f.readlines()[-limit:]
                
                for line in lines:
                    try:
                        import json
                        log_entry = json.loads(line.strip())
                        
                        # Filter by level if specified
                        if level != "all" and log_entry.get("level", "").lower() != level.lower():
                            continue
                        
                        logs.append(log_entry)
                    except Exception:
                        # Skip malformed lines
                        continue
        
        return {
            "logs": logs,
            "count": len(logs),
            "level_filter": level,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read logs: {str(e)}")

@router.get("/logs/errors")
async def get_error_logs(
    limit: int = 50,
    current_user: dict = Depends(get_super_admin_user)
):
    """
    Get recent error logs (Super Admin only)
    """
    try:
        errors = []
        error_log_file = "/var/log/app_errors.log"
        
        if os.path.exists(error_log_file):
            with open(error_log_file, 'r') as f:
                lines = f.readlines()[-limit:]
                
                for line in lines:
                    try:
                        import json
                        error_entry = json.loads(line.strip())
                        errors.append(error_entry)
                    except Exception:
                        continue
        
        return {
            "errors": errors,
            "count": len(errors),
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read error logs: {str(e)}")
