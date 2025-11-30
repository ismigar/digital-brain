from pathlib import Path
import sys
import json

# Afegeix l'arrel del projecte (…/digital-brain)
BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from flask import Flask, jsonify
from config.logger_config import setup_logging, get_logger
from config.app_config import load_params

# ──────────────── Config unificada ────────────────
setup_logging()
log = get_logger(__name__)

cfg = load_params(strict_env=False)
server_cfg = getattr(cfg, "server", {}) or cfg.get("server", {}) or {}

HOST = server_cfg.get("host", "0.0.0.0")
BACKEND_PORT = int(server_cfg.get("backend_port", 5001))
ENABLED_CORS = bool(server_cfg.get("enabled_cors", True))
OUT_GRAPH = cfg.paths.get("OUT_GRAPH")

app = Flask(__name__, static_folder="../frontend/dist", static_url_path="/")

if ENABLED_CORS:
    from flask_cors import CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}})

from backend.api.config_routes import config_bp
from backend.api.env_routes import env_bp

app.register_blueprint(config_bp, url_prefix='/api')
app.register_blueprint(env_bp, url_prefix='/api')

# ──────────────── ÚNICA RUTA /api/graph ────────────────
@app.get("/api/graph")
def api_graph():
    try:
        log.info(f"Demana /api/graph, OUT_GRAPH_SIGMA={OUT_GRAPH}")
        path = Path(OUT_GRAPH)

        if not path.exists():
            log.error(f"FITXER NO TROBAT: {path}")
            return jsonify({"error": "NOT_FOUND", "path": str(path)}), 404

        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)

        return jsonify(data)

    except Exception as e:
        log.exception("Error servint /api/graph")
        return jsonify({"error": "INTERNAL", "detail": str(e)}), 500

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path != "" and (Path(app.static_folder) / path).exists():
        return app.send_static_file(path)
    return app.send_static_file("index.html")

# ──────────────── MAIN ────────────────
if __name__ == "__main__":
    debug_mode = (cfg.get("logging_level", "").lower() == "debug")
    log.info(f"Arrencant Flask a {HOST}:{BACKEND_PORT}, debug={debug_mode}")
    app.run(host=HOST, port=BACKEND_PORT, debug=debug_mode)
