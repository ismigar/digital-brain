# src/config/paths_config.py
from pathlib import Path
import sys

# ──────────────────────────────────────────────
# 1️⃣ Garanteix que el directori arrel (src/) estigui al PYTHONPATH
# Això evita conflictes amb paquets externs anomenats "config"
# i permet imports fiables: from config.paths_config import LAYOUT_FILE
# ──────────────────────────────────────────────
_this_file = Path(__file__).resolve()
project_root = _this_file.parents[2]  # puja fins /notion-scripts
src_dir = project_root / "src"

if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

# ──────────────────────────────────────────────
# 2️⃣ Resolució automàtica del directori de projecte
# ──────────────────────────────────────────────
def _resolve_project_dir(start: Path) -> Path:
    """
    Puja directoris fins trobar un marcador d'arrel ('.git', 'pyproject.toml' o 'requirements.txt').
    Si no en troba, torna uns nivells amunt com a fallback.
    """
    cur = start
    for _ in range(6):
        if (cur / ".git").exists() or (cur / "pyproject.toml").exists() or (cur / "requirements.txt").exists():
            return cur
        cur = cur.parent
    p = Path(__file__).resolve()
    return p.parents[3] if (p.parent.name == "config" and p.parents[1].name == "src") else p.parents[2]

# ──────────────────────────────────────────────
# 3️⃣ Definició de rutes principals
# ──────────────────────────────────────────────
PROJECT_DIR = _resolve_project_dir(Path(__file__).resolve())
CONFIG_DIR  = PROJECT_DIR / "config"

OUT_DIR   = PROJECT_DIR / "backend" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

OUT_JSON    = OUT_DIR / "suggestions.json"
OUT_GRAPH   = OUT_DIR / "graph_sigma.json"

LOG_DIR = PROJECT_DIR / "backend" / "data" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

STOPWORDS_PATH = CONFIG_DIR / "stopwords.json"

# ──────────────────────────────────────────────
# 5️⃣ API pública: obtenir totes les rutes
# ──────────────────────────────────────────────

def get_paths():
    """
    Retorna totes les rutes importants del projecte de forma estructurada.
    Útil des de qualsevol part del pipeline:
        paths = get_paths()
        print(paths.OUT_JSON)
    """
    return {
        "PROJECT_DIR": PROJECT_DIR,
        "CONFIG_DIR": CONFIG_DIR,
        "OUT_DIR": OUT_DIR,
        "OUT_JSON": OUT_JSON,
        "OUT_GRAPH": OUT_GRAPH,
        "LOG_DIR": LOG_DIR,
        "STOPWORDS_PATH": STOPWORDS_PATH,
    }
