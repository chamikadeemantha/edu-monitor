"""
Performance Module API Routes
Handles lecture content upload, transcript processing, and AI-powered summarization/Q&A.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import json

from .document_processor import process_document
from .vector_store import (
    add_documents, 
    search_similar, 
    get_all_content, 
    get_collection_stats,
    clear_collection
)
from .content_filter import filter_and_clean_transcript
from .llm_service import (
    check_ollama_connection,
    generate_summary,
    answer_question,
    get_available_models
)

router = APIRouter(prefix="/api/performance", tags=["performance"])


class TranscriptRequest(BaseModel):
    """Request body for transcript submission."""
    transcript: str
    use_llm_filter: bool = True


class QuestionRequest(BaseModel):
    """Request body for asking questions."""
    question: str


class StatusResponse(BaseModel):
    """Generic status response."""
    success: bool
    message: str
    data: Optional[dict] = None


@router.get("/health")
async def health_check():
    """Check health of the performance module and dependencies."""
    ollama_status = check_ollama_connection()
    vector_stats = get_collection_stats()
    models = get_available_models() if ollama_status else []
    
    return {
        "status": "healthy",
        "ollama_connected": ollama_status,
        "ollama_models": models,
        "vector_store": vector_stats
    }


@router.post("/upload", response_model=StatusResponse)
async def upload_lecture_slides(file: UploadFile = File(...)):
    """
    Upload lecture slides (PDF) for processing and storage.
    Extracts text, chunks it, and stores embeddings in vector DB.
    """
    # Validate file type
    if not file.filename.lower().endswith(('.pdf', '.txt')):
        raise HTTPException(
            status_code=400,
            detail="Only PDF and TXT files are supported"
        )
    
    try:
        # Read file content
        content = await file.read()
        
        # Process document into chunks
        chunks = process_document(content, file.filename)
        
        if not chunks:
            return StatusResponse(
                success=False,
                message="No text content could be extracted from the file"
            )
        
        # Store in vector database
        num_stored = add_documents(
            texts=chunks,
            source="slides",
            metadata={"filename": file.filename}
        )
        
        return StatusResponse(
            success=True,
            message=f"Successfully processed and stored {num_stored} content chunks",
            data={
                "filename": file.filename,
                "chunks_stored": num_stored,
                "sample_chunk": chunks[0][:200] + "..." if chunks else None
            }
        )
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


@router.post("/transcript", response_model=StatusResponse)
async def submit_transcript(request: TranscriptRequest):
    """
    Submit live transcript text for processing.
    Filters the transcript to extract meaningful content and stores it.
    """
    if not request.transcript or len(request.transcript.strip()) < 10:
        return StatusResponse(
            success=False,
            message="Transcript is too short or empty"
        )
    
    try:
        # Filter the transcript
        cleaned_content = filter_and_clean_transcript(
            request.transcript,
            use_llm=request.use_llm_filter
        )
        
        if not cleaned_content:
            return StatusResponse(
                success=False,
                message="No meaningful content extracted from transcript"
            )
        
        # Store in vector database
        num_stored = add_documents(
            texts=[cleaned_content],
            source="transcript",
            metadata={"type": "live_speech"}
        )
        
        return StatusResponse(
            success=True,
            message="Transcript processed and stored successfully",
            data={
                "original_length": len(request.transcript),
                "cleaned_length": len(cleaned_content),
                "chunks_stored": num_stored,
                "preview": cleaned_content[:200] + "..." if len(cleaned_content) > 200 else cleaned_content
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


@router.get("/summary")
async def get_summary():
    """
    Generate a summary of all stored lecture content.
    Returns a streaming response as the LLM generates the summary.
    """
    # Check Ollama connection
    if not check_ollama_connection():
        raise HTTPException(
            status_code=503,
            detail="Ollama LLM is not available. Please ensure it's running."
        )
    
    # Get all stored content
    all_content = get_all_content(limit=50)
    
    if not all_content:
        raise HTTPException(
            status_code=404,
            detail="No lecture content found. Please upload slides or submit transcripts first."
        )
    
    # Combine content for context
    context = "\n\n---\n\n".join(all_content[:20])  # Limit context size
    
    # Stream the summary
    def generate():
        for chunk in generate_summary(context):
            # Send as SSE format
            yield f"data: {json.dumps({'text': chunk})}\n\n"
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/ask")
async def ask_question(request: QuestionRequest):
    """
    Ask a question about the lecture content.
    Uses RAG to retrieve relevant content and streams the answer.
    """
    if not request.question or len(request.question.strip()) < 3:
        raise HTTPException(status_code=400, detail="Question is too short")
    
    # Check Ollama connection
    if not check_ollama_connection():
        raise HTTPException(
            status_code=503,
            detail="Ollama LLM is not available. Please ensure it's running."
        )
    
    # Search for relevant content
    search_results = search_similar(request.question, n_results=5)
    
    if not search_results:
        raise HTTPException(
            status_code=404,
            detail="No relevant content found. Please upload lecture materials first."
        )
    
    # Build context from search results
    context_parts = [doc for doc, dist, meta in search_results]
    context = "\n\n---\n\n".join(context_parts)
    
    # Stream the answer
    def generate():
        for chunk in answer_question(context, request.question):
            yield f"data: {json.dumps({'text': chunk})}\n\n"
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/stats")
async def get_stats():
    """Get statistics about stored content."""
    stats = get_collection_stats()
    return {
        "success": True,
        "data": stats
    }


@router.delete("/clear")
async def clear_content():
    """Clear all stored lecture content."""
    success = clear_collection()
    return StatusResponse(
        success=success,
        message="Content cleared successfully" if success else "Failed to clear content"
    )
