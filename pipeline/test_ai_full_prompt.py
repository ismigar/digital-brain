
import sys
import os
import requests
import logging

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from config.logger_config import setup_logging
setup_logging("DEBUG")

try:
    from pipeline.ai_client import call_ai_client
    
    print("--- Testing AI Client with Full Prompt ---")
    
    # Simulate a large prompt similar to what robust_ai_parser generates
    # (shortened but representative structure)
    prompt = """You are a JSON-only responder.
    
    Return raw JSON ONLY. Do NOT include code fences, backticks, or any text before/after.
    
    TASK:
    Given a SOURCE NOTE and several CANDIDATE NOTES (each candidate shows its title and [UUID] in brackets),
    return conceptual connections from the source note to candidates.
    
    OUTPUT FORMAT (array only):
    [
      { "id": "<UUID exactly as shown in brackets>", "similarity": 0-100, "reason": "<brief explanation>" }
    ]
    
    CONSTRAINTS:
    - Use ONLY UUIDs appearing in the CANDIDATE NOTES headers (the text between [ and ]).
    - similarity MUST be an integer 0-100 (no percentages, no floats).
    - Include ONLY entries with similarity >= 60.
    - If there are NO connections >= 60, return exactly: []
    - Reason MUST be 8–20 words, concrete and human-readable. Avoid single-word labels like "Ètica".
    - Write reasons in Catalan or Spanish and mention 1–2 specific overlapping concepts/tags.
    - If any reason would be shorter than 8 words, DO NOT include that entry.
    
    SOURCE NOTE:
    Title: Test Note
    Tags: philosophy, ai
    Content preview: This is a test note about the intersection of philosophy and artificial intelligence...
    
    CANDIDATE NOTES (use the ID in brackets):
    1. [12345678-1234-1234-1234-1234567890ab] Artificial Intelligence Ethics
       Tags: ethics, ai
       Preview: Discussing the ethical implications of AI...
    2. [87654321-4321-4321-4321-ba0987654321] Political Philosophy
       Tags: politics, philosophy
       Preview: An overview of political philosophy...
    """
    
    print(f"Prompt length: {len(prompt)} chars")
    
    try:
        response = call_ai_client(prompt)
        print("\n--- Response Received ---")
        print(response)
    except Exception as e:
        print(f"\n❌ Error calling AI client: {e}")

except ImportError as e:
    print(f"Import Error: {e}")
except Exception as e:
    print(f"General Error: {e}")
