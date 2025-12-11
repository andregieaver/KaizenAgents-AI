from pydantic import BaseModel, ConfigDict
from typing import Optional, Literal

class StorageConfigCreate(BaseModel):
    storage_type: Literal["local", "gcs", "s3", "azure"]
    gcs_service_account_json: Optional[str] = None
    gcs_bucket_name: Optional[str] = None
    gcs_region: Optional[str] = "us-central1"

class StorageConfigResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    storage_type: str
    gcs_bucket_name: Optional[str] = None
    gcs_region: Optional[str] = None
    gcs_configured: bool = False
    updated_at: Optional[str] = None
