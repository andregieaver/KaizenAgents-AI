"""
Browser Tools Implementation
Playwright-based browser automation tools for AI agents
"""
import asyncio
import logging
import base64
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from uuid import uuid4
from urllib.parse import urlparse
import aiohttp

logger = logging.getLogger(__name__)

# Global browser context (will be initialized on first use)
_playwright = None
_browser = None
_browser_lock = asyncio.Lock()


async def get_browser():
    """Get or create browser instance (lazy initialization)"""
    global _playwright, _browser
    
    async with _browser_lock:
        if _browser is None:
            from playwright.async_api import async_playwright
            _playwright = await async_playwright().start()
            _browser = await _playwright.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-software-rasterizer'
                ]
            )
            logger.info("Browser instance created")
        return _browser


async def close_browser():
    """Close browser instance (for cleanup)"""
    global _playwright, _browser
    
    async with _browser_lock:
        if _browser:
            await _browser.close()
            _browser = None
        if _playwright:
            await _playwright.stop()
            _playwright = None
        logger.info("Browser instance closed")


class BrowserSession:
    """Manages a browser session for tool execution"""
    
    def __init__(self, session_id: str = None):
        self.session_id = session_id or str(uuid4())
        self.context = None
        self.page = None
        self.screenshots: List[Dict[str, Any]] = []
        
    async def __aenter__(self):
        browser = await get_browser()
        self.context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        self.page = await self.context.new_page()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.page:
            await self.page.close()
        if self.context:
            await self.context.close()


# =============================================================================
# BROWSER TOOL IMPLEMENTATIONS
# =============================================================================

async def browse_website(
    session: BrowserSession,
    url: str,
    extract_selectors: Optional[Dict[str, str]] = None,
    take_screenshot: bool = False,
    wait_for_selector: Optional[str] = None,
    timeout: int = 30000
) -> Dict[str, Any]:
    """
    Navigate to a website and optionally extract content
    
    Args:
        session: Browser session
        url: URL to navigate to
        extract_selectors: Dict of {field_name: css_selector} to extract
        take_screenshot: Whether to capture screenshot
        wait_for_selector: Selector to wait for before extraction
        timeout: Navigation timeout in ms
    
    Returns:
        Dict with page info and extracted content
    """
    try:
        # Navigate to URL
        response = await session.page.goto(url, timeout=timeout, wait_until='domcontentloaded')
        
        # Wait for specific selector if provided
        if wait_for_selector:
            await session.page.wait_for_selector(wait_for_selector, timeout=timeout)
        
        # Get basic page info
        result = {
            "success": True,
            "url": session.page.url,
            "title": await session.page.title(),
            "status_code": response.status if response else None,
        }
        
        # Extract content from selectors
        if extract_selectors:
            extracted = {}
            for field_name, selector in extract_selectors.items():
                try:
                    elements = await session.page.query_selector_all(selector)
                    if len(elements) == 1:
                        extracted[field_name] = await elements[0].text_content()
                    elif len(elements) > 1:
                        extracted[field_name] = [await el.text_content() for el in elements]
                    else:
                        extracted[field_name] = None
                except Exception as e:
                    extracted[field_name] = f"Error: {str(e)}"
            result["extracted"] = extracted
        
        # Take screenshot if requested
        if take_screenshot:
            screenshot_data = await session.page.screenshot(type='jpeg', quality=80)
            screenshot_b64 = base64.b64encode(screenshot_data).decode('utf-8')
            result["screenshot"] = {
                "format": "jpeg",
                "data": screenshot_b64,
                "size": len(screenshot_data)
            }
        
        return result
        
    except Exception as e:
        logger.error(f"browse_website error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "url": url
        }


async def click_element(
    session: BrowserSession,
    selector: Optional[str] = None,
    text: Optional[str] = None,
    wait_after_click: int = 1000
) -> Dict[str, Any]:
    """
    Click on an element
    
    Args:
        session: Browser session
        selector: CSS selector of element
        text: Text content to find and click
        wait_after_click: Ms to wait after clicking
    
    Returns:
        Dict with click result
    """
    try:
        if selector:
            await session.page.click(selector)
        elif text:
            await session.page.click(f"text={text}")
        else:
            return {"success": False, "error": "Either selector or text must be provided"}
        
        if wait_after_click > 0:
            await asyncio.sleep(wait_after_click / 1000)
        
        return {
            "success": True,
            "clicked": selector or f"text={text}",
            "current_url": session.page.url
        }
        
    except Exception as e:
        logger.error(f"click_element error: {str(e)}")
        return {"success": False, "error": str(e)}


async def extract_text(
    session: BrowserSession,
    selectors: Dict[str, str],
    include_html: bool = False
) -> Dict[str, Any]:
    """
    Extract text from elements
    
    Args:
        session: Browser session
        selectors: Dict of {field_name: css_selector}
        include_html: Include raw HTML
    
    Returns:
        Dict with extracted content
    """
    try:
        extracted = {}
        
        for field_name, selector in selectors.items():
            try:
                elements = await session.page.query_selector_all(selector)
                
                if len(elements) == 0:
                    extracted[field_name] = None
                elif len(elements) == 1:
                    text = await elements[0].text_content()
                    extracted[field_name] = {"text": text.strip() if text else None}
                    if include_html:
                        extracted[field_name]["html"] = await elements[0].inner_html()
                else:
                    items = []
                    for el in elements:
                        text = await el.text_content()
                        item = {"text": text.strip() if text else None}
                        if include_html:
                            item["html"] = await el.inner_html()
                        items.append(item)
                    extracted[field_name] = items
                    
            except Exception as e:
                extracted[field_name] = {"error": str(e)}
        
        return {
            "success": True,
            "extracted": extracted,
            "url": session.page.url
        }
        
    except Exception as e:
        logger.error(f"extract_text error: {str(e)}")
        return {"success": False, "error": str(e)}


async def take_screenshot(
    session: BrowserSession,
    full_page: bool = False,
    selector: Optional[str] = None,
    quality: int = 80
) -> Dict[str, Any]:
    """
    Take a screenshot
    
    Args:
        session: Browser session
        full_page: Capture full page
        selector: Element to capture (optional)
        quality: JPEG quality
    
    Returns:
        Dict with screenshot data
    """
    try:
        if selector:
            element = await session.page.query_selector(selector)
            if not element:
                return {"success": False, "error": f"Element not found: {selector}"}
            screenshot_data = await element.screenshot(type='jpeg', quality=quality)
        else:
            screenshot_data = await session.page.screenshot(
                type='jpeg',
                quality=quality,
                full_page=full_page
            )
        
        screenshot_b64 = base64.b64encode(screenshot_data).decode('utf-8')
        
        return {
            "success": True,
            "screenshot": {
                "format": "jpeg",
                "data": screenshot_b64,
                "size": len(screenshot_data),
                "full_page": full_page
            },
            "url": session.page.url
        }
        
    except Exception as e:
        logger.error(f"take_screenshot error: {str(e)}")
        return {"success": False, "error": str(e)}


async def scroll_page(
    session: BrowserSession,
    direction: Optional[str] = None,
    pixels: Optional[int] = None,
    to_selector: Optional[str] = None
) -> Dict[str, Any]:
    """
    Scroll the page
    
    Args:
        session: Browser session
        direction: up, down, top, bottom
        pixels: Number of pixels to scroll
        to_selector: Scroll element into view
    
    Returns:
        Dict with scroll result
    """
    try:
        if to_selector:
            element = await session.page.query_selector(to_selector)
            if element:
                await element.scroll_into_view_if_needed()
                return {"success": True, "scrolled_to": to_selector}
            else:
                return {"success": False, "error": f"Element not found: {to_selector}"}
        
        if direction == "top":
            await session.page.evaluate("window.scrollTo(0, 0)")
        elif direction == "bottom":
            await session.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        elif direction == "down":
            scroll_amount = pixels or 500
            await session.page.evaluate(f"window.scrollBy(0, {scroll_amount})")
        elif direction == "up":
            scroll_amount = pixels or 500
            await session.page.evaluate(f"window.scrollBy(0, -{scroll_amount})")
        else:
            return {"success": False, "error": "Invalid direction. Use: up, down, top, bottom"}
        
        return {
            "success": True,
            "direction": direction,
            "pixels": pixels
        }
        
    except Exception as e:
        logger.error(f"scroll_page error: {str(e)}")
        return {"success": False, "error": str(e)}


async def get_page_info(
    session: BrowserSession,
    include_meta: bool = True,
    include_links: bool = False
) -> Dict[str, Any]:
    """
    Get information about the current page
    
    Args:
        session: Browser session
        include_meta: Include meta tags
        include_links: Include all links
    
    Returns:
        Dict with page information
    """
    try:
        result = {
            "success": True,
            "url": session.page.url,
            "title": await session.page.title()
        }
        
        if include_meta:
            meta_tags = await session.page.evaluate("""
                () => {
                    const metas = document.querySelectorAll('meta');
                    const result = {};
                    metas.forEach(meta => {
                        const name = meta.getAttribute('name') || meta.getAttribute('property');
                        const content = meta.getAttribute('content');
                        if (name && content) {
                            result[name] = content;
                        }
                    });
                    return result;
                }
            """)
            result["meta_tags"] = meta_tags
        
        if include_links:
            links = await session.page.evaluate("""
                () => {
                    const anchors = document.querySelectorAll('a[href]');
                    return Array.from(anchors).slice(0, 100).map(a => ({
                        text: a.textContent?.trim().slice(0, 100),
                        href: a.href
                    }));
                }
            """)
            result["links"] = links
            result["link_count"] = len(links)
        
        return result
        
    except Exception as e:
        logger.error(f"get_page_info error: {str(e)}")
        return {"success": False, "error": str(e)}


# =============================================================================
# FORM TOOL IMPLEMENTATIONS
# =============================================================================

async def fill_form(
    session: BrowserSession,
    fields: Dict[str, str],
    clear_first: bool = True
) -> Dict[str, Any]:
    """
    Fill form fields
    
    Args:
        session: Browser session
        fields: Dict of {selector: value}
        clear_first: Clear existing values
    
    Returns:
        Dict with fill result
    """
    try:
        filled = []
        errors = []
        
        for selector, value in fields.items():
            try:
                if clear_first:
                    await session.page.fill(selector, '')
                await session.page.fill(selector, value)
                filled.append(selector)
            except Exception as e:
                errors.append({"selector": selector, "error": str(e)})
        
        return {
            "success": len(errors) == 0,
            "filled": filled,
            "errors": errors if errors else None
        }
        
    except Exception as e:
        logger.error(f"fill_form error: {str(e)}")
        return {"success": False, "error": str(e)}


async def submit_form(
    session: BrowserSession,
    submit_selector: str = "button[type='submit'], input[type='submit']",
    wait_for_navigation: bool = True
) -> Dict[str, Any]:
    """
    Submit a form
    
    Args:
        session: Browser session
        submit_selector: Selector for submit button
        wait_for_navigation: Wait for page load
    
    Returns:
        Dict with submit result
    """
    try:
        if wait_for_navigation:
            async with session.page.expect_navigation(timeout=30000):
                await session.page.click(submit_selector)
        else:
            await session.page.click(submit_selector)
        
        return {
            "success": True,
            "new_url": session.page.url,
            "new_title": await session.page.title()
        }
        
    except Exception as e:
        logger.error(f"submit_form error: {str(e)}")
        return {"success": False, "error": str(e)}


async def select_option(
    session: BrowserSession,
    selector: str,
    value: Optional[str] = None,
    label: Optional[str] = None
) -> Dict[str, Any]:
    """
    Select dropdown option
    
    Args:
        session: Browser session
        selector: Select element selector
        value: Option value
        label: Option label
    
    Returns:
        Dict with select result
    """
    try:
        if value:
            await session.page.select_option(selector, value=value)
        elif label:
            await session.page.select_option(selector, label=label)
        else:
            return {"success": False, "error": "Either value or label must be provided"}
        
        return {
            "success": True,
            "selected": value or label
        }
        
    except Exception as e:
        logger.error(f"select_option error: {str(e)}")
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL EXECUTOR MAPPING
# =============================================================================

BROWSER_TOOL_EXECUTORS = {
    "browse_website": browse_website,
    "click_element": click_element,
    "extract_text": extract_text,
    "take_screenshot": take_screenshot,
    "scroll_page": scroll_page,
    "get_page_info": get_page_info,
    "fill_form": fill_form,
    "submit_form": submit_form,
    "select_option": select_option,
}


async def execute_browser_tool(
    tool_name: str,
    params: Dict[str, Any],
    session: Optional[BrowserSession] = None
) -> Dict[str, Any]:
    """
    Execute a browser tool
    
    Args:
        tool_name: Name of the tool
        params: Tool parameters
        session: Existing session (optional)
    
    Returns:
        Tool execution result
    """
    executor = BROWSER_TOOL_EXECUTORS.get(tool_name)
    if not executor:
        return {"success": False, "error": f"Unknown tool: {tool_name}"}
    
    # Create session if not provided
    owns_session = session is None
    
    try:
        if owns_session:
            session = BrowserSession()
            await session.__aenter__()
        
        result = await executor(session, **params)
        return result
        
    finally:
        if owns_session and session:
            await session.__aexit__(None, None, None)
