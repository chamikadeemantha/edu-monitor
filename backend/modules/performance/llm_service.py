"""
LLM Service for Ollama Integration
Provides streaming text generation and chat completion via local Ollama instance.
"""
import requests
import json
from typing import Generator, List, Dict, Optional

OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_MODEL = "llama3-it"


def check_ollama_connection() -> bool:
    """Check if Ollama is running and accessible."""
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        return response.status_code == 200
    except requests.exceptions.RequestException:
        return False


def get_available_models() -> List[str]:
    """Get list of available models in Ollama."""
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        if response.status_code == 200:
            data = response.json()
            return [model["name"] for model in data.get("models", [])]
        return []
    except requests.exceptions.RequestException:
        return []


def generate_streaming(
    prompt: str,
    model: str = DEFAULT_MODEL,
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 2048
) -> Generator[str, None, None]:
    """
    Generate text with streaming response from Ollama.
    Yields text chunks as they arrive.
    """
    url = f"{OLLAMA_BASE_URL}/api/generate"
    
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": True,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens
        }
    }
    
    if system_prompt:
        payload["system"] = system_prompt
    
    try:
        with requests.post(url, json=payload, stream=True, timeout=120) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line)
                        if "response" in data:
                            yield data["response"]
                        if data.get("done", False):
                            break
                    except json.JSONDecodeError:
                        continue
    except requests.exceptions.RequestException as e:
        yield f"[Error connecting to Ollama: {str(e)}]"


def generate_complete(
    prompt: str,
    model: str = DEFAULT_MODEL,
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 2048
) -> str:
    """
    Generate text and return complete response (non-streaming).
    """
    chunks = list(generate_streaming(prompt, model, system_prompt, temperature, max_tokens))
    return "".join(chunks)


def chat_streaming(
    messages: List[Dict[str, str]],
    model: str = DEFAULT_MODEL,
    temperature: float = 0.7
) -> Generator[str, None, None]:
    """
    Chat completion with streaming response.
    Messages format: [{"role": "user"|"assistant"|"system", "content": "..."}]
    """
    url = f"{OLLAMA_BASE_URL}/api/chat"
    
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "options": {
            "temperature": temperature
        }
    }
    
    try:
        with requests.post(url, json=payload, stream=True, timeout=120) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line)
                        if "message" in data and "content" in data["message"]:
                            yield data["message"]["content"]
                        if data.get("done", False):
                            break
                    except json.JSONDecodeError:
                        continue
    except requests.exceptions.RequestException as e:
        yield f"[Error connecting to Ollama: {str(e)}]"


# RAG Prompt Templates
SUMMARY_SYSTEM_PROMPT = """You are an educational assistant that creates clear, concise summaries of lecture content.
Your summaries should:
- Highlight key concepts and main ideas
- Be well-organized with clear structure
- Use simple language accessible to students
- Include important definitions and examples mentioned"""

SUMMARY_PROMPT_TEMPLATE = """Based on the following lecture content, provide a comprehensive summary for students:

LECTURE CONTENT:
{context}

Please provide a well-structured summary covering the main topics and key points."""

QA_SYSTEM_PROMPT = """You are an educational assistant helping students understand lecture content.
Answer questions based ONLY on the provided context. If the answer is not in the context, say so.
Provide clear, educational explanations."""

QA_PROMPT_TEMPLATE = """Use the following lecture content to answer the student's question.
If the answer is not found in the content, acknowledge that and provide general guidance.

LECTURE CONTENT:
{context}

STUDENT QUESTION: {question}

Please provide a helpful, educational answer:"""

FILTER_SYSTEM_PROMPT = """You are a transcript processor. Your job is to:
1. Remove filler words (um, uh, like, you know, so, basically, etc.)
2. Fix grammar and sentence structure
3. Extract the meaningful educational content
4. Maintain the original meaning and key explanations
5. Return ONLY the cleaned, coherent text - no commentary"""

FILTER_PROMPT_TEMPLATE = """Clean the following raw speech transcript. Remove filler words, fix grammar, and extract only the meaningful educational content:

RAW TRANSCRIPT:
{transcript}

CLEANED CONTENT:"""


def generate_summary(context: str, model: str = DEFAULT_MODEL) -> Generator[str, None, None]:
    """Generate a streaming summary of lecture content."""
    prompt = SUMMARY_PROMPT_TEMPLATE.format(context=context)
    return generate_streaming(prompt, model, SUMMARY_SYSTEM_PROMPT, temperature=0.5)


def answer_question(context: str, question: str, model: str = DEFAULT_MODEL) -> Generator[str, None, None]:
    """Answer a question based on lecture content with streaming response."""
    prompt = QA_PROMPT_TEMPLATE.format(context=context, question=question)
    return generate_streaming(prompt, model, QA_SYSTEM_PROMPT, temperature=0.3)


def filter_transcript(raw_transcript: str, model: str = DEFAULT_MODEL) -> str:
    """Filter raw transcript to extract meaningful content (non-streaming for processing)."""
    prompt = FILTER_PROMPT_TEMPLATE.format(transcript=raw_transcript)
    return generate_complete(prompt, model, FILTER_SYSTEM_PROMPT, temperature=0.2, max_tokens=1024)
