"""
RAG (Retrieval-Augmented Generation) Service
Handles document processing, embedding generation, and semantic search
"""

import os
import re
from typing import List, Dict, Optional
from pathlib import Path
import PyPDF2
import docx
import pdfplumber
import pandas as pd
from openai import OpenAI

EMBEDDING_MODEL = "text-embedding-3-small"
CHUNK_SIZE = 800  # tokens (roughly 600 words)
CHUNK_OVERLAP = 100  # tokens


def extract_text_from_file(filepath: str, filename: str) -> str:
    """Extract text content from various file formats"""
    ext = Path(filename).suffix.lower()
    
    try:
        if ext == '.txt':
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        
        elif ext == '.md':
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        
        elif ext == '.pdf':
            # Try pdfplumber first (better for complex PDFs)
            try:
                with pdfplumber.open(filepath) as pdf:
                    text = ""
                    for page in pdf.pages:
                        text += page.extract_text() or ""
                    return text
            except:
                # Fallback to PyPDF2
                with open(filepath, 'rb') as f:
                    pdf_reader = PyPDF2.PdfReader(f)
                    text = ""
                    for page in pdf_reader.pages:
                        text += page.extract_text() or ""
                    return text
        
        elif ext == '.docx':
            doc = docx.Document(filepath)
            text = ""
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
            return text
        
        elif ext == '.csv':
            df = pd.read_csv(filepath)
            # Convert CSV to readable text format
            return df.to_string()
        
        else:
            raise ValueError(f"Unsupported file type: {ext}")
    
    except Exception as e:
        raise Exception(f"Error extracting text from {filename}: {str(e)}")


def estimate_tokens(text: str) -> int:
    """Rough estimation of token count (1 token ≈ 4 characters)"""
    return len(text) // 4


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Split text into overlapping chunks"""
    # Simple sentence-based chunking
    sentences = re.split(r'(?<=[.!?])\s+', text)
    
    chunks = []
    current_chunk = ""
    current_tokens = 0
    
    for sentence in sentences:
        sentence_tokens = estimate_tokens(sentence)
        
        if current_tokens + sentence_tokens > chunk_size and current_chunk:
            # Save current chunk
            chunks.append(current_chunk.strip())
            
            # Start new chunk with overlap
            words = current_chunk.split()
            overlap_text = " ".join(words[-overlap:]) if len(words) > overlap else current_chunk
            current_chunk = overlap_text + " " + sentence
            current_tokens = estimate_tokens(current_chunk)
        else:
            current_chunk += " " + sentence
            current_tokens += sentence_tokens
    
    # Add final chunk
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    
    return chunks


def generate_embeddings(texts: List[str], api_key: str) -> List[List[float]]:
    """Generate embeddings using OpenAI text-embedding-3-small"""
    try:
        client = OpenAI(api_key=api_key)
        
        # OpenAI allows batch embedding (up to 2048 texts)
        embeddings = []
        batch_size = 100
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            response = client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=batch
            )
            embeddings.extend([item.embedding for item in response.data])
        
        return embeddings
    
    except Exception as e:
        raise Exception(f"Error generating embeddings: {str(e)}")


def process_document(filepath: str, filename: str, company_id: str, doc_id: str) -> List[Dict]:
    """
    Process a document: extract text, chunk it, generate embeddings
    Returns list of chunk documents ready to insert into MongoDB
    """
    # Extract text
    text = extract_text_from_file(filepath, filename)
    
    if not text or len(text.strip()) < 50:
        raise ValueError("Document appears to be empty or too short")
    
    # Clean text
    text = re.sub(r'\s+', ' ', text).strip()
    
    # Chunk text
    chunks = chunk_text(text)
    
    if not chunks:
        raise ValueError("No chunks generated from document")
    
    # Generate embeddings for all chunks
    embeddings = generate_embeddings(chunks)
    
    # Create chunk documents
    chunk_docs = []
    for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        chunk_doc = {
            "company_id": company_id,
            "document_id": doc_id,
            "filename": filename,
            "chunk_index": idx,
            "text": chunk,
            "embedding": embedding,
            "token_count": estimate_tokens(chunk)
        }
        chunk_docs.append(chunk_doc)
    
    return chunk_docs


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calculate cosine similarity between two vectors"""
    dot_product = sum(x * y for x, y in zip(a, b))
    magnitude_a = sum(x * x for x in a) ** 0.5
    magnitude_b = sum(x * x for x in b) ** 0.5
    
    if magnitude_a == 0 or magnitude_b == 0:
        return 0.0
    
    return dot_product / (magnitude_a * magnitude_b)


async def retrieve_relevant_chunks(query: str, company_id: str, db, top_k: int = 5) -> List[Dict]:
    """
    Retrieve most relevant document chunks for a query
    Returns list of chunks with similarity scores
    """
    # Generate embedding for the query
    query_embeddings = generate_embeddings([query])
    query_embedding = query_embeddings[0]
    
    # Get all chunks for this company
    chunks = await db.document_chunks.find(
        {"company_id": company_id},
        {"_id": 0}
    ).to_list(10000)  # Limit to prevent memory issues
    
    if not chunks:
        return []
    
    # Calculate similarity scores
    for chunk in chunks:
        chunk["similarity"] = cosine_similarity(query_embedding, chunk["embedding"])
    
    # Sort by similarity and return top_k
    chunks.sort(key=lambda x: x["similarity"], reverse=True)
    
    return chunks[:top_k]


def format_context_for_agent(chunks: List[Dict]) -> str:
    """Format retrieved chunks into context string for the agent"""
    if not chunks:
        return ""
    
    context = "RELEVANT INFORMATION FROM COMPANY DOCUMENTATION:\n\n"
    
    for idx, chunk in enumerate(chunks, 1):
        context += f"[Source {idx}: {chunk['filename']}]\n"
        context += f"{chunk['text']}\n\n"
    
    context += "---\n\n"
    context += "Use ONLY the above information to answer the customer's question. "
    context += "If the answer is not in the provided documentation, say you don't have that information.\n"
    
    return context
