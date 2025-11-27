#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
notion_structure.py
-------------------
Generates two lightweight files from your Notion metadata:
 - temenos-structure.md : Markdown tree with pages and databases
 - db-schemas.csv       : property schema of each database

Requirements:
  - Python 3.9+
  - pip install requests

How to run:
  export NOTION_TOKEN=secret_xxx
  python notion_structure.py
"""
import os
import sys
import csv
import time
import json
from typing import Dict, Any, List, Optional
import requests
from dotenv import load_dotenv
from config.logger_config import setup_logging, get_logger
from config.app_config import load_params

cfg = load_params()
setup_logging(getattr(cfg, "log_level", "INFO"))
log = get_logger(__name__)

load_dotenv(os.path.expanduser("/.env"))

API = "https://api.notion.com/v1"
NOTION_VERSION = os.environ.get("NOTION_VERSION", "2022-06-28")
TOKEN = os.environ.get("NOTION_TOKEN")

if not TOKEN:
    sys.stderr.write("✗ Missing environment variable NOTION_TOKEN.\n"
                     "  E.g.: export NOTION_TOKEN=secret_xxx\n")
    sys.exit(1)

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
}

def _sleep_backoff(attempt: int, retry_after: Optional[float] = None) -> None:
    if retry_after:
        time.sleep(retry_after)
    else:
        time.sleep(min(2 ** attempt, 30))

def notion_fetch(path: str, method: str = "GET", body: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """HTTP helper with gentle retries (429/5xx)."""
    url = API + path
    tries = 0
    while True:
        tries += 1
        try:
            if method.upper() == "GET":
                res = requests.get(url, headers=HEADERS, timeout=60)
            else:
                res = requests.request(method.upper(), url, headers=HEADERS, json=body or {}, timeout=60)
        except requests.RequestException as e:
            if tries <= 5:
                _sleep_backoff(tries)
                continue
            raise RuntimeError(f"Persistent network error: {e}") from e

        if res.status_code == 200:
            return res.json()

        # Rate limit / temporary errors
        if res.status_code in (429, 502, 503, 504) and tries <= 6:
            retry_after = None
            if "Retry-After" in res.headers:
                try:
                    retry_after = float(res.headers["Retry-After"])
                except ValueError:
                    retry_after = None
            _sleep_backoff(tries, retry_after)
            continue

        # Final error
        try:
            payload = res.json()
        except Exception:
            payload = {"raw": res.text}
        raise RuntimeError(f"HTTP {res.status_code} {res.reason}: {json.dumps(payload, ensure_ascii=False)}")

def search_all(object_type: str) -> List[Dict[str, Any]]:
    """Returns all /search results for object ('page' or 'database').
       Limits scope to pages/DBs where the integration has access.
    """
    if object_type not in ("page", "database"):
        raise ValueError("object_type must be 'page' or 'database'")
    results: List[Dict[str, Any]] = []
    cursor: Optional[str] = None
    while True:
        body = {"page_size": 100, "filter": {"property": "object", "value": object_type}}
        if cursor:
            body["start_cursor"] = cursor
        data = notion_fetch("/search", "POST", body)
        results.extend(data.get("results", []))
        if data.get("has_more"):
            cursor = data.get("next_cursor")
        else:
            break
    return results

def rich_text_to_plain(rt_list: List[Dict[str, Any]]) -> str:
    return "".join(rt.get("plain_text", "") for rt in (rt_list or [])).strip()

def extract_page_title(page_obj: Dict[str, Any]) -> str:
    # Try to find the title property (whether DB element or free page)
    props = page_obj.get("properties") or {}
    for name, prop in props.items():
        if prop.get("type") == "title":
            title = rich_text_to_plain(prop.get("title", []))
            if title:
                return title
    # Fallback: some /search results may have short "title" in "page" -> unreliable
    # Last resort: untitled label
    return "(untitled)"

def get_page_meta(page_id: str) -> Dict[str, Any]:
    page = notion_fetch(f"/pages/{page_id}")
    title = extract_page_title(page)
    parent = page.get("parent")
    return {"title": title, "parent": parent}

def get_database_meta(db_id: str) -> Dict[str, Any]:
    db = notion_fetch(f"/databases/{db_id}")
    db_title = rich_text_to_plain(db.get("title", [])) or "(DB untitled)"
    parent = db.get("parent")
    # Flatten the property schema
    schema_rows = []
    for prop_name, prop_def in (db.get("properties") or {}).items():
        schema_rows.append({
            "db_id": db_id,
            "db_title": db_title,
            "property": prop_name,
            "prop_type": prop_def.get("type", "unknown"),
        })
    return {"title": db_title, "parent": parent, "schema": schema_rows}

def parent_key(parent: Optional[Dict[str, Any]]) -> str:
    if not parent:
        return "root"
    ptype = parent.get("type")
    if ptype == "workspace":
        return "root"
    if ptype == "page_id":
        return parent.get("page_id", "root")
    if ptype == "database_id":
        return parent.get("database_id", "root")
    if ptype == "block_id":
        return "block:" + parent.get("block_id", "root")
    return "root"

def build_tree(nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Builds a simple tree from nodes with parentId."""
    imap: Dict[str, Dict[str, Any]] = {n["id"]: {**n, "children": []} for n in nodes}
    roots: List[Dict[str, Any]] = []
    for n in imap.values():
        pid = n.get("parentId")
        if not pid or pid == "root":
            roots.append(n); continue
        parent = imap.get(pid)
        if parent:
            parent["children"].append(n)
        else:
            roots.append(n)  # parent not found -> treat as root
    return roots

def to_markdown_tree(nodes: List[Dict[str, Any]], depth: int = 0) -> str:
    pad = "  " * depth
    out_lines: List[str] = []
    # Sort: DBs first, then pages; within, alphabetically by title
    sorted_nodes = sorted(nodes, key=lambda n: (0 if n["type"] == "database" else 1, n["title"].lower()))
    for n in sorted_nodes:
        tag = "🗄️ DB" if n["type"] == "database" else "📄 Page"
        out_lines.append(f"{pad}- {tag} **{n['title']}**  _(id:{n['id']})_")
        if n.get("children"):
            out_lines.append(to_markdown_tree(n["children"], depth + 1))
    return "\n".join(out_lines)

def write_markdown_tree(roots: List[Dict[str, Any]], path: str) -> None:
    md = "# Notion Structure (summary)\n\n" + to_markdown_tree(roots) + "\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(md)

def write_db_schema_csv(rows: List[Dict[str, Any]], path: str) -> None:
    fieldnames = ["db_id", "db_title", "property", "prop_type"]
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)

def main() -> int:
    log.info("→ Searching pages…", flush=True)
    pages_search = search_all("page")
    log.info(f"  {len(pages_search)} pages (integration access)", flush=True)

    log.info("→ Searching databases…", flush=True)
    dbs_search = search_all("database")
    log.info(f"  {len(dbs_search)} DBs (integration access)", flush=True)

    # Enrich
    nodes: List[Dict[str, Any]] = []
    schema_rows: List[Dict[str, Any]] = []

    for i, p in enumerate(pages_search, 1):
        pid = p.get("id")
        try:
            meta = get_page_meta(pid)
            nodes.append({
                "id": pid,
                "type": "page",
                "title": meta["title"],
                "parentId": parent_key(meta["parent"]),
            })
        except Exception as e:
            sys.stderr.write(f"Warning (page {pid}): {e}\n")

    for i, d in enumerate(dbs_search, 1):
        did = d.get("id")
        try:
            meta = get_database_meta(did)
            nodes.append({
                "id": did,
                "type": "database",
                "title": meta["title"],
                "parentId": parent_key(meta["parent"]),
            })
            schema_rows.extend(meta["schema"])
        except Exception as e:
            sys.stderr.write(f"Warning (db {did}): {e}\n")

    roots = build_tree(nodes)

    out_md = "temenos-structure.md"
    out_csv = "db-schemas.csv"
    write_markdown_tree(roots, out_md)
    write_db_schema_csv(schema_rows, out_csv)

    log.info(f"✓ Written '{out_md}'")
    log.info(f"✓ Written '{out_csv}'")
    log.info("Done. Upload these two files here.")

    return 0

if __name__ == "__main__":
    sys.exit(main())
