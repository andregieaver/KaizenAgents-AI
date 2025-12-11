from pydantic import BaseModel, ConfigDict
from typing import Optional, List

class DocumentInfo(BaseModel):
    filename: str
    filepath: str
    upload_date: str
    file_size: int

class CompanyAgentConfigUpdate(BaseModel):
    agent_id: Optional[str] = None
    custom_instructions: Optional[str] = None
    scraping_domains: Optional[List[str]] = None
    scraping_max_depth: Optional[int] = None
    scraping_max_pages: Optional[int] = None
    response_language: Optional[str] = None
    language_mode: Optional[str] = None  # 'force', 'browser', 'geo'

class CompanyAgentConfigResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    company_id: str
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    custom_instructions: Optional[str] = None
    uploaded_docs: List[DocumentInfo] = []
    scraping_domains: List[str] = []
    scraping_max_depth: int = 2
    scraping_max_pages: int = 50
    scraping_status: Optional[str] = None
    last_scraped_at: Optional[str] = None
    response_language: Optional[str] = None
    language_mode: str = "browser"  # 'force', 'browser', 'geo'
    is_active: bool
    updated_at: str

class ScrapingTriggerRequest(BaseModel):
    force_refresh: bool = False

class ScrapingStatusResponse(BaseModel):
    status: str
    pages_scraped: int = 0
    last_scraped_at: Optional[str] = None
    error_message: Optional[str] = None
    domains: List[str] = []
