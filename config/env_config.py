# pipeline/config/env_config.py
import os
from pathlib import Path
from dotenv import load_dotenv

ENV_LOCATIONS = [
    Path.cwd() / ".env",
    Path(__file__).resolve().parents[2] / ".env",
]

_loaded = False

def load_env():
    global _loaded
    if _loaded:
        return
    for p in ENV_LOCATIONS:
        if p.exists():
            load_dotenv(p)
            _loaded = True
            break

def get_env(name: str, default=None, required=False):
    load_env()
    value = os.environ.get(name, default)
    if required and (value is None or value == ""):
        raise RuntimeError(f"❌ Missing environment variable: {name}")
    return value

def require_env(*names: str):
    """
    Checks that all indicated environment variables exist.
    Raises a clear exception if any are missing.
    """
    load_env()

    missing = []
    for name in names:
        value = os.environ.get(name)
        if value is None or value == "":
            missing.append(name)

    if missing:
        raise RuntimeError(f"❌ Missing environment variables configuration: {', '.join(missing)}")
