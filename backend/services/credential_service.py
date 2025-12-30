"""
Credential Service - Secure storage and management of website credentials
Uses Fernet (AES-128-CBC) encryption for credential storage
"""
import os
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from uuid import uuid4
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

logger = logging.getLogger(__name__)


class CredentialEncryption:
    """
    Handles encryption/decryption of credentials using Fernet
    Derives encryption key from master key using PBKDF2
    """
    
    def __init__(self, master_key: Optional[str] = None):
        """
        Initialize with master key from environment or parameter
        
        Args:
            master_key: Optional master key. If not provided, uses CREDENTIAL_MASTER_KEY env var
        """
        self.master_key = master_key or os.environ.get('CREDENTIAL_MASTER_KEY')
        
        if not self.master_key:
            # Generate a default key for development (NOT for production)
            logger.warning("No CREDENTIAL_MASTER_KEY set, using default development key")
            self.master_key = "dev-only-default-key-change-in-production"
        
        # Derive encryption key from master key
        self.fernet = self._create_fernet()
    
    def _create_fernet(self) -> Fernet:
        """Create Fernet instance with derived key"""
        # Use PBKDF2 to derive a key from the master key
        salt = b'agent_credentials_v1'  # Static salt (in production, use per-tenant salt)
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(self.master_key.encode()))
        return Fernet(key)
    
    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt a string
        
        Args:
            plaintext: String to encrypt
            
        Returns:
            Base64-encoded encrypted string
        """
        return self.fernet.encrypt(plaintext.encode()).decode()
    
    def decrypt(self, ciphertext: str) -> str:
        """
        Decrypt a string
        
        Args:
            ciphertext: Base64-encoded encrypted string
            
        Returns:
            Decrypted plaintext string
        """
        return self.fernet.decrypt(ciphertext.encode()).decode()
    
    def encrypt_credentials(self, credentials: Dict[str, str]) -> str:
        """
        Encrypt credential dictionary
        
        Args:
            credentials: Dict with username, password, etc.
            
        Returns:
            Encrypted JSON string
        """
        json_str = json.dumps(credentials)
        return self.encrypt(json_str)
    
    def decrypt_credentials(self, encrypted: str) -> Dict[str, str]:
        """
        Decrypt credential dictionary
        
        Args:
            encrypted: Encrypted JSON string
            
        Returns:
            Decrypted credential dict
        """
        json_str = self.decrypt(encrypted)
        return json.loads(json_str)


class CredentialService:
    """
    Manages stored credentials for website logins
    """
    
    def __init__(self, db, encryption: Optional[CredentialEncryption] = None):
        """
        Initialize credential service
        
        Args:
            db: MongoDB database instance
            encryption: Optional CredentialEncryption instance
        """
        self.db = db
        self.encryption = encryption or CredentialEncryption()
    
    async def store_credential(
        self,
        tenant_id: str,
        name: str,
        site_domain: str,
        login_url: str,
        username: str,
        password: str,
        username_selector: str = "#username, input[name='username'], input[name='email'], input[type='email']",
        password_selector: str = "#password, input[name='password'], input[type='password']",
        submit_selector: str = "button[type='submit'], input[type='submit']",
        additional_fields: Optional[Dict[str, str]] = None,
        success_indicator: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Store encrypted credentials for a website
        
        Args:
            tenant_id: Tenant ID for isolation
            name: Friendly name for this credential
            site_domain: Domain of the website
            login_url: Full URL to the login page
            username: Username/email
            password: Password
            username_selector: CSS selector for username field
            password_selector: CSS selector for password field
            submit_selector: CSS selector for submit button
            additional_fields: Optional additional form fields
            success_indicator: CSS selector that indicates successful login
            notes: Optional notes
            
        Returns:
            Created credential record (without sensitive data)
        """
        credential_id = str(uuid4())
        now = datetime.now(timezone.utc)
        
        # Encrypt sensitive credentials
        credentials_to_encrypt = {
            "username": username,
            "password": password
        }
        if additional_fields:
            credentials_to_encrypt["additional_fields"] = additional_fields
        
        encrypted_credentials = self.encryption.encrypt_credentials(credentials_to_encrypt)
        
        # Create credential record
        credential = {
            "id": credential_id,
            "tenant_id": tenant_id,
            "name": name,
            "site_domain": site_domain,
            "login_url": login_url,
            "credentials_encrypted": encrypted_credentials,
            "field_selectors": {
                "username": username_selector,
                "password": password_selector,
                "submit": submit_selector
            },
            "success_indicator": success_indicator,
            "notes": notes,
            "last_used": None,
            "last_success": None,
            "use_count": 0,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await self.db.agent_credentials.insert_one(credential)
        
        # Return without sensitive data
        return self._sanitize_credential(credential)
    
    async def get_credential(
        self,
        credential_id: str,
        tenant_id: str,
        include_decrypted: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Get a credential by ID
        
        Args:
            credential_id: Credential ID
            tenant_id: Tenant ID for isolation
            include_decrypted: Whether to include decrypted credentials
            
        Returns:
            Credential record or None
        """
        credential = await self.db.agent_credentials.find_one({
            "id": credential_id,
            "tenant_id": tenant_id
        }, {"_id": 0})
        
        if not credential:
            return None
        
        if include_decrypted:
            try:
                decrypted = self.encryption.decrypt_credentials(
                    credential["credentials_encrypted"]
                )
                credential["decrypted"] = decrypted
            except Exception as e:
                logger.error(f"Failed to decrypt credential: {str(e)}")
                credential["decrypted"] = None
        
        return self._sanitize_credential(credential, include_decrypted)
    
    async def get_credential_by_name(
        self,
        name: str,
        tenant_id: str,
        include_decrypted: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Get a credential by name
        
        Args:
            name: Credential name
            tenant_id: Tenant ID for isolation
            include_decrypted: Whether to include decrypted credentials
            
        Returns:
            Credential record or None
        """
        credential = await self.db.agent_credentials.find_one({
            "name": name,
            "tenant_id": tenant_id
        }, {"_id": 0})
        
        if not credential:
            return None
        
        if include_decrypted:
            try:
                decrypted = self.encryption.decrypt_credentials(
                    credential["credentials_encrypted"]
                )
                credential["decrypted"] = decrypted
            except Exception as e:
                logger.error(f"Failed to decrypt credential: {str(e)}")
                credential["decrypted"] = None
        
        return self._sanitize_credential(credential, include_decrypted)
    
    async def list_credentials(
        self,
        tenant_id: str
    ) -> List[Dict[str, Any]]:
        """
        List all credentials for a tenant (without sensitive data)
        
        Args:
            tenant_id: Tenant ID
            
        Returns:
            List of credential records
        """
        cursor = self.db.agent_credentials.find(
            {"tenant_id": tenant_id},
            {"_id": 0}
        ).sort("name", 1)
        
        credentials = await cursor.to_list(length=100)
        return [self._sanitize_credential(c) for c in credentials]
    
    async def update_credential(
        self,
        credential_id: str,
        tenant_id: str,
        updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Update a credential
        
        Args:
            credential_id: Credential ID
            tenant_id: Tenant ID
            updates: Fields to update
            
        Returns:
            Updated credential or None
        """
        now = datetime.now(timezone.utc)
        
        # Handle password update
        if "password" in updates or "username" in updates:
            # Get existing credential to preserve other fields
            existing = await self.db.agent_credentials.find_one({
                "id": credential_id,
                "tenant_id": tenant_id
            })
            
            if existing:
                try:
                    decrypted = self.encryption.decrypt_credentials(
                        existing["credentials_encrypted"]
                    )
                    if "username" in updates:
                        decrypted["username"] = updates.pop("username")
                    if "password" in updates:
                        decrypted["password"] = updates.pop("password")
                    
                    updates["credentials_encrypted"] = self.encryption.encrypt_credentials(decrypted)
                except Exception as e:
                    logger.error(f"Failed to update credentials: {str(e)}")
                    return None
        
        # Handle field selectors update
        if any(k in updates for k in ["username_selector", "password_selector", "submit_selector"]):
            field_selectors = {}
            if "username_selector" in updates:
                field_selectors["username"] = updates.pop("username_selector")
            if "password_selector" in updates:
                field_selectors["password"] = updates.pop("password_selector")
            if "submit_selector" in updates:
                field_selectors["submit"] = updates.pop("submit_selector")
            
            if field_selectors:
                updates["field_selectors"] = field_selectors
        
        updates["updated_at"] = now.isoformat()
        
        result = await self.db.agent_credentials.find_one_and_update(
            {"id": credential_id, "tenant_id": tenant_id},
            {"$set": updates},
            return_document=True
        )
        
        if result:
            result.pop("_id", None)
            return self._sanitize_credential(result)
        return None
    
    async def delete_credential(
        self,
        credential_id: str,
        tenant_id: str
    ) -> bool:
        """
        Delete a credential
        
        Args:
            credential_id: Credential ID
            tenant_id: Tenant ID
            
        Returns:
            True if deleted, False otherwise
        """
        result = await self.db.agent_credentials.delete_one({
            "id": credential_id,
            "tenant_id": tenant_id
        })
        return result.deleted_count > 0
    
    async def record_usage(
        self,
        credential_id: str,
        tenant_id: str,
        success: bool
    ):
        """
        Record credential usage
        
        Args:
            credential_id: Credential ID
            tenant_id: Tenant ID
            success: Whether login was successful
        """
        now = datetime.now(timezone.utc)
        
        update = {
            "$set": {"last_used": now.isoformat()},
            "$inc": {"use_count": 1}
        }
        
        if success:
            update["$set"]["last_success"] = now.isoformat()
        
        await self.db.agent_credentials.update_one(
            {"id": credential_id, "tenant_id": tenant_id},
            update
        )
    
    def _sanitize_credential(
        self,
        credential: Dict[str, Any],
        include_decrypted: bool = False
    ) -> Dict[str, Any]:
        """Remove sensitive data from credential"""
        result = credential.copy()
        
        # Always remove encrypted blob from response
        result.pop("credentials_encrypted", None)
        
        # Include decrypted only if explicitly requested
        if not include_decrypted:
            result.pop("decrypted", None)
        
        return result


# =============================================================================
# AUTH TOOL IMPLEMENTATIONS
# =============================================================================

async def login_to_website(
    session,  # BrowserSession
    credential_service: CredentialService,
    tenant_id: str,
    credential_id: Optional[str] = None,
    credential_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Log into a website using stored credentials
    
    Args:
        session: Browser session
        credential_service: Credential service instance
        tenant_id: Tenant ID
        credential_id: ID of credential to use
        credential_name: Name of credential (alternative to ID)
        
    Returns:
        Login result
    """
    try:
        # Get credential
        if credential_id:
            credential = await credential_service.get_credential(
                credential_id, tenant_id, include_decrypted=True
            )
        elif credential_name:
            credential = await credential_service.get_credential_by_name(
                credential_name, tenant_id, include_decrypted=True
            )
        else:
            return {"success": False, "error": "Either credential_id or credential_name required"}
        
        if not credential:
            return {"success": False, "error": "Credential not found"}
        
        if not credential.get("decrypted"):
            return {"success": False, "error": "Failed to decrypt credentials"}
        
        decrypted = credential["decrypted"]
        selectors = credential.get("field_selectors", {})
        
        # Navigate to login page
        login_url = credential.get("login_url")
        if not login_url:
            return {"success": False, "error": "No login URL configured"}
        
        await session.page.goto(login_url, wait_until='domcontentloaded')
        
        # Fill username
        username_selector = selectors.get("username", "input[name='username'], input[name='email']")
        try:
            await session.page.fill(username_selector, decrypted["username"])
        except Exception as e:
            return {"success": False, "error": f"Failed to fill username: {str(e)}"}
        
        # Fill password
        password_selector = selectors.get("password", "input[type='password']")
        try:
            await session.page.fill(password_selector, decrypted["password"])
        except Exception as e:
            return {"success": False, "error": f"Failed to fill password: {str(e)}"}
        
        # Fill additional fields if any
        additional = decrypted.get("additional_fields", {})
        for selector, value in additional.items():
            try:
                await session.page.fill(selector, value)
            except Exception as e:
                logger.warning(f"Failed to fill additional field {selector}: {str(e)}")
        
        # Submit form
        submit_selector = selectors.get("submit", "button[type='submit']")
        try:
            async with session.page.expect_navigation(timeout=30000):
                await session.page.click(submit_selector)
        except Exception as e:
            # Navigation might not happen for some login forms
            logger.warning(f"Navigation after login: {str(e)}")
            await session.page.wait_for_timeout(2000)
        
        # Check for success indicator
        success_indicator = credential.get("success_indicator")
        login_success = True
        
        if success_indicator:
            try:
                element = await session.page.query_selector(success_indicator)
                login_success = element is not None
            except:
                login_success = False
        
        # Record usage
        await credential_service.record_usage(
            credential.get("id"),
            tenant_id,
            login_success
        )
        
        return {
            "success": login_success,
            "url": session.page.url,
            "title": await session.page.title(),
            "credential_name": credential.get("name"),
            "site_domain": credential.get("site_domain")
        }
        
    except Exception as e:
        logger.error(f"login_to_website error: {str(e)}")
        return {"success": False, "error": str(e)}


async def check_login_status(
    session,  # BrowserSession
    success_indicator: Optional[str] = None,
    logout_indicator: Optional[str] = None
) -> Dict[str, Any]:
    """
    Check if currently logged into a website
    
    Args:
        session: Browser session
        success_indicator: Selector that indicates logged in
        logout_indicator: Selector that indicates logged out
        
    Returns:
        Login status
    """
    try:
        is_logged_in = None
        
        if success_indicator:
            element = await session.page.query_selector(success_indicator)
            if element:
                is_logged_in = True
        
        if logout_indicator and is_logged_in is None:
            element = await session.page.query_selector(logout_indicator)
            if element:
                is_logged_in = False
        
        return {
            "success": True,
            "is_logged_in": is_logged_in,
            "url": session.page.url,
            "title": await session.page.title(),
            "note": "Could not determine login status" if is_logged_in is None else None
        }
        
    except Exception as e:
        logger.error(f"check_login_status error: {str(e)}")
        return {"success": False, "error": str(e)}
