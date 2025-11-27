# pipeline/notion_api.py

"""
Notion Abstraction Layer
--------------------------

Provides stable and unified functions for:
- Querying a DB
- Getting a page
- Reading blocks
- Extracting tags
- Extracting relations
- Extracting titles

This avoids direct dependencies on "notion.databases.query"
(and protects us from future SDK updates).
"""

import unicodedata
from typing import List, Dict, Optional, Tuple
from notion_client import Client
from config.logger_config import get_logger
from config.app_config import load_params
from config.env_config import get_env

cfg = load_params()
log = get_logger(__name__)

# --------------------------------------------------------------------
# 🔧 Load environment variables
# --------------------------------------------------------------------
NOTION_TOKEN = get_env("NOTION_TOKEN", required=True)
DATABASE_ID  = get_env("DATABASE_ID", required=True)

if not NOTION_TOKEN:
    raise RuntimeError("NOTION_TOKEN is not defined in .env")
if not DATABASE_ID:
    raise RuntimeError("DATABASE_ID is not defined in .env")

# --------------------------------------------------------------------
# 🚀 Initialize Notion Client
# --------------------------------------------------------------------
notion = Client(auth=NOTION_TOKEN)


# =============================================================================
# 🟦 Basic Helper Functions
# =============================================================================
def normalize_text(s: str) -> str:
    if not s:
        return ""
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return s.strip()


def notion_url(page_id: str) -> str:
    return f"https://www.notion.so/{page_id.replace('-', '')}"

# =============================================================================
# 🟩 Notion API Wrappers
# =============================================================================
def get_database_properties(database_id: str = DATABASE_ID) -> Dict:
    """Returns DB metadata: properties, types, etc."""
    return notion.databases.retrieve(database_id=database_id)


import httpx

# ... (existing imports)

# ... (existing code)

# =============================================================================
# 🟩 Notion API Wrappers
# =============================================================================
def get_database_properties(database_id: str = DATABASE_ID) -> Dict:
    """Returns DB metadata: properties, types, etc."""
    return notion.databases.retrieve(database_id=database_id)


def _raw_query_database(database_id: str, **kwargs) -> Dict:
    """
    Workaround for missing notion.databases.query method.
    Uses direct HTTPX request.
    """
    url = f"https://api.notion.com/v1/databases/{database_id}/query"
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }
    
    # Filter out None values to avoid API errors
    json_body = {k: v for k, v in kwargs.items() if v is not None}
    
    response = httpx.post(url, headers=headers, json=json_body, timeout=60.0)
    response.raise_for_status()
    return response.json()


def query_database(database_id: str = DATABASE_ID, filter=None, page_size=100, start_cursor=None):
    return _raw_query_database(
        database_id=database_id,
        filter=filter,
        page_size=page_size,
        start_cursor=start_cursor
    )

def query_all_pages(filter=None) -> List[Dict]:
  results = []
  next_cursor = None

  while True:
    resp = _raw_query_database(
      database_id=DATABASE_ID,
      filter=filter,
      page_size=100,
      start_cursor=next_cursor
    )

    results.extend(resp.get("results", []))

    if not resp.get("has_more"):
      break

    next_cursor = resp.get("next_cursor")

  return results

def retrieve_page(page_id: str) -> Dict:
    return notion.pages.retrieve(page_id=page_id)


def get_page_properties(page: Dict) -> Dict:
    return page.get("properties", {}) or {}


def get_blocks(page_id: str) -> List[Dict]:
    """Returns all first-level blocks."""
    try:
        res = notion.blocks.children.list(page_id)
        return res.get("results", [])
    except Exception:
        return []


# =============================================================================
# 🟨 High-Level Data Extractors
# =============================================================================

def extract_title(props: Dict, title_aliases: List[str]) -> Optional[str]:
    """Extracts title according to a list of aliases."""
    for k in title_aliases:
        v = props.get(k)
        if isinstance(v, dict) and v.get("type") == "title":
            arr = v.get("title", [])
            if arr:
                txt = "".join(x.get("plain_text", "") for x in arr).strip()
                if txt:
                    return normalize_text(txt)
    return None


def extract_tags(props: Dict, tag_aliases: List[str]) -> List[Dict]:
    """Extracts multi-select tags with color."""
    for key in tag_aliases:
        v = props.get(key)
        if isinstance(v, dict) and v.get("type") == "multi_select":
            tags = []
            for t in v.get("multi_select", []):
                name = t.get("name")
                if name:
                    tags.append({
                        "name": name,
                        "color": t.get("color", "default")
                    })
            return tags
    return []


def extract_relations(props: Dict, aliases: List[str]) -> List[str]:
    """
    Extracts relation IDs using multiple possible names.
    Works with any language and alias.
    """
    # 1) exact match by alias
    alias_map = {a.casefold(): a for a in aliases}

    for prop_name, prop_value in props.items():
        if not isinstance(prop_value, dict) or prop_value.get("type") != "relation":
            continue
        if prop_name.casefold() in alias_map:
            return [rel.get("id") for rel in prop_value.get("relation", []) if rel.get("id")]

    # 2) fallback: names containing "project", "link", etc.
    for prop_name, prop_value in props.items():
        if isinstance(prop_value, dict) and prop_value.get("type") == "relation":
            low = prop_name.casefold()
            if any(a.casefold().split()[0] in low for a in aliases):
                return [rel.get("id") for rel in prop_value.get("relation", []) if rel.get("id")]

    return []


_PROJECT_TITLE_CACHE = {}

def extract_project_titles(page_ids: List[str], title_aliases: List[str]) -> List[str]:
    """Given project IDs, retrieves their human titles."""
    titles = []
    for pid in page_ids[:10]:
        if pid in _PROJECT_TITLE_CACHE:
            titles.append(_PROJECT_TITLE_CACHE[pid])
            continue
            
        try:
            p = retrieve_page(pid)
            t = extract_title( get_page_properties(p), title_aliases )
            if t:
                _PROJECT_TITLE_CACHE[pid] = t
                titles.append(t)
            else:
                # Cache empty result to avoid retrying
                _PROJECT_TITLE_CACHE[pid] = ""
        except Exception:
            pass
    return [t for t in titles if t]


def extract_content_and_mentions(page_id: str) -> Tuple[str, List[str]]:
    """
    Gathers useful text from typical blocks AND extracts page mentions.
    Returns: (text_content, list_of_mentioned_page_ids)
    """
    blocks = get_blocks(page_id)
    out_text = []
    mentions = []
    
    TYPES = {"paragraph", "heading_1", "heading_2", "heading_3",
             "bulleted_list_item", "numbered_list_item", "quote", "to_do", "toggle", "callout"}
             
    for block in blocks:
        tp = block.get("type")
        if tp in TYPES:
            rich_text = block.get(tp, {}).get("rich_text", [])
            
            # Extract text
            txt = "".join([t.get("plain_text", "") for t in rich_text]).strip()
            if txt:
                out_text.append(txt)
                
            # Extract mentions
            for t in rich_text:
                if t.get("type") == "mention" and t.get("mention", {}).get("type") == "page":
                    pid = t["mention"]["page"]["id"]
                    mentions.append(pid)
                    
    return "\n".join(out_text), list(dict.fromkeys(mentions)) # Unique mentions

def extract_page_text(page_id: str) -> str:
    """Wrapper for backward compatibility."""
    text, _ = extract_content_and_mentions(page_id)
    return text

def update_page_relations(page_id: str, new_relation_ids: List[str], relation_prop_aliases: List[str]) -> None:
    """
    Updates the relation property (found via aliases) with new IDs.
    Merges with existing relations.
    Implements Bulk + Incremental Fallback strategy.
    """
    if not new_relation_ids:
        return

    # 1. Find the property name
    try:
        page = retrieve_page(page_id)
        props = page.get("properties", {})
        
        # Find the actual property name using aliases
        target_prop = None
        # Exact match
        alias_map = {a.casefold(): a for a in relation_prop_aliases}
        for k, v in props.items():
            if k.casefold() in alias_map and v.get("type") == "relation":
                target_prop = k
                break
        
        # Fallback match
        if not target_prop:
            for k, v in props.items():
                if v.get("type") == "relation":
                    low = k.casefold()
                    if any(a.casefold().split()[0] in low for a in relation_prop_aliases):
                        target_prop = k
                        break
        
        if not target_prop:
            log.warning(f"Could not find relation property matching {relation_prop_aliases} in page {page_id}")
            return

        # Get current relations
        current_rels = props.get(target_prop, {}).get("relation", [])
        current_ids = [r["id"] for r in current_rels]
        
        # Calculate target set (Current + New)
        target_ids = list(dict.fromkeys(current_ids + new_relation_ids))
        
        # If nothing to add, return
        if len(target_ids) == len(current_ids):
            return

        # 2. Try Bulk Update
        try:
            notion.pages.update(
                page_id=page_id,
                properties={target_prop: {"relation": [{"id": i} for i in target_ids]}}
            )
            log.info(f"✅ Updated '{target_prop}' on {page_id} with {len(target_ids) - len(current_ids)} new links.")
            return
        except Exception as e:
            log.warning(f"⚠️ Bulk update failed for {page_id}: {e}. Trying incremental fallback...")

        # 3. Incremental Fallback
        # We start with current_ids and try to add new ones one by one
        working_set = set(current_ids)
        
        for new_id in new_relation_ids:
            if new_id in working_set:
                continue
                
            try:
                temp_list = list(working_set | {new_id})
                notion.pages.update(
                    page_id=page_id,
                    properties={target_prop: {"relation": [{"id": i} for i in temp_list]}}
                )
                working_set.add(new_id)
                log.info(f"   + Added {new_id}")
            except Exception as e:
                log.error(f"   ❌ Failed to add {new_id}: {e}")

    except Exception as e:
        log.error(f"Error updating relations for {page_id}: {e}")


# =============================================================================
# 🟥 HIGH LEVEL: "GET NOTES"
# =============================================================================

def get_notes_by_type(
    tipo_select: str,
    type_property_name: str,
    title_aliases: List[str],
    tag_aliases: List[str],
    project_aliases: List[str],
) -> List[Dict]:
    """
    Retrieves and structures notes based on type and configuration.
    """

    pages = query_all_pages(
        filter={"property": type_property_name, "select": {"equals": tipo_select}}
    )
    
    log.info(f"   Found {len(pages)} pages of type '{tipo_select}'. Fetching details...")

    notes = []
    for i, page in enumerate(pages, 1):
        if i % 10 == 0:
            log.info(f"   Processing {i}/{len(pages)}...")

        props = get_page_properties(page)
        titulo = extract_title(props, title_aliases)
        if not titulo:
            continue

        tags = extract_tags(props, tag_aliases)
        project_ids = extract_relations(props, project_aliases)
        project_titles = extract_project_titles(project_ids, title_aliases)

        # Extract content AND mentions
        content, mentions = extract_content_and_mentions(page["id"])

        notes.append({
            "id": page["id"],
            "titulo": titulo,
            "tags": tags,
            "projects": project_titles,
            "project_ids": project_ids,
            "contenido": content,
            "mentions": mentions, # New field
            "url": notion_url(page["id"]),
        })

    return notes
