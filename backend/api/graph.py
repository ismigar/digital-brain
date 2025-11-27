from flask import Flask, jsonify
from pathlib import Path
import json
from config.app_config import load_params

cfg = load_params()
OUT_GRAPH = Path(cfg.paths["OUT_GRAPH"])

app = Flask(__name__)

@app.get("/api/graph")
def api_graph():
    app.logger.info(f"Demana /api/graph, OUT_GRAPH={OUT_GRAPH}")
    try:
        if not OUT_GRAPH.exists():
            app.logger.error(f"OUT_GRAPH no trobat: {OUT_GRAPH}")
            return jsonify({"error": "GRAPH_NOT_FOUND", "path": str(OUT_GRAPH)}), 404

        with OUT_GRAPH.open("r", encoding="utf-8") as f:
            data = json.load(f)

        return jsonify(data)

    except Exception as e:
        app.logger.exception("Error carregant OUT_GRAPH")
        return jsonify({"error": "INTERNAL_ERROR", "detail": str(e)}), 500
