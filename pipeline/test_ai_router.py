
import sys
import os
import requests

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from config.env_config import get_env
    
    HF_API_KEY = get_env("HF_API_KEY", required=False)
    # Using the DeepSeek model from params
    MODEL = "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B"
    BASE_URL = "https://router.huggingface.co/hf-inference/models/" 
    # Wait, search said https://router.huggingface.co/v1
    
    # Let's try the OpenAI compatible endpoint
    URL_CHAT = "https://router.huggingface.co/v1/chat/completions"
    
    print(f"--- Testing HF Router (OpenAI Compatible) ---")
    print(f"Model: {MODEL}")
    print(f"URL: {URL_CHAT}")
    
    if not HF_API_KEY:
        print("❌ Error: HF_API_KEY is missing in .env")
        sys.exit(1)
        
    headers = {
        "Authorization": f"Bearer {HF_API_KEY}",
        "Content-Type": "application/json"
    }
    
    body = {
        "model": MODEL,
        "messages": [
            {"role": "user", "content": "Say hello!"}
        ],
        "max_tokens": 10
    }
    
    print("\n--- Inference Check ---")
    try:
        resp = requests.post(URL_CHAT, headers=headers, json=body, timeout=10)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
    except Exception as e:
        print(f"❌ Exception: {e}")

except Exception as e:
    print(f"Error: {e}")
