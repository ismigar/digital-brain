from flask import Blueprint, jsonify
from backend.config import PORT, HOST

config_bp = Blueprint("config", __name__)

@config_bp.route("/config")
def get_config():
    return jsonify({"port": PORT, "host": HOST})
