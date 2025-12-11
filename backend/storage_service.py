"""
Storage Service - Unified interface for local and cloud storage
Supports: Local filesystem, Google Cloud Storage
"""

import os
import json
from pathlib import Path
from typing import Optional, BinaryIO
from datetime import datetime, timedelta


class StorageService:
    """Unified storage interface supporting local and GCS"""
    
    def __init__(self, storage_config: dict):
        self.storage_type = storage_config.get("storage_type", "local")
        self.config = storage_config
        
        # Initialize GCS client if configured
        if self.storage_type == "gcs":
            from google.cloud import storage
            service_account_info = json.loads(storage_config["gcs_service_account_json"])
            self.gcs_client = storage.Client.from_service_account_info(service_account_info)
            self.bucket_name = storage_config["gcs_bucket_name"]
            self.bucket = self.gcs_client.bucket(self.bucket_name)
    
    async def upload_file(self, file_content: bytes, destination_path: str, content_type: Optional[str] = None) -> str:
        """
        Upload file to configured storage
        Returns: Public URL or path to access the file
        """
        if self.storage_type == "gcs":
            return await self._upload_to_gcs(file_content, destination_path, content_type)
        else:
            return self._upload_to_local(file_content, destination_path)
    
    async def _upload_to_gcs(self, file_content: bytes, destination_path: str, content_type: Optional[str]) -> str:
        """Upload to Google Cloud Storage"""
        # Remove leading slash if present
        blob_name = destination_path.lstrip('/')
        
        blob = self.bucket.blob(blob_name)
        
        if content_type:
            blob.upload_from_string(file_content, content_type=content_type)
        else:
            blob.upload_from_string(file_content)
        
        # Make blob publicly accessible
        blob.make_public()
        
        # Return public URL
        return blob.public_url
    
    def _upload_to_local(self, file_content: bytes, destination_path: str) -> str:
        """Upload to local filesystem"""
        from pathlib import Path
        
        # Assuming destination_path is relative to uploads dir
        full_path = Path("/app/backend/uploads") / destination_path.lstrip('/')
        full_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(full_path, 'wb') as f:
            f.write(file_content)
        
        # Return API path
        return f"/api/uploads/{destination_path.lstrip('/')}"
    
    async def delete_file(self, file_path: str) -> bool:
        """
        Delete file from configured storage
        Returns: True if successful
        """
        if self.storage_type == "gcs":
            return await self._delete_from_gcs(file_path)
        else:
            return self._delete_from_local(file_path)
    
    async def _delete_from_gcs(self, file_path: str) -> bool:
        """Delete from Google Cloud Storage"""
        try:
            # Extract blob name from URL or path
            if file_path.startswith('http'):
                # Parse blob name from public URL
                blob_name = file_path.split(f"{self.bucket_name}/")[-1]
            else:
                blob_name = file_path.lstrip('/')
            
            blob = self.bucket.blob(blob_name)
            blob.delete()
            return True
        except Exception as e:
            print(f"Error deleting from GCS: {str(e)}")
            return False
    
    def _delete_from_local(self, file_path: str) -> bool:
        """Delete from local filesystem"""
        try:
            # Convert API path to filesystem path
            if file_path.startswith('/api/uploads/'):
                file_path = file_path.replace('/api/uploads/', '')
            
            full_path = Path("/app/backend/uploads") / file_path
            
            if full_path.exists():
                full_path.unlink()
                return True
            return False
        except Exception as e:
            print(f"Error deleting from local: {str(e)}")
            return False
    
    async def file_exists(self, file_path: str) -> bool:
        """Check if file exists in storage"""
        if self.storage_type == "gcs":
            return await self._exists_in_gcs(file_path)
        else:
            return self._exists_in_local(file_path)
    
    async def _exists_in_gcs(self, file_path: str) -> bool:
        """Check if file exists in GCS"""
        try:
            if file_path.startswith('http'):
                blob_name = file_path.split(f"{self.bucket_name}/")[-1]
            else:
                blob_name = file_path.lstrip('/')
            
            blob = self.bucket.blob(blob_name)
            return blob.exists()
        except:
            return False
    
    def _exists_in_local(self, file_path: str) -> bool:
        """Check if file exists locally"""
        if file_path.startswith('/api/uploads/'):
            file_path = file_path.replace('/api/uploads/', '')
        
        full_path = Path("/app/backend/uploads") / file_path
        return full_path.exists()
    
    async def get_signed_url(self, file_path: str, expiration_minutes: int = 60) -> str:
        """
        Get a signed URL for temporary access (useful for private files)
        For GCS: returns signed URL
        For local: returns regular path (no signing needed)
        """
        if self.storage_type == "gcs":
            blob_name = file_path.lstrip('/')
            blob = self.bucket.blob(blob_name)
            
            url = blob.generate_signed_url(
                version="v4",
                expiration=timedelta(minutes=expiration_minutes),
                method="GET"
            )
            return url
        else:
            # For local storage, just return the path
            return file_path if file_path.startswith('/api/uploads/') else f"/api/uploads/{file_path}"


async def get_storage_service(db) -> StorageService:
    """Factory function to get configured storage service"""
    config = await db.storage_config.find_one({}, {"_id": 0})
    
    if not config or config.get("storage_type") == "local":
        return StorageService({"storage_type": "local"})
    
    return StorageService(config)
