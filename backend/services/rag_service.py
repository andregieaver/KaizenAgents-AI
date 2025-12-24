"""
RAG (Retrieval Augmented Generation) Service

This service handles:
1. Storing document chunks in the database
2. Retrieving relevant chunks based on user queries
3. Formatting context for AI agents

IMPORTANT: Agents should ONLY answer from retrieved context, never from general knowledge.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    """Split text into overlapping chunks for better retrieval."""
    if not text:
        return []
    
    chunks = []
    start = 0
    text_len = len(text)
    
    while start < text_len:
        end = start + chunk_size
        chunk = text[start:end]
        
        # Try to break at sentence boundary
        if end < text_len:
            last_period = chunk.rfind('.')
            last_newline = chunk.rfind('\n')
            break_point = max(last_period, last_newline)
            if break_point > chunk_size // 2:
                chunk = chunk[:break_point + 1]
                end = start + break_point + 1
        
        chunks.append(chunk.strip())
        start = end - overlap
    
    return [c for c in chunks if c]  # Remove empty chunks


async def store_document_chunks(
    db,
    agent_id: str,
    tenant_id: str,
    document_id: str,
    filename: str,
    content: str,
    source_type: str = "document"
) -> int:
    """
    Store document chunks in the database for later retrieval.
    
    Returns the number of chunks stored.
    """
    chunks = chunk_text(content)
    
    if not chunks:
        logger.warning(f"No chunks generated for document {filename}")
        return 0
    
    # Delete existing chunks for this document
    await db.knowledge_chunks.delete_many({
        "agent_id": agent_id,
        "document_id": document_id
    })
    
    # Store new chunks
    chunk_docs = []
    for i, chunk in enumerate(chunks):
        chunk_docs.append({
            "agent_id": agent_id,
            "tenant_id": tenant_id,
            "document_id": document_id,
            "filename": filename,
            "source_type": source_type,
            "chunk_index": i,
            "content": chunk,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    if chunk_docs:
        await db.knowledge_chunks.insert_many(chunk_docs)
    
    logger.info(f"Stored {len(chunk_docs)} chunks for document {filename}")
    return len(chunk_docs)


async def store_scraped_content(
    db,
    agent_id: str,
    tenant_id: str,
    url: str,
    content: str
) -> int:
    """
    Store scraped web page content as chunks.
    
    Returns the number of chunks stored.
    """
    chunks = chunk_text(content, chunk_size=600, overlap=100)
    
    if not chunks:
        return 0
    
    # Delete existing chunks for this URL
    await db.knowledge_chunks.delete_many({
        "agent_id": agent_id,
        "source_url": url
    })
    
    # Store new chunks
    chunk_docs = []
    for i, chunk in enumerate(chunks):
        chunk_docs.append({
            "agent_id": agent_id,
            "tenant_id": tenant_id,
            "document_id": None,
            "filename": None,
            "source_type": "webpage",
            "source_url": url,
            "chunk_index": i,
            "content": chunk,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    if chunk_docs:
        await db.knowledge_chunks.insert_many(chunk_docs)
    
    return len(chunk_docs)


async def retrieve_relevant_chunks(
    query: str,
    company_id: str,
    agent_id: str,
    db,
    api_key: str = None,
    top_k: int = 5
) -> List[Dict[str, Any]]:
    """
    Retrieve the most relevant chunks for a given query.
    
    For now, uses simple keyword matching. Can be enhanced with:
    - Embedding-based semantic search
    - Hybrid search (keyword + semantic)
    - Re-ranking
    """
    if not query:
        return []
    
    # Build search query - agent-specific first, then company-wide
    search_conditions = {
        "$or": [
            {"agent_id": agent_id, "tenant_id": company_id},
            {"tenant_id": company_id, "agent_id": {"$exists": False}}
        ]
    }
    
    # Get all chunks for this agent/company
    all_chunks = await db.knowledge_chunks.find(
        search_conditions,
        {"_id": 0}
    ).to_list(1000)
    
    if not all_chunks:
        logger.info(f"No knowledge chunks found for agent {agent_id}")
        return []
    
    # Simple relevance scoring based on keyword matching
    query_words = set(query.lower().split())
    scored_chunks = []
    
    for chunk in all_chunks:
        content = chunk.get("content", "").lower()
        
        # Score based on word overlap
        content_words = set(content.split())
        overlap = len(query_words & content_words)
        
        # Bonus for exact phrase matches
        if query.lower() in content:
            overlap += 5
        
        # Bonus for matching multiple query words
        if overlap > 0:
            scored_chunks.append((overlap, chunk))
    
    # Sort by score and return top_k
    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    
    return [chunk for score, chunk in scored_chunks[:top_k] if score > 0]


def format_context_for_agent(chunks: List[Dict[str, Any]]) -> str:
    """
    Format retrieved chunks into context string for the AI agent.
    """
    if not chunks:
        return ""
    
    context_parts = ["=== COMPANY KNOWLEDGE BASE ===\n"]
    context_parts.append("The following information is from the company's official documents and website.\n")
    context_parts.append("You MUST ONLY use this information to answer questions.\n\n")
    
    for i, chunk in enumerate(chunks, 1):
        source = chunk.get("filename") or chunk.get("source_url") or "Unknown source"
        content = chunk.get("content", "")
        
        context_parts.append(f"[Source {i}]: {source}")
        context_parts.append(f"{content}\n")
    
    context_parts.append("\n=== END OF KNOWLEDGE BASE ===\n")
    
    return "\n".join(context_parts)


async def get_knowledge_stats(db, agent_id: str, tenant_id: str) -> Dict[str, Any]:
    """
    Get statistics about an agent's knowledge base.
    """
    # Count chunks by source type
    pipeline = [
        {"$match": {"agent_id": agent_id, "tenant_id": tenant_id}},
        {"$group": {
            "_id": "$source_type",
            "count": {"$sum": 1}
        }}
    ]
    
    stats = {}
    async for doc in db.knowledge_chunks.aggregate(pipeline):
        stats[doc["_id"]] = doc["count"]
    
    # Get unique sources
    docs = await db.knowledge_chunks.distinct("filename", {
        "agent_id": agent_id,
        "tenant_id": tenant_id,
        "source_type": "document"
    })
    
    urls = await db.knowledge_chunks.distinct("source_url", {
        "agent_id": agent_id,
        "tenant_id": tenant_id,
        "source_type": "webpage"
    })
    
    return {
        "total_chunks": sum(stats.values()),
        "document_chunks": stats.get("document", 0),
        "webpage_chunks": stats.get("webpage", 0),
        "documents": len([d for d in docs if d]),
        "webpages": len([u for u in urls if u])
    }
