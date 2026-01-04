"""
Vector Store Service using ChromaDB
Handles embedding storage and similarity search for RAG.
"""
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Optional, Tuple
import os
import hashlib

# Initialize the embedding model (runs locally, free)
_embedding_model = None

def get_embedding_model() -> SentenceTransformer:
    """Lazy load the embedding model."""
    global _embedding_model
    if _embedding_model is None:
        # Using a lightweight but effective model
        _embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    return _embedding_model


# ChromaDB client (persistent storage)
_chroma_client = None
_db_path = os.path.join(os.path.dirname(__file__), "vector_db")

def get_chroma_client() -> chromadb.PersistentClient:
    """Get or create ChromaDB client with persistent storage."""
    global _chroma_client
    if _chroma_client is None:
        os.makedirs(_db_path, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(path=_db_path)
    return _chroma_client


def get_or_create_collection(collection_name: str = "lecture_content"):
    """Get or create a collection for storing lecture content."""
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=collection_name,
        metadata={"description": "Lecture slides and transcripts"}
    )


def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for a list of texts."""
    model = get_embedding_model()
    embeddings = model.encode(texts, convert_to_numpy=True)
    return embeddings.tolist()


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
    
    collection = get_or_create_collection(collection_name)
    
    # Generate embeddings
    embeddings = generate_embeddings(texts)
    
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
    
    # Add to collection (upsert to handle duplicates)
    collection.upsert(
        ids=ids,
        embeddings=embeddings,
        documents=texts,
        metadatas=metadatas
    )
    
    return len(texts)


def search_similar(
    query: str,
    n_results: int = 5,
    collection_name: str = "lecture_content",
    source_filter: Optional[str] = None
) -> List[Tuple[str, float, Dict]]:
    """
    Search for similar documents.
    
    Args:
        query: Search query
        n_results: Number of results to return
        collection_name: Name of the collection
        source_filter: Optional filter by source type
    
    Returns:
        List of (document, distance, metadata) tuples
    """
    collection = get_or_create_collection(collection_name)
    
    # Generate query embedding
    query_embedding = generate_embeddings([query])[0]
    
    # Build where filter
    where_filter = None
    if source_filter:
        where_filter = {"source": source_filter}
    
    # Search
    results = collection.query(
        query_embeddings=[query_embedding],
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
    
    return output


def get_all_content(
    collection_name: str = "lecture_content",
    limit: int = 100
) -> List[str]:
    """Get all documents from a collection."""
    collection = get_or_create_collection(collection_name)
    results = collection.get(limit=limit, include=["documents"])
    return results.get("documents", [])


def get_collection_stats(collection_name: str = "lecture_content") -> Dict:
    """Get statistics about a collection."""
    collection = get_or_create_collection(collection_name)
    count = collection.count()
    return {
        "name": collection_name,
        "document_count": count
    }


def clear_collection(collection_name: str = "lecture_content") -> bool:
    """Clear all documents from a collection."""
    try:
        client = get_chroma_client()
        client.delete_collection(collection_name)
        return True
    except Exception:
        return False
