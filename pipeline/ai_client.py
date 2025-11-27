# pipeline/ai_clients/ai_client.py
import requests
from config.logger_config import setup_logging, get_logger
from config.app_config import load_params
from config.env_config import get_env

cfg = load_params()
setup_logging(getattr(cfg, "log_level", "INFO"))
log = get_logger(__name__)

cfg = load_params()

AI_MODEL   = cfg.ai["model_name"]
AI_URL     = cfg.ai["model_url"]
# API Key is optional for local Ollama, but required for some remote providers.
# We get it if it exists, otherwise use a dummy value if needed or None.
AI_API_KEY = get_env("HF_API_KEY", required=False) or "ollama" 


def call_ai_client(prompt: str, stream: bool = False, timeout: int = 120):
    headers = {
        "Content-Type": "application/json",
    }
    if AI_API_KEY:
        headers["Authorization"] = f"Bearer {AI_API_KEY}"

    # Construct OpenAI-compatible payload
    body = {
        "model": AI_MODEL,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 1000,
        "temperature": 0.2,
    }

    try:
        resp = requests.post(AI_URL, headers=headers, json=body, timeout=timeout)
        if resp.status_code != 200:
            raise RuntimeError(f"AI error {resp.status_code}: {resp.text}")

        data = resp.json()

        # Parse response in OpenAI format
        msg = data["choices"][0]["message"]
        return msg.get("content") or msg.get("reasoning_content") or ""
    except Exception as e:
        log.error(f"AI call failed: {e}")
        # Return empty string or re-raise depending on desired behavior. 
        # The original code returned str(data) on key error, but logging and returning empty might be safer or raising.
        # Let's stick to raising runtime error if status is bad, but for parsing errors...
        if 'resp' in locals() and resp.status_code != 200:
             raise RuntimeError(f"AI error {resp.status_code}: {resp.text}")
        raise e


def check_model_availability() -> bool:
    """Checks if the AI model is reachable."""
    headers = {
        "Content-Type": "application/json",
    }
    if AI_API_KEY:
        headers["Authorization"] = f"Bearer {AI_API_KEY}"

    # Perform simple inference check
    body = {
        "model": AI_MODEL,
        "messages": [{"role": "user", "content": "Hi"}],
        "max_tokens": 1
    }
    try:
        # Increased timeout for cold starts
        resp = requests.post(AI_URL, headers=headers, json=body, timeout=30)
        return resp.status_code == 200
    except Exception as e:
        log.warning(f"AI Model check failed: {e}")
        return False
