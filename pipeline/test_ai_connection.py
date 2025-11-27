
import sys
import os
import requests
from pprint import pprint

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from config.app_config import load_params
    from config.env_config import get_env
    
    cfg = load_params()
    HF_MODEL = cfg.ai["model_name"]
    HF_URL = f"{cfg.ai['model_url']}{HF_MODEL}"
    HF_API_KEY = get_env("HF_API_KEY", required=False)
    
    print(f"--- Configuration ---")
    print(f"Model Name: {HF_MODEL}")
    print(f"Full URL: {HF_URL}")
    print(f"API Key present: {'Yes' if HF_API_KEY else 'NO'}")
    
    if not HF_API_KEY:
        print("❌ Error: HF_API_KEY is missing in .env")
        sys.exit(1)
        
    print("\n--- Testing Availability (GET request) ---")
    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    
    try:
        resp = requests.get(HF_URL, headers=headers, timeout=10)
        print(f"Status Code: {resp.status_code}")
        print(f"Response Headers: {resp.headers}")
        try:
            print(f"Response Body: {resp.json()}")
        except:
            print(f"Response Body (text): {resp.text}")
            
        if resp.status_code == 200:
            print("✅ Model is reachable.")
        else:
            print("⚠️ Model check failed.")
            
    except Exception as e:
        print(f"❌ Exception during check: {e}")

    print("\n--- Testing Inference (POST request) ---")
    prompt = "Say hello!"
    body = {
        "inputs": prompt,
        "parameters": {"max_new_tokens": 10}
    }
    
    try:
        resp = requests.post(HF_URL, headers=headers, json=body, timeout=10)
        print(f"Status Code: {resp.status_code}")
        try:
            print(f"Response: {resp.json()}")
        except:
            print(f"Response (text): {resp.text}")
            
    except Exception as e:
        print(f"❌ Exception during inference: {e}")

except ImportError as e:
    print(f"Import Error: {e}")
except Exception as e:
    print(f"General Error: {e}")
