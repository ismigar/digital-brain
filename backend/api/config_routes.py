from flask import Blueprint, jsonify, request
from config.app_config import load_params
from pathlib import Path
import yaml
import logging

config_bp = Blueprint('config', __name__)
log = logging.getLogger(__name__)

PARAMS_PATH = Path(__file__).resolve().parents[2] / "config" / "params.yaml"

@config_bp.route('/config', methods=['GET'])
def get_config():
    try:
        # Reload params to get the latest version from disk
        cfg = load_params(strict_env=False)
        return jsonify(cfg.params)
    except Exception as e:
        log.error(f"Error reading config: {e}")
        return jsonify({"error": str(e)}), 500

@config_bp.route('/config', methods=['POST'])
def update_config():
    try:
        new_config = request.json
        if not new_config:
            return jsonify({"error": "No data provided"}), 400

        # We need to read the existing file to preserve structure if possible, 
        # but with PyYAML we'll just overwrite. 
        # To be safe, we might want to read, update, and write.
        
        # 1. Read current raw yaml to maybe keep some things? 
        # Actually, let's just use safe_dump. 
        # Note: This WILL remove comments.
        
        with open(PARAMS_PATH, 'w', encoding='utf-8') as f:
            yaml.safe_dump(new_config, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
            
        return jsonify({"status": "success", "message": "Configuration updated"}), 200

    except Exception as e:
        log.error(f"Error updating config: {e}")
        return jsonify({"error": str(e)}), 500
