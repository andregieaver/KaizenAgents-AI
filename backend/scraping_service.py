"""
Web Scraping Service for RAG Knowledge Base
Handles domain crawling, content extraction, and caching
"""

import re
import time
import hashlib
from typing import List, Dict, Set, Optional
from urllib.parse import urljoin, urlparse, urldefrag
from datetime import datetime, timezone
import requests
from bs4 import BeautifulSoup
from urllib.robotparser import RobotFileParser
import logging

logger = logging.getLogger(__name__)

# Scraping configuration
DEFAULT_MAX_DEPTH = 2
DEFAULT_MAX_PAGES = 50
RATE_LIMIT_DELAY = 1.0  # seconds between requests
REQUEST_TIMEOUT = 10  # seconds
USER_AGENT = "KaizenAgentsAI-Bot/1.0 (Knowledge Base Crawler)"


class DomainScraper:
    """Handles scraping of a single domain"""
    
    def __init__(self, base_url: str, max_depth: int = DEFAULT_MAX_DEPTH, max_pages: int = DEFAULT_MAX_PAGES):
        self.base_url = base_url.rstrip('/')
        self.domain = urlparse(base_url).netloc
        self.max_depth = max_depth
        self.max_pages = max_pages
        self.visited_urls: Set[str] = set()
        self.scraped_pages: List[Dict] = []
        self.robots_parser = self._load_robots_txt()
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        })
    
    def _load_robots_txt(self) -> Optional[RobotFileParser]:
        """Load and parse robots.txt for the domain"""
        try:
            robots_url = f"{self.base_url}/robots.txt"
            rp = RobotFileParser()
            rp.set_url(robots_url)
            rp.read()
            return rp
        except Exception as e:
            logger.warning(f"Could not load robots.txt for {self.base_url}: {e}")
            return None
    
    def _can_fetch(self, url: str) -> bool:
        """Check if URL can be fetched according to robots.txt"""
        if self.robots_parser is None:
            return True
        try:
            return self.robots_parser.can_fetch(USER_AGENT, url)
        except:
            return True
    
    def _normalize_url(self, url: str) -> str:
        """Normalize URL by removing fragments and trailing slashes"""
        url, _ = urldefrag(url)
        return url.rstrip('/')
    
    def _is_valid_url(self, url: str) -> bool:
        """Check if URL should be crawled"""
        parsed = urlparse(url)
        
        # Must be same domain
        if parsed.netloc != self.domain:
            return False
        
        # Must be http or https
        if parsed.scheme not in ['http', 'https']:
            return False
        
        # Skip common non-content files
        skip_extensions = [
            '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico',
            '.css', '.js', '.pdf', '.zip', '.xml', '.json',
            '.mp4', '.mp3', '.wav', '.avi', '.mov'
        ]
        if any(parsed.path.lower().endswith(ext) for ext in skip_extensions):
            return False
        
        return True
    
    def _extract_links(self, soup: BeautifulSoup, current_url: str) -> List[str]:
        """Extract all valid links from a page"""
        links = []
        for tag in soup.find_all('a', href=True):
            href = tag['href']
            absolute_url = urljoin(current_url, href)
            normalized_url = self._normalize_url(absolute_url)
            
            if self._is_valid_url(normalized_url) and normalized_url not in self.visited_urls:
                links.append(normalized_url)
        
        return links
    
    def _extract_main_content(self, soup: BeautifulSoup) -> str:
        """Extract main text content from HTML"""
        # Remove script, style, nav, footer, header elements
        for element in soup(['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe']):
            element.decompose()
        
        # Try to find main content area
        main_content = None
        for tag in ['main', 'article', 'div[role="main"]', '.content', '#content', '.main', '#main']:
            main_content = soup.select_one(tag)
            if main_content:
                break
        
        # If no main content found, use body
        if not main_content:
            main_content = soup.find('body')
        
        if not main_content:
            return ""
        
        # Extract text
        text = main_content.get_text(separator=' ', strip=True)
        
        # Clean up whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def _scrape_page(self, url: str) -> Optional[Dict]:
        """Scrape a single page"""
        try:
            # Check robots.txt
            if not self._can_fetch(url):
                logger.info(f"Skipping {url} (disallowed by robots.txt)")
                return None
            
            # Rate limiting
            time.sleep(RATE_LIMIT_DELAY)
            
            # Fetch page
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            
            # Only process HTML
            content_type = response.headers.get('Content-Type', '')
            if 'text/html' not in content_type:
                logger.info(f"Skipping {url} (not HTML)")
                return None
            
            # Parse HTML
            soup = BeautifulSoup(response.content, 'lxml')
            
            # Extract title
            title = soup.find('title')
            title_text = title.get_text(strip=True) if title else url
            
            # Extract main content
            content = self._extract_main_content(soup)
            
            if not content or len(content) < 100:
                logger.info(f"Skipping {url} (insufficient content)")
                return None
            
            # Extract links
            links = self._extract_links(soup, url)
            
            # Generate content hash for deduplication
            content_hash = hashlib.md5(content.encode()).hexdigest()
            
            return {
                'url': url,
                'title': title_text,
                'content': content,
                'content_hash': content_hash,
                'links': links,
                'scraped_at': datetime.now(timezone.utc),
                'status_code': response.status_code
            }
        
        except requests.Timeout:
            logger.warning(f"Timeout scraping {url}")
            return None
        except requests.RequestException as e:
            logger.warning(f"Error scraping {url}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error scraping {url}: {e}")
            return None
    
    def crawl(self) -> List[Dict]:
        """Crawl the domain starting from base_url"""
        # BFS crawling
        queue = [(self.base_url, 0)]  # (url, depth)
        
        while queue and len(self.scraped_pages) < self.max_pages:
            url, depth = queue.pop(0)
            
            # Skip if already visited or depth exceeded
            if url in self.visited_urls or depth > self.max_depth:
                continue
            
            self.visited_urls.add(url)
            
            logger.info(f"Scraping {url} (depth: {depth}, pages: {len(self.scraped_pages)}/{self.max_pages})")
            
            # Scrape page
            page_data = self._scrape_page(url)
            
            if page_data:
                self.scraped_pages.append(page_data)
                
                # Add links to queue for next depth level
                if depth < self.max_depth:
                    for link in page_data['links']:
                        if link not in self.visited_urls:
                            queue.append((link, depth + 1))
        
        logger.info(f"Crawling complete. Scraped {len(self.scraped_pages)} pages from {self.domain}")
        return self.scraped_pages


def scrape_domains(domains: List[str], max_depth: int = DEFAULT_MAX_DEPTH, max_pages_per_domain: int = DEFAULT_MAX_PAGES) -> Dict[str, List[Dict]]:
    """
    Scrape multiple domains
    Returns: {domain: [pages]}
    """
    results = {}
    
    for domain_url in domains:
        try:
            logger.info(f"Starting crawl of {domain_url}")
            scraper = DomainScraper(domain_url, max_depth=max_depth, max_pages=max_pages_per_domain)
            pages = scraper.crawl()
            results[domain_url] = pages
        except Exception as e:
            logger.error(f"Failed to scrape {domain_url}: {e}")
            results[domain_url] = []
    
    return results


def prepare_scraped_content_for_rag(scraped_data: Dict[str, List[Dict]], company_id: str) -> List[Dict]:
    """
    Convert scraped pages into documents ready for RAG processing
    Returns list of documents with metadata
    """
    documents = []
    
    for domain, pages in scraped_data.items():
        for page in pages:
            doc = {
                'company_id': company_id,
                'source_type': 'web',
                'source_url': page['url'],
                'title': page['title'],
                'content': page['content'],
                'content_hash': page['content_hash'],
                'domain': urlparse(page['url']).netloc,
                'scraped_at': page['scraped_at'],
                'status': 'pending_embedding'  # Will be updated after chunking/embedding
            }
            documents.append(doc)
    
    return documents
