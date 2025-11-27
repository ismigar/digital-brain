import subprocess
from flask import Blueprint
from backend.config import (PIPELINE_SCRIPT)

regenerate_bp = Blueprint("regenerate", __name__)

@regenerate_bp.route("/regenerate", methods=["POST"])
def regenerate():
  subprocess.run(["python3", PIPELINE_SCRIPT])
  return {"status": "ok"}
