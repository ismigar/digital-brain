# config/app_config.py
import yaml
from pathlib import Path
from config.env_config import get_env
from config.paths_config import get_paths
from config.schema_keys import get_schema_keys

class Config:
    def __init__(self, params: dict, strict_env: bool = True):
        self.hf = {}

        if params is None:
            # If needed, internal load_params could be reused here, but it's not currently necessary.
            params = {}

        self.params = params

        # --- Load YAML sub-dictionaries ---
        self.notion      = params.get("notion", {})
        self.ai          = params.get("ai", {})
        self.graph       = params.get("graph", {})
        self.colors      = params.get("colors", {})
        self.input_files = params.get("input_files", {})
        self.mapping     = params.get("mapping", {})

        # --- Load top-level simple keys ---
        for k, v in params.items():
            if isinstance(v, (str, int, float, bool, type(None))):
                setattr(self, k, v)

        # --- Load environment secrets ---
        req = bool(strict_env)

        self.notion["NOTION_TOKEN"]     = get_env("NOTION_TOKEN", required=req)
        self.notion["NOTION_DATABASE"]  = get_env("DATABASE_ID", required=req)
        self.hf["API_KEY"]              = get_env("HF_API_KEY", required=False)

        self.hf["MODEL"]                = get_env("HF_MODEL", default=self.ai.get("model_name"))

        # --- Paths ---
        self.paths       = get_paths()

        # --- Schema keys ---
        self.schema_keys = get_schema_keys()


    def get(self, key, default=None):
        return self.params.get(key, default)


def load_params(strict_env: bool = True) -> Config:
    path = Path(__file__).resolve().parent / "params.yaml"
    if not path.exists():
        raise RuntimeError(f"Cannot find params.yaml at {path}")
    with path.open("r", encoding="utf-8") as f:
        params = yaml.safe_load(f)
    return Config(params, strict_env=strict_env)
