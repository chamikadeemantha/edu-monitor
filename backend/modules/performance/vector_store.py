"""
Vector Store Service using ChromaDB
Handles embedding storage and similarity search for RAG.
Uses ChromaDB's built-in ONNX embedding (avoids PyTorch/sentence-transformers
thread conflicts with YOLO inference on Windows).
"""
import logging
from typing import List, Dict, Optional, Tuple
import os
import hashlib

# Configure logging
logger = logging.getLogger(__name__)

# ChromaDB client (persistent storage)
_chroma_client = None
_chroma_error = None
_db_path = os.path.join(os.path.dirname(__file__), "vector_db")


def get_chroma_client():
    """Get or create ChromaDB client with persistent storage."""
    global _chroma_client, _chroma_error
    
    if _chroma_error:
        raise _chroma_error
    
    if _chroma_client is None:
        try:
            import chromadb
            os.makedirs(_db_path, exist_ok=True)
            _chroma_client = chromadb.PersistentClient(path=_db_path)
            logger.info(f"✅ ChromaDB initialized at {_db_path}")
        except ImportError as e:
            _chroma_error = e
            logger.error("❌ chromadb not installed. Run: pip install chromadb")
            raise
        except Exception as e:
            _chroma_error = e
            logger.error(f"❌ Failed to initialize ChromaDB: {e}")
            raise
    
    return _chroma_client


def get_or_create_collection(collection_name: str = "lecture_content"):
    """Get or create a collection for storing lecture content.
    
    Uses ChromaDB's built-in default embedding function (ONNX-based),
    which avoids PyTorch threading conflicts on Windows.
    """
    client = get_chroma_client()
    # Don't specify an embedding_function — ChromaDB will use its
    # default ONNX-based all-MiniLM-L6-v2 (no PyTorch needed)
    return client.get_or_create_collection(
        name=collection_name,
        metadata={"description": "Lecture slides and transcripts"}
    )


def generate_doc_id(text: str, source: str) -> str:
    """Generate a unique document ID based on content hash."""
    content = f"{source}:{text[:100]}"
    return hashlib.md5(content.encode()).hexdigest()


def add_documents(
    texts: List[str],
    source: str = "unknown",
    collection_name: str = "lecture_content",
    metadata: Optional[Dict] = None
) -> int:
    """
    Add documents to the vector store.
    
    ChromaDB will automatically generate embeddings using its built-in
    ONNX embedding function (no PyTorch/sentence-transformers needed).
    
    Args:
        texts: List of text chunks to store
        source: Source identifier (e.g., "slides", "transcript")
        collection_name: Name of the collection
        metadata: Additional metadata to store
    
    Returns:
        Number of documents added
    """
    if not texts:
        return 0
    
    try:
        collection = get_or_create_collection(collection_name)
        
        # Prepare documents
        ids = [generate_doc_id(text, source) for text in texts]
        metadatas = [
            {
                "source": source,
                "chunk_index": i,
                **(metadata or {})
            }
            for i in range(len(texts))
        ]
        
        # Add to collection — let ChromaDB handle embeddings internally
        # (uses ONNX runtime, avoids PyTorch thread conflicts)
        collection.upsert(
            ids=ids,
            documents=texts,
            metadatas=metadatas
        )
        
        logger.info(f"Added {len(texts)} documents to vector store (source: {source})")
        return len(texts)
    
    except Exception as e:
        logger.error(f"Failed to add documents: {e}")
        raise


def search_similar(
    query: str,
    n_results: int = 5,
    collection_name: str = "lecture_content",
    source_filter: Optional[str] = None
) -> List[Tuple[str, float, Dict]]:
    """
    Search for similar documents.
    Uses ChromaDB's built-in embedding for the query as well.
    
    Args:
        query: Search query
        n_results: Number of results to return
        collection_name: Name of the collection
        source_filter: Optional filter by source type
    
    Returns:
        List of (document, distance, metadata) tuples
    """
    try:
        collection = get_or_create_collection(collection_name)
        
        # Build where filter
        where_filter = None
        if source_filter:
            where_filter = {"source": source_filter}
        
        # Search using query_texts — ChromaDB embeds the query internally
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            where=where_filter,
            include=["documents", "distances", "metadatas"]
        )
        
        # Format results
        output = []
        if results["documents"] and results["documents"][0]:
            for doc, dist, meta in zip(
                results["documents"][0],
                results["distances"][0],
                results["metadatas"][0]
            ):
                output.append((doc, dist, meta))
        
        logger.debug(f"Search returned {len(output)} results for query: {query[:50]}...")
        return output
    
    except Exception as e:
        logger.error(f"Search failed: {e}")
        return []


def get_all_content(
    collection_name: str = "lecture_content",
    limit: int = 100
) -> List[str]:
    """Get all documents from a collection."""
    try:
        collection = get_or_create_collection(collection_name)
        results = collection.get(limit=limit, include=["documents"])
        return results.get("documents", [])
    except Exception as e:
        logger.error(f"Failed to get content: {e}")
        return []


def get_collection_stats(collection_name: str = "lecture_content") -> Dict:
    """Get statistics about a collection."""
    try:
        collection = get_or_create_collection(collection_name)
        count = collection.count()
        return {
            "name": collection_name,
            "document_count": count
        }
    except Exception as e:
        logger.warning(f"Failed to get stats: {e}")
        return {
            "name": collection_name,
            "document_count": 0,
            "error": str(e)
        }


def clear_collection(collection_name: str = "lecture_content") -> bool:
    """Clear all documents from a collection."""
    try:
        client = get_chroma_client()
        client.delete_collection(collection_name)
        logger.info(f"Cleared collection: {collection_name}")
        return True
    except Exception as e:
        logger.error(f"Failed to clear collection: {e}")
        return False
