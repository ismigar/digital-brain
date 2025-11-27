import json
from flask import Blueprint, jsonify
from backend.config import GRAPH_JSON_PATH

nodes_bp = Blueprint("nodes", __name__)

@nodes_bp.route("/node/<node_id>")
def get_node(node_id):
  try:
    with open(GRAPH_JSON_PATH) as f:
      data = json.load(f)

    node = next(
      (n for n in data["nodes"] if str(n["key"]) == str(node_id)),
      None
    )

    if not node:
      return {"error": "Node not found"}, 404

    return jsonify(node)

  except Exception as e:
    return {"error": str(e)}, 500
