# Performance Module
# AI-powered lecture content processing with Ollama LLM and Qdrant

from .routes import router
from .llm_service import (
    check_ollama_connection,
    generate_summary,
    answer_question,
    filter_transcript
)
from .vector_store import (
    add_documents,
    search_similar,
    get_all_content,
    get_collection_stats
)
from .document_processor import (
    extract_text_from_pdf,
    chunk_text,
    process_document
)
from .content_filter import (
    filter_and_clean_transcript,
    batch_filter_transcripts
)
from .learning_outcomes import (
    upload_learning_outcomes,
    get_learning_outcomes,
    delete_learning_outcome,
    clear_all_outcomes,
)
from .quiz_service import (
    generate_quiz,
    get_all_quizzes,
    get_quiz,
    release_quiz,
    delete_quiz,
    get_released_quizzes,
    submit_quiz_response,
    get_quiz_responses,
)

__all__ = [
    'router',
    'check_ollama_connection',
    'generate_summary',
    'answer_question',
    'filter_transcript',
    'add_documents',
    'search_similar',
    'get_all_content',
    'get_collection_stats',
    'extract_text_from_pdf',
    'chunk_text',
    'process_document',
    'filter_and_clean_transcript',
    'batch_filter_transcripts',
    'upload_learning_outcomes',
    'get_learning_outcomes',
    'delete_learning_outcome',
    'clear_all_outcomes',
    'generate_quiz',
    'get_all_quizzes',
    'get_quiz',
    'release_quiz',
    'delete_quiz',
    'get_released_quizzes',
    'submit_quiz_response',
    'get_quiz_responses',
]
