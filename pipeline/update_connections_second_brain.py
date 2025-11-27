"""
Automatically updates "Enllaça a" (and therefore "Enllaça per") from mentions
to Notion pages, with:
- Database and blocks pagination (next_cursor / has_more)
- Bulk update and, if it fails, incremental fallback ONE-BY-ONE
- Preservation of existing links (none are lost)
- CSV of IDs without access: output/missing_access.csv
"""

from __future__ import annotations
from typing import List, Tuple, Optional
from notion_client import Client
import os
import csv
from config.logger_config import setup_logging, get_logger
from config import load_params
from config.env_config import get_env, require_env

cfg = load_params()  # carrega params.yaml + ENV overrides

setup_logging(getattr(cfg, "log_level", "INFO"))
log = get_logger(__name__)

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------

# Variables d'entorn i Client de Notion
require_env("NOTION_TOKEN", "DATABASE_ID")
NOTION_TOKEN = get_env("NOTION_TOKEN", required=True)
DATABASE_ID  = get_env("DATABASE_ID",  required=True)

# (source_page_id, mentioned_page_id|None, error_msg)
missing: List[Tuple[str, Optional[str], str]] = []

if not NOTION_TOKEN or not DATABASE_ID:
    log.info("❌ Error: missing NOTION_TOKEN or DATABASE_ID in environment (~/.config/notion-env)")
    raise SystemExit(1)

notion = Client(auth=NOTION_TOKEN)

# ---------------------------
# Notion pagination utils
# ---------------------------

def fetch_all_pages(database_id: str) -> List[dict]:
    pages, start_cursor = [], None
    while True:
        resp = notion.databases.query(
            database_id=database_id,
            **({"start_cursor": start_cursor} if start_cursor else {})
        )
        pages.extend(resp.get("results", []))
        if not resp.get("has_more"):
            break
        start_cursor = resp.get("next_cursor")
    return pages


def fetch_all_blocks(block_or_page_id: str) -> List[dict]:
    blocks, start_cursor = [], None
    while True:
        # Notion uses "block_id" even for pages
        resp = notion.blocks.children.list(
            block_id=block_or_page_id,
            **({"start_cursor": start_cursor} if start_cursor else {})
        )
        blocks.extend(resp.get("results", []))
        if not resp.get("has_more"):
            break
        start_cursor = resp.get("next_cursor")
    return blocks


# ---------------------------
# Extraction of mentions
# ---------------------------

def extraer_menciones_de_pagina(page_id: str) -> List[str]:
    """Returns the list of IDs of pages mentioned in the content (level 1)."""
    menciones: List[str] = []
    try:
        blocks = fetch_all_blocks(page_id)
        text_like = {
            "paragraph", "heading_1", "heading_2", "heading_3",
            "bulleted_list_item", "numbered_list_item", "to_do", "toggle",
            "quote", "callout"
        }
        for block in blocks:
            btype = block.get("type")
            if btype in text_like:
                rich_text = block.get(btype, {}).get("rich_text", [])
                for t in rich_text:
                    if t.get("type") == "mention" and t.get("mention", {}).get("type") == "page":
                        pid = t["mention"]["page"]["id"]
                        menciones.append(pid)
    except Exception as e:
        log.info(f"Error reading blocks from {page_id}: {e}")
    # unique
    return list(dict.fromkeys(menciones))


# ---------------------------
# Read/write relational property
# ---------------------------

def get_relations_enllaca_a(page_id: str) -> List[str]:
    """Returns the current list of IDs in the relational property 'Enllaça a'."""
    try:
        page = notion.pages.retrieve(page_id=page_id)
        props = page.get("properties", {})
        rel = props.get("Enllaça a")
        if rel and rel.get("type") == "relation":
            return [r["id"] for r in rel.get("relation", []) if "id" in r]
    except Exception as e:
        log.info(f"[WARN] Cannot read 'Enllaça a' from {page_id}: {e}")
    return []


def set_relations_enllaca_a(page_id: str, ids: List[str]) -> None:
    """Overwrites the 'Enllaça a' property with the passed IDs (no duplicates)."""
    uniq = list(dict.fromkeys(ids))
    notion.pages.update(
        page_id=page_id,
        properties={"Enllaça a": {"relation": [{"id": i} for i in uniq]}}
    )


def actualizar_enlaces_pagina(page_id: str, menciones: List[str]) -> None:
    """
    Attempts to add ALL mentions at once (bulk). If it fails (e.g. due to lack of access
    to some mentioned pages), performs incremental fallback ONE-BY-ONE:
      - Reads current state
      - Adds the mention if not present
      - If a mention fails, it is recorded in 'missing'
    """
    if not menciones:
        return

    # Current state + target set
    actuales = get_relations_enllaca_a(page_id)
    target   = list(dict.fromkeys(actuales + menciones))

    # 1) Bulk attempt (faster)
    try:
        set_relations_enllaca_a(page_id, target)
        added = len(target) - len(actuales)
        log.info(f"✅ Updated page with {added} links (total {len(target)})")
        return
    except Exception as e:
        log.info(f"⚠️ Bulk failure ({page_id}): {e}. Trying incremental…")

    # 2) Incremental fallback (does not lose links)
    ok, ko = 0, 0
    current = set(actuales)
    for mention_id in menciones:
        if mention_id in current:
            continue
        try:
            # Add keeping what was there
            new_list = list(current | {mention_id})
            set_relations_enllaca_a(page_id, new_list)
            current.add(mention_id)
            ok += 1
        except Exception as e:
            ko += 1
            log.info(f"❌ Could not add relation to {page_id} → {mention_id}: {e}")
            missing.append((page_id, mention_id, str(e)))

    log.info(f"✅ Relations added: {ok} | ❌ Failed: {ko} | Total now: {len(current)}")


# ---------------------------
# Main process
# ---------------------------

def procesar_todas_las_notas() -> None:
    log.info("🔄 Starting links update...\n")

    try:
        pages = fetch_all_pages(DATABASE_ID)
        total = len(pages)
        log.info(f"📚 Found {total} notes to process\n")

        for i, page in enumerate(pages, 1):
            page_id = page["id"]
            # Title (Name/Nom)
            props = page.get("properties", {})
            title_prop = props.get("Name") or props.get("Nom")
            if title_prop and title_prop.get("title"):
                title = title_prop["title"][0].get("plain_text") or "Untitled"
            else:
                title = "Untitled"

            log.info(f"[{i}/{total}] Processing: {title}")

            menciones = extraer_menciones_de_pagina(page_id)
            if menciones:
                log.info(f"   → Found {len(menciones)} mentions")
                actualizar_enlaces_pagina(page_id, menciones)
            else:
                log.info("   → No mentions")

        # CSV of IDs without access
        if missing:
            out = os.path.expanduser("/output/missing_access.csv")
            os.makedirs(os.path.dirname(out), exist_ok=True)
            with open(out, "w", newline="", encoding="utf-8") as f:
                w = csv.writer(f)
                w.writerow(["source_page_id", "mentioned_page_id", "error"])
                w.writerows(missing)
            log.info(f"[WARN] Recorded {len(missing)} pages without access to: {out}")

        log.info("✅ Process completed!\n")
        log.info("NOTE: 'Enllaça per' updates automatically by Notion")
        log.info("when you update 'Enllaça a' (they are bidirectional)")

    except Exception as e:
        log.info(f"❌ Error: {e}")


if __name__ == "__main__":
    procesar_todas_las_notas()
