# src/data-pipeline/filter_graph.py

def _evidence(e) -> set[str]:
    ev = e.get("evidence", [])
    if isinstance(ev, str):
        ev = [ev]
    return {str(x).lower().strip() for x in ev if x}



from typing import Any, Dict

def normalize_notion_tags(tags):
    out = []
    for t in tags or []:
        # Standard Notion case
        if isinstance(t, dict):
            name = str(t.get("name", "")).strip()
            if name:  # only accept non-empty names
                out.append({
                    "name": name,
                    "color": str(t.get("color", "default"))
                })
            continue

        # case tags as strings
        if isinstance(t, str):
            name = t.strip()
            if name:
                out.append({"name": name, "color": "default"})
            continue

    return out

def filter_graph(data: Dict[str, Any], filters: Dict[str, Any] = None) -> tuple[list, list]:
    """
    Performs basic graph cleanup for static generation (Sigma).
    
    This function focuses on removing "pure" tag edges that lack other supporting evidence,
    ensuring a cleaner graph visualization. Dynamic filters (search, projects, kinds) are
    handled by the frontend.
    """
    nodes = data.get("nodes", [])
    edges = data.get("edges", [])

    # 1. Nodes: Pass all (visual filtering is handled in the frontend)
    filtered_nodes = nodes
    
    # 2. Edges: Clean only noise (pure tags without other evidence)
    filtered_edges = []
    for e in edges:
        ev = [x.lower() for x in (e.get("evidence") or [])]
        
        # Exclude only *pure* "tag" type edges (source or target is a tag-node),
        # but keep connections between notes suggested by tag coincidence.
        # If "tags" is in evidence but nothing else (no ai, no explicit, no inferred...), remove.
        if (
            "tags" in ev
            and not any(x in {"ai", "explicit", "inferred", "tags_inferred"} for x in ev)
        ):
            continue

        filtered_edges.append(e)

    print(f"🧠 DEBUG filter_graph (Static Cleanup):")
    print(f"   Nodes input: {len(nodes)}, output: {len(filtered_nodes)}")
    print(f"   Edges input: {len(edges)}, output: {len(filtered_edges)}")

    return filtered_nodes, filtered_edges
