"""
Audit Tools Service
Provides website auditing capabilities for AI agents:
- SEO Audit
- Accessibility Checker
- Performance Metrics
- Security Headers Checker
- Broken Links Checker
"""
import asyncio
import logging
import re
import time
from typing import Dict, List, Any, Optional, Set
from urllib.parse import urljoin, urlparse
from datetime import datetime, timezone

import aiohttp
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


# =============================================================================
# SEO AUDIT TOOL
# =============================================================================

async def seo_audit(
    url: str,
    check_meta: bool = True,
    check_headings: bool = True,
    check_images: bool = True,
    check_links: bool = True,
    check_schema: bool = True
) -> Dict[str, Any]:
    """
    Perform comprehensive SEO audit on a webpage
    
    Args:
        url: URL to audit
        check_meta: Check meta tags (title, description, keywords, etc.)
        check_headings: Check heading structure (H1-H6)
        check_images: Check image alt tags and optimization
        check_links: Check internal/external links
        check_schema: Check for structured data (JSON-LD, microdata)
    
    Returns:
        SEO audit report with score and recommendations
    """
    try:
        start_time = time.time()
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=30) as response:
                if response.status != 200:
                    return {
                        "success": False,
                        "error": f"Failed to fetch URL: HTTP {response.status}",
                        "url": url
                    }
                
                html = await response.text()
                final_url = str(response.url)
        
        soup = BeautifulSoup(html, 'html.parser')
        issues = []
        warnings = []
        passed = []
        score = 100
        
        result = {
            "url": final_url,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Meta Tags Audit
        if check_meta:
            meta_result = _audit_meta_tags(soup)
            result["meta"] = meta_result["data"]
            issues.extend(meta_result["issues"])
            warnings.extend(meta_result["warnings"])
            passed.extend(meta_result["passed"])
            score -= meta_result["penalty"]
        
        # Headings Audit
        if check_headings:
            headings_result = _audit_headings(soup)
            result["headings"] = headings_result["data"]
            issues.extend(headings_result["issues"])
            warnings.extend(headings_result["warnings"])
            passed.extend(headings_result["passed"])
            score -= headings_result["penalty"]
        
        # Images Audit
        if check_images:
            images_result = _audit_images(soup)
            result["images"] = images_result["data"]
            issues.extend(images_result["issues"])
            warnings.extend(images_result["warnings"])
            passed.extend(images_result["passed"])
            score -= images_result["penalty"]
        
        # Links Audit
        if check_links:
            links_result = _audit_links(soup, final_url)
            result["links"] = links_result["data"]
            issues.extend(links_result["issues"])
            warnings.extend(links_result["warnings"])
            passed.extend(links_result["passed"])
            score -= links_result["penalty"]
        
        # Schema/Structured Data Audit
        if check_schema:
            schema_result = _audit_schema(soup)
            result["schema"] = schema_result["data"]
            issues.extend(schema_result["issues"])
            warnings.extend(schema_result["warnings"])
            passed.extend(schema_result["passed"])
            score -= schema_result["penalty"]
        
        # Calculate final score
        score = max(0, score)
        
        result["score"] = score
        result["grade"] = _get_grade(score)
        result["issues"] = issues
        result["warnings"] = warnings
        result["passed"] = passed
        result["summary"] = {
            "total_issues": len(issues),
            "total_warnings": len(warnings),
            "total_passed": len(passed)
        }
        result["duration_ms"] = int((time.time() - start_time) * 1000)
        result["success"] = True
        
        return result
        
    except asyncio.TimeoutError:
        return {"success": False, "error": "Request timed out", "url": url}
    except Exception as e:
        logger.error(f"SEO audit error: {str(e)}")
        return {"success": False, "error": str(e), "url": url}


def _audit_meta_tags(soup: BeautifulSoup) -> Dict[str, Any]:
    """Audit meta tags"""
    issues = []
    warnings = []
    passed = []
    penalty = 0
    
    data = {}
    
    # Title tag
    title = soup.find('title')
    if title:
        title_text = title.get_text().strip()
        data["title"] = title_text
        data["title_length"] = len(title_text)
        
        if len(title_text) < 30:
            warnings.append("Title tag is too short (< 30 characters)")
            penalty += 3
        elif len(title_text) > 60:
            warnings.append("Title tag is too long (> 60 characters)")
            penalty += 2
        else:
            passed.append("Title tag length is optimal (30-60 characters)")
    else:
        issues.append("Missing title tag")
        penalty += 10
    
    # Meta description
    meta_desc = soup.find('meta', attrs={'name': 'description'})
    if meta_desc and meta_desc.get('content'):
        desc_text = meta_desc['content'].strip()
        data["description"] = desc_text
        data["description_length"] = len(desc_text)
        
        if len(desc_text) < 120:
            warnings.append("Meta description is too short (< 120 characters)")
            penalty += 3
        elif len(desc_text) > 160:
            warnings.append("Meta description is too long (> 160 characters)")
            penalty += 2
        else:
            passed.append("Meta description length is optimal (120-160 characters)")
    else:
        issues.append("Missing meta description")
        penalty += 8
    
    # Canonical URL
    canonical = soup.find('link', attrs={'rel': 'canonical'})
    if canonical and canonical.get('href'):
        data["canonical"] = canonical['href']
        passed.append("Canonical URL is set")
    else:
        warnings.append("Missing canonical URL")
        penalty += 3
    
    # Viewport meta tag
    viewport = soup.find('meta', attrs={'name': 'viewport'})
    if viewport:
        data["viewport"] = viewport.get('content', '')
        passed.append("Viewport meta tag is set")
    else:
        issues.append("Missing viewport meta tag (mobile-friendliness issue)")
        penalty += 5
    
    # Robots meta tag
    robots = soup.find('meta', attrs={'name': 'robots'})
    if robots:
        data["robots"] = robots.get('content', '')
        if 'noindex' in data["robots"].lower():
            warnings.append("Page is set to noindex")
    
    # Open Graph tags
    og_tags = soup.find_all('meta', attrs={'property': re.compile(r'^og:')})
    data["open_graph"] = len(og_tags) > 0
    if og_tags:
        passed.append(f"Open Graph tags found ({len(og_tags)} tags)")
    else:
        warnings.append("Missing Open Graph tags (affects social sharing)")
        penalty += 2
    
    # Twitter Card tags
    twitter_tags = soup.find_all('meta', attrs={'name': re.compile(r'^twitter:')})
    data["twitter_cards"] = len(twitter_tags) > 0
    if twitter_tags:
        passed.append(f"Twitter Card tags found ({len(twitter_tags)} tags)")
    else:
        warnings.append("Missing Twitter Card tags")
        penalty += 1
    
    return {"data": data, "issues": issues, "warnings": warnings, "passed": passed, "penalty": penalty}


def _audit_headings(soup: BeautifulSoup) -> Dict[str, Any]:
    """Audit heading structure"""
    issues = []
    warnings = []
    passed = []
    penalty = 0
    
    data = {"structure": []}
    
    # Count headings
    h1_tags = soup.find_all('h1')
    h2_tags = soup.find_all('h2')
    h3_tags = soup.find_all('h3')
    h4_tags = soup.find_all('h4')
    h5_tags = soup.find_all('h5')
    h6_tags = soup.find_all('h6')
    
    data["counts"] = {
        "h1": len(h1_tags),
        "h2": len(h2_tags),
        "h3": len(h3_tags),
        "h4": len(h4_tags),
        "h5": len(h5_tags),
        "h6": len(h6_tags)
    }
    
    # H1 check
    if len(h1_tags) == 0:
        issues.append("Missing H1 tag")
        penalty += 10
    elif len(h1_tags) > 1:
        warnings.append(f"Multiple H1 tags found ({len(h1_tags)})")
        penalty += 3
    else:
        h1_text = h1_tags[0].get_text().strip()
        data["h1_text"] = h1_text
        if len(h1_text) < 10:
            warnings.append("H1 tag is too short")
            penalty += 2
        else:
            passed.append("Single H1 tag with proper content")
    
    # Check for proper heading hierarchy
    all_headings = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
    prev_level = 0
    hierarchy_issues = 0
    
    for heading in all_headings:
        level = int(heading.name[1])
        data["structure"].append({
            "tag": heading.name,
            "text": heading.get_text().strip()[:100]
        })
        if level > prev_level + 1 and prev_level > 0:
            hierarchy_issues += 1
        prev_level = level
    
    if hierarchy_issues > 0:
        warnings.append(f"Heading hierarchy skipped {hierarchy_issues} level(s)")
        penalty += hierarchy_issues * 2
    else:
        passed.append("Heading hierarchy is properly structured")
    
    return {"data": data, "issues": issues, "warnings": warnings, "passed": passed, "penalty": penalty}


def _audit_images(soup: BeautifulSoup) -> Dict[str, Any]:
    """Audit images for SEO"""
    issues = []
    warnings = []
    passed = []
    penalty = 0
    
    images = soup.find_all('img')
    data = {
        "total": len(images),
        "with_alt": 0,
        "without_alt": 0,
        "empty_alt": 0,
        "missing_alt_images": []
    }
    
    for img in images:
        src = img.get('src', '')
        alt = img.get('alt')
        
        if alt is None:
            data["without_alt"] += 1
            if len(data["missing_alt_images"]) < 5:  # Limit to first 5
                data["missing_alt_images"].append(src[:100])
        elif alt.strip() == '':
            data["empty_alt"] += 1
        else:
            data["with_alt"] += 1
    
    if data["total"] == 0:
        warnings.append("No images found on the page")
    else:
        missing_ratio = (data["without_alt"] + data["empty_alt"]) / data["total"]
        
        if data["without_alt"] > 0:
            issues.append(f"{data['without_alt']} image(s) missing alt attribute")
            penalty += min(10, data["without_alt"] * 2)
        
        if data["empty_alt"] > 0:
            warnings.append(f"{data['empty_alt']} image(s) have empty alt attribute")
            penalty += min(5, data["empty_alt"])
        
        if missing_ratio == 0:
            passed.append(f"All {data['total']} images have alt attributes")
    
    return {"data": data, "issues": issues, "warnings": warnings, "passed": passed, "penalty": penalty}


def _audit_links(soup: BeautifulSoup, base_url: str) -> Dict[str, Any]:
    """Audit links for SEO"""
    issues = []
    warnings = []
    passed = []
    penalty = 0
    
    links = soup.find_all('a', href=True)
    parsed_base = urlparse(base_url)
    
    data = {
        "total": len(links),
        "internal": 0,
        "external": 0,
        "nofollow": 0,
        "empty_anchor": 0,
        "javascript_links": 0
    }
    
    for link in links:
        href = link.get('href', '')
        rel = link.get('rel', [])
        anchor_text = link.get_text().strip()
        
        # Check link type
        if href.startswith('javascript:') or href == '#':
            data["javascript_links"] += 1
        elif href.startswith('http'):
            parsed_href = urlparse(href)
            if parsed_href.netloc == parsed_base.netloc:
                data["internal"] += 1
            else:
                data["external"] += 1
        elif href.startswith('/'):
            data["internal"] += 1
        
        # Check nofollow
        if 'nofollow' in rel:
            data["nofollow"] += 1
        
        # Check anchor text
        if not anchor_text or anchor_text.lower() in ['click here', 'read more', 'here', 'link']:
            data["empty_anchor"] += 1
    
    if data["total"] == 0:
        warnings.append("No links found on the page")
    else:
        if data["internal"] > 0:
            passed.append(f"{data['internal']} internal links found")
        else:
            warnings.append("No internal links found")
            penalty += 3
        
        if data["external"] > 0:
            passed.append(f"{data['external']} external links found")
        
        if data["empty_anchor"] > 3:
            warnings.append(f"{data['empty_anchor']} links have poor anchor text")
            penalty += 2
        
        if data["javascript_links"] > data["total"] * 0.2:
            warnings.append("High percentage of JavaScript links")
            penalty += 2
    
    return {"data": data, "issues": issues, "warnings": warnings, "passed": passed, "penalty": penalty}


def _audit_schema(soup: BeautifulSoup) -> Dict[str, Any]:
    """Audit structured data/schema markup"""
    issues = []
    warnings = []
    passed = []
    penalty = 0
    
    data = {
        "json_ld": [],
        "microdata": False,
        "rdfa": False
    }
    
    # Check for JSON-LD
    json_ld_scripts = soup.find_all('script', type='application/ld+json')
    for script in json_ld_scripts:
        try:
            import json
            schema_data = json.loads(script.string)
            schema_type = schema_data.get('@type', 'Unknown')
            data["json_ld"].append(schema_type)
        except Exception:
            data["json_ld"].append("Invalid JSON-LD")
    
    # Check for Microdata
    microdata = soup.find_all(attrs={'itemscope': True})
    data["microdata"] = len(microdata) > 0
    
    # Check for RDFa
    rdfa = soup.find_all(attrs={'typeof': True})
    data["rdfa"] = len(rdfa) > 0
    
    # Scoring
    if data["json_ld"] or data["microdata"] or data["rdfa"]:
        passed.append(f"Structured data found: {len(data['json_ld'])} JSON-LD schemas")
    else:
        warnings.append("No structured data (JSON-LD, Microdata, or RDFa) found")
        penalty += 5
    
    return {"data": data, "issues": issues, "warnings": warnings, "passed": passed, "penalty": penalty}


def _get_grade(score: int) -> str:
    """Convert score to letter grade"""
    if score >= 90:
        return "A"
    elif score >= 80:
        return "B"
    elif score >= 70:
        return "C"
    elif score >= 60:
        return "D"
    else:
        return "F"


# =============================================================================
# ACCESSIBILITY CHECKER
# =============================================================================

async def accessibility_check(
    url: str,
    check_images: bool = True,
    check_forms: bool = True,
    check_links: bool = True,
    check_contrast: bool = False,  # Basic check only
    check_aria: bool = True
) -> Dict[str, Any]:
    """
    Perform basic accessibility audit on a webpage
    Note: This is a basic check. For comprehensive testing, consider axe-core.
    
    Args:
        url: URL to audit
        check_images: Check image accessibility
        check_forms: Check form accessibility
        check_links: Check link accessibility
        check_contrast: Basic contrast check (limited)
        check_aria: Check ARIA usage
    
    Returns:
        Accessibility audit report
    """
    try:
        start_time = time.time()
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=30) as response:
                if response.status != 200:
                    return {
                        "success": False,
                        "error": f"Failed to fetch URL: HTTP {response.status}",
                        "url": url
                    }
                
                html = await response.text()
                final_url = str(response.url)
        
        soup = BeautifulSoup(html, 'html.parser')
        issues = []
        warnings = []
        passed = []
        
        result = {
            "url": final_url,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "standard": "WCAG 2.1 (Basic Checks)"
        }
        
        # Language attribute
        html_tag = soup.find('html')
        if html_tag and html_tag.get('lang'):
            result["language"] = html_tag['lang']
            passed.append("Page has lang attribute")
        else:
            issues.append("Missing lang attribute on <html> element")
        
        # Image accessibility
        if check_images:
            images = soup.find_all('img')
            missing_alt = [img.get('src', '')[:50] for img in images if not img.get('alt')]
            
            result["images"] = {
                "total": len(images),
                "missing_alt": len(missing_alt)
            }
            
            if missing_alt:
                issues.append(f"{len(missing_alt)} images missing alt text")
            else:
                passed.append("All images have alt text")
        
        # Form accessibility
        if check_forms:
            forms = soup.find_all('form')
            inputs = soup.find_all(['input', 'textarea', 'select'])
            labels = soup.find_all('label')
            
            inputs_without_label = 0
            for inp in inputs:
                inp_id = inp.get('id')
                inp_type = inp.get('type', 'text')
                
                # Skip hidden and submit inputs
                if inp_type in ['hidden', 'submit', 'button', 'image']:
                    continue
                
                # Check for associated label
                has_label = False
                if inp_id:
                    has_label = any(label.get('for') == inp_id for label in labels)
                if not has_label:
                    has_label = inp.get('aria-label') or inp.get('aria-labelledby')
                
                if not has_label:
                    inputs_without_label += 1
            
            result["forms"] = {
                "total_forms": len(forms),
                "total_inputs": len(inputs),
                "inputs_without_labels": inputs_without_label
            }
            
            if inputs_without_label > 0:
                issues.append(f"{inputs_without_label} form inputs missing labels")
            elif len(inputs) > 0:
                passed.append("All form inputs have associated labels")
        
        # Link accessibility
        if check_links:
            links = soup.find_all('a', href=True)
            empty_links = []
            generic_links = []
            
            for link in links:
                text = link.get_text().strip()
                aria_label = link.get('aria-label', '')
                title = link.get('title', '')
                
                accessible_name = text or aria_label or title
                
                if not accessible_name:
                    empty_links.append(link.get('href', '')[:50])
                elif accessible_name.lower() in ['click here', 'here', 'read more', 'more', 'link']:
                    generic_links.append(accessible_name)
            
            result["links"] = {
                "total": len(links),
                "empty_text": len(empty_links),
                "generic_text": len(generic_links)
            }
            
            if empty_links:
                issues.append(f"{len(empty_links)} links have no accessible name")
            else:
                passed.append("All links have accessible names")
            
            if generic_links:
                warnings.append(f"{len(generic_links)} links have generic text like 'click here'")
        
        # ARIA usage check
        if check_aria:
            aria_elements = soup.find_all(attrs={"role": True})
            aria_labels = soup.find_all(attrs={"aria-label": True})
            aria_labelledby = soup.find_all(attrs={"aria-labelledby": True})
            
            result["aria"] = {
                "elements_with_role": len(aria_elements),
                "elements_with_aria_label": len(aria_labels),
                "elements_with_aria_labelledby": len(aria_labelledby)
            }
            
            if aria_elements or aria_labels:
                passed.append(f"ARIA attributes in use ({len(aria_elements)} roles, {len(aria_labels)} labels)")
            else:
                warnings.append("No ARIA attributes found (may be acceptable for simple pages)")
        
        # Skip links
        skip_link = soup.find('a', href='#main') or soup.find('a', href='#content') or soup.find('a', {'class': re.compile(r'skip', re.I)})
        if skip_link:
            passed.append("Skip navigation link found")
        else:
            warnings.append("No skip navigation link found")
        
        # Calculate score (basic)
        score = 100
        score -= len(issues) * 10
        score -= len(warnings) * 3
        score = max(0, score)
        
        result["score"] = score
        result["grade"] = _get_grade(score)
        result["issues"] = issues
        result["warnings"] = warnings
        result["passed"] = passed
        result["summary"] = {
            "total_issues": len(issues),
            "total_warnings": len(warnings),
            "total_passed": len(passed)
        }
        result["duration_ms"] = int((time.time() - start_time) * 1000)
        result["success"] = True
        
        return result
        
    except asyncio.TimeoutError:
        return {"success": False, "error": "Request timed out", "url": url}
    except Exception as e:
        logger.error(f"Accessibility check error: {str(e)}")
        return {"success": False, "error": str(e), "url": url}


# =============================================================================
# PERFORMANCE METRICS
# =============================================================================

async def performance_check(
    url: str,
    check_resources: bool = True,
    check_compression: bool = True
) -> Dict[str, Any]:
    """
    Basic performance analysis of a webpage
    
    Args:
        url: URL to analyze
        check_resources: Analyze resource counts and sizes
        check_compression: Check for compression headers
    
    Returns:
        Performance metrics report
    """
    try:
        start_time = time.time()
        
        async with aiohttp.ClientSession() as session:
            # Main page request
            request_start = time.time()
            async with session.get(url, timeout=30) as response:
                ttfb = time.time() - request_start
                
                if response.status != 200:
                    return {
                        "success": False,
                        "error": f"Failed to fetch URL: HTTP {response.status}",
                        "url": url
                    }
                
                html = await response.text()
                html_size = len(html.encode('utf-8'))
                total_time = time.time() - request_start
                final_url = str(response.url)
                headers = dict(response.headers)
        
        soup = BeautifulSoup(html, 'html.parser')
        issues = []
        warnings = []
        passed = []
        
        result = {
            "url": final_url,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "timing": {
                "ttfb_ms": int(ttfb * 1000),
                "total_ms": int(total_time * 1000)
            },
            "page": {
                "html_size_bytes": html_size,
                "html_size_kb": round(html_size / 1024, 2)
            }
        }
        
        # TTFB assessment
        if ttfb < 0.2:
            passed.append(f"Excellent TTFB: {int(ttfb * 1000)}ms")
        elif ttfb < 0.5:
            passed.append(f"Good TTFB: {int(ttfb * 1000)}ms")
        elif ttfb < 1.0:
            warnings.append(f"Slow TTFB: {int(ttfb * 1000)}ms (should be < 500ms)")
        else:
            issues.append(f"Very slow TTFB: {int(ttfb * 1000)}ms (should be < 500ms)")
        
        # HTML size assessment
        if html_size < 50000:
            passed.append(f"HTML size is optimal: {round(html_size / 1024, 1)}KB")
        elif html_size < 100000:
            warnings.append(f"HTML size is moderate: {round(html_size / 1024, 1)}KB")
        else:
            issues.append(f"HTML size is large: {round(html_size / 1024, 1)}KB (consider optimization)")
        
        # Resource counts
        if check_resources:
            scripts = soup.find_all('script', src=True)
            stylesheets = soup.find_all('link', rel='stylesheet')
            images = soup.find_all('img', src=True)
            fonts = soup.find_all('link', rel='preload', attrs={'as': 'font'})
            
            # Inline scripts and styles
            inline_scripts = soup.find_all('script', src=False)
            inline_styles = soup.find_all('style')
            
            result["resources"] = {
                "scripts": len(scripts),
                "inline_scripts": len([s for s in inline_scripts if s.string]),
                "stylesheets": len(stylesheets),
                "inline_styles": len(inline_styles),
                "images": len(images),
                "preload_fonts": len(fonts)
            }
            
            # Assessments
            if len(scripts) > 15:
                issues.append(f"Too many external scripts: {len(scripts)} (consider bundling)")
            elif len(scripts) > 8:
                warnings.append(f"High number of external scripts: {len(scripts)}")
            else:
                passed.append(f"Reasonable script count: {len(scripts)}")
            
            if len(stylesheets) > 8:
                warnings.append(f"High number of stylesheets: {len(stylesheets)}")
            else:
                passed.append(f"Reasonable stylesheet count: {len(stylesheets)}")
            
            if len(images) > 50:
                warnings.append(f"Many images on page: {len(images)} (ensure lazy loading)")
        
        # Compression check
        if check_compression:
            content_encoding = headers.get('Content-Encoding', '')
            result["compression"] = {
                "enabled": bool(content_encoding),
                "type": content_encoding or "none"
            }
            
            if content_encoding:
                passed.append(f"Compression enabled: {content_encoding}")
            else:
                issues.append("Compression not enabled (should use gzip or brotli)")
        
        # Check for render-blocking resources
        blocking_css = soup.find_all('link', rel='stylesheet', media=lambda x: x != 'print')
        blocking_js = soup.find_all('script', src=True, attrs={'defer': False, 'async': False})
        # Filter out scripts that don't have both attributes
        blocking_js = [s for s in soup.find_all('script', src=True) if not s.get('defer') and not s.get('async')]
        
        result["render_blocking"] = {
            "css": len(blocking_css),
            "js": len(blocking_js)
        }
        
        if len(blocking_js) > 5:
            warnings.append(f"{len(blocking_js)} render-blocking scripts (use defer/async)")
        
        # Calculate score
        score = 100
        score -= len(issues) * 15
        score -= len(warnings) * 5
        score = max(0, score)
        
        result["score"] = score
        result["grade"] = _get_grade(score)
        result["issues"] = issues
        result["warnings"] = warnings
        result["passed"] = passed
        result["summary"] = {
            "total_issues": len(issues),
            "total_warnings": len(warnings),
            "total_passed": len(passed)
        }
        result["duration_ms"] = int((time.time() - start_time) * 1000)
        result["success"] = True
        
        return result
        
    except asyncio.TimeoutError:
        return {"success": False, "error": "Request timed out", "url": url}
    except Exception as e:
        logger.error(f"Performance check error: {str(e)}")
        return {"success": False, "error": str(e), "url": url}


# =============================================================================
# SECURITY HEADERS CHECKER
# =============================================================================

async def security_headers_check(url: str) -> Dict[str, Any]:
    """
    Check security headers on a webpage
    
    Args:
        url: URL to check
    
    Returns:
        Security headers report
    """
    try:
        start_time = time.time()
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=30) as response:
                headers = dict(response.headers)
                status = response.status
                final_url = str(response.url)
        
        issues = []
        warnings = []
        passed = []
        
        # Define important security headers and their assessment
        security_headers = {
            'Strict-Transport-Security': {
                'critical': True,
                'description': 'HSTS - Forces HTTPS'
            },
            'Content-Security-Policy': {
                'critical': True,
                'description': 'CSP - Prevents XSS attacks'
            },
            'X-Content-Type-Options': {
                'critical': False,
                'description': 'Prevents MIME sniffing',
                'expected': 'nosniff'
            },
            'X-Frame-Options': {
                'critical': False,
                'description': 'Prevents clickjacking',
                'expected': ['DENY', 'SAMEORIGIN']
            },
            'X-XSS-Protection': {
                'critical': False,
                'description': 'XSS filter (legacy)',
                'note': 'Deprecated but still useful'
            },
            'Referrer-Policy': {
                'critical': False,
                'description': 'Controls referrer information'
            },
            'Permissions-Policy': {
                'critical': False,
                'description': 'Controls browser features'
            },
            'Cross-Origin-Opener-Policy': {
                'critical': False,
                'description': 'COOP - Isolates browsing context'
            },
            'Cross-Origin-Resource-Policy': {
                'critical': False,
                'description': 'CORP - Controls resource sharing'
            }
        }
        
        result = {
            "url": final_url,
            "status_code": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "headers": {}
        }
        
        # Check each security header
        for header_name, config in security_headers.items():
            header_value = headers.get(header_name)
            
            result["headers"][header_name] = {
                "present": header_value is not None,
                "value": header_value,
                "description": config['description']
            }
            
            if header_value:
                # Check expected value if defined
                expected = config.get('expected')
                if expected:
                    if isinstance(expected, list):
                        if header_value in expected:
                            passed.append(f"{header_name} is properly configured")
                        else:
                            warnings.append(f"{header_name} value '{header_value}' may not be optimal")
                    elif header_value == expected:
                        passed.append(f"{header_name} is properly configured")
                    else:
                        warnings.append(f"{header_name} value '{header_value}' may not be optimal")
                else:
                    passed.append(f"{header_name} is present")
            else:
                if config.get('critical'):
                    issues.append(f"Missing critical header: {header_name}")
                else:
                    warnings.append(f"Missing recommended header: {header_name}")
        
        # Check for information disclosure headers
        disclosure_headers = ['Server', 'X-Powered-By', 'X-AspNet-Version']
        disclosed = []
        for h in disclosure_headers:
            if headers.get(h):
                disclosed.append(f"{h}: {headers.get(h)}")
        
        if disclosed:
            warnings.append(f"Information disclosure headers found: {', '.join(disclosed)}")
            result["information_disclosure"] = disclosed
        else:
            passed.append("No information disclosure headers")
        
        # Check HTTPS
        if final_url.startswith('https://'):
            passed.append("Site uses HTTPS")
        else:
            issues.append("Site does not use HTTPS")
        
        # Calculate score
        score = 100
        score -= len(issues) * 15
        score -= len(warnings) * 5
        score = max(0, score)
        
        result["score"] = score
        result["grade"] = _get_grade(score)
        result["issues"] = issues
        result["warnings"] = warnings
        result["passed"] = passed
        result["summary"] = {
            "total_issues": len(issues),
            "total_warnings": len(warnings),
            "total_passed": len(passed)
        }
        result["duration_ms"] = int((time.time() - start_time) * 1000)
        result["success"] = True
        
        return result
        
    except asyncio.TimeoutError:
        return {"success": False, "error": "Request timed out", "url": url}
    except Exception as e:
        logger.error(f"Security headers check error: {str(e)}")
        return {"success": False, "error": str(e), "url": url}


# =============================================================================
# BROKEN LINKS CHECKER
# =============================================================================

async def broken_links_check(
    url: str,
    max_links: int = 50,
    timeout_per_link: int = 10,
    check_external: bool = True,
    check_internal: bool = True
) -> Dict[str, Any]:
    """
    Check for broken links on a webpage
    
    Args:
        url: URL to check
        max_links: Maximum number of links to check
        timeout_per_link: Timeout for each link check in seconds
        check_external: Check external links
        check_internal: Check internal links
    
    Returns:
        Broken links report
    """
    try:
        start_time = time.time()
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=30) as response:
                if response.status != 200:
                    return {
                        "success": False,
                        "error": f"Failed to fetch URL: HTTP {response.status}",
                        "url": url
                    }
                
                html = await response.text()
                final_url = str(response.url)
        
        soup = BeautifulSoup(html, 'html.parser')
        parsed_base = urlparse(final_url)
        
        # Collect all links
        links = soup.find_all('a', href=True)
        unique_links: Set[str] = set()
        
        for link in links:
            href = link.get('href', '')
            
            # Skip javascript, mailto, tel, and anchor links
            if href.startswith(('javascript:', 'mailto:', 'tel:', '#')):
                continue
            
            # Resolve relative URLs
            full_url = urljoin(final_url, href)
            parsed_url = urlparse(full_url)
            
            # Only check http/https
            if parsed_url.scheme not in ['http', 'https']:
                continue
            
            # Filter by internal/external
            is_internal = parsed_url.netloc == parsed_base.netloc
            if is_internal and not check_internal:
                continue
            if not is_internal and not check_external:
                continue
            
            unique_links.add(full_url)
        
        # Limit number of links to check
        links_to_check = list(unique_links)[:max_links]
        
        result = {
            "url": final_url,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "total_links_found": len(unique_links),
            "links_checked": len(links_to_check)
        }
        
        # Check each link
        broken_links = []
        working_links = []
        redirect_links = []
        timeout_links = []
        
        async with aiohttp.ClientSession() as session:
            for link_url in links_to_check:
                try:
                    async with session.head(
                        link_url, 
                        timeout=timeout_per_link,
                        allow_redirects=True
                    ) as resp:
                        status = resp.status
                        final_link_url = str(resp.url)
                        
                        if status >= 400:
                            broken_links.append({
                                "url": link_url,
                                "status": status,
                                "error": f"HTTP {status}"
                            })
                        elif final_link_url != link_url:
                            redirect_links.append({
                                "original": link_url,
                                "redirected_to": final_link_url,
                                "status": status
                            })
                        else:
                            working_links.append({
                                "url": link_url,
                                "status": status
                            })
                            
                except asyncio.TimeoutError:
                    timeout_links.append({
                        "url": link_url,
                        "error": "Timeout"
                    })
                except aiohttp.ClientError as e:
                    broken_links.append({
                        "url": link_url,
                        "error": str(e)
                    })
        
        result["results"] = {
            "broken": broken_links,
            "working": len(working_links),
            "redirects": redirect_links,
            "timeouts": timeout_links
        }
        
        # Generate issues/warnings
        issues = []
        warnings = []
        passed = []
        
        if broken_links:
            issues.append(f"{len(broken_links)} broken link(s) found")
        else:
            passed.append("No broken links found")
        
        if redirect_links:
            warnings.append(f"{len(redirect_links)} link(s) redirect to different URLs")
        
        if timeout_links:
            warnings.append(f"{len(timeout_links)} link(s) timed out")
        
        if working_links:
            passed.append(f"{len(working_links)} links are working")
        
        # Calculate score
        if len(links_to_check) > 0:
            broken_ratio = len(broken_links) / len(links_to_check)
            score = int(100 * (1 - broken_ratio))
        else:
            score = 100
        
        result["score"] = score
        result["grade"] = _get_grade(score)
        result["issues"] = issues
        result["warnings"] = warnings
        result["passed"] = passed
        result["summary"] = {
            "total_issues": len(issues),
            "total_warnings": len(warnings),
            "total_passed": len(passed),
            "broken_count": len(broken_links),
            "working_count": len(working_links),
            "redirect_count": len(redirect_links),
            "timeout_count": len(timeout_links)
        }
        result["duration_ms"] = int((time.time() - start_time) * 1000)
        result["success"] = True
        
        return result
        
    except asyncio.TimeoutError:
        return {"success": False, "error": "Request timed out", "url": url}
    except Exception as e:
        logger.error(f"Broken links check error: {str(e)}")
        return {"success": False, "error": str(e), "url": url}


# =============================================================================
# AUDIT TOOL EXECUTORS MAPPING
# =============================================================================

AUDIT_TOOL_EXECUTORS = {
    "seo_audit": seo_audit,
    "accessibility_check": accessibility_check,
    "performance_check": performance_check,
    "security_headers_check": security_headers_check,
    "broken_links_check": broken_links_check
}


async def execute_audit_tool(tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute an audit tool by name
    
    Args:
        tool_name: Name of the audit tool
        params: Parameters for the tool
    
    Returns:
        Tool execution result
    """
    if tool_name not in AUDIT_TOOL_EXECUTORS:
        return {"success": False, "error": f"Unknown audit tool: {tool_name}"}
    
    executor = AUDIT_TOOL_EXECUTORS[tool_name]
    
    try:
        result = await executor(**params)
        return result
    except Exception as e:
        logger.error(f"Audit tool execution error: {str(e)}")
        return {"success": False, "error": str(e)}
