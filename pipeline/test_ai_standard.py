
import sys
import os
import requests

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from config.app_config import load_params
    from config.env_config import get_env
    
    cfg = load_params()
    # Override with a known working model for testing
    HF_MODEL = "google/flan-t5-small" 
    # Revert to original URL for testing
    HF_URL_BASE = "https://api-inference.huggingface.co/models/"
    HF_URL = f"{HF_URL_BASE}{HF_MODEL}"
    HF_API_KEY = get_env("HF_API_KEY", required=False)
    
    print(f"--- Testing Standard Model ---")
    print(f"Model: {HF_MODEL}")
    print(f"URL: {HF_URL}")
    
    if not HF_API_KEY:
        print("❌ Error: HF_API_KEY is missing in .env")
        sys.exit(1)
        
    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    
    print("\n--- Availability Check ---")
    try:
        resp = requests.get(HF_URL, headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            print("✅ Standard model is reachable.")
        else:
            print(f"⚠️ Standard model check failed: {resp.text}")
    except Exception as e:
        print(f"❌ Exception: {e}")

    print("\n--- Inference Check ---")
    try:
        resp = requests.post(HF_URL, headers=headers, json={"inputs": "Hello"}, timeout=10)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ Exception: {e}")

except Exception as e:
    print(f"Error: {e}")
