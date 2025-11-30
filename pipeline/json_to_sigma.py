# src/data_pipeline/json_to_sigma.py

from pathlib import Path
from typing import Optional
import json
import math
import networkx as nx
from config.app_config import load_params 
from pipeline.utils.json_sanitizer import sanitize_json_graph
from pipeline.filter_graph import filter_graph, normalize_notion_tags
import sys
from pipeline.utils.graph_styles import (
    node_colors,
    edge_style_by_evidence_and_similarity,
    COLOR_BY_TYPE,
    SIM_BUCKETS,
    EXPLICIT_EDGE_COLOR,
    DIRECT_CONNECTION,
    notion_color_to_hex
)
import hashlib
from collections import Counter
from config.logger_config import get_logger

cfg = load_params()
log = get_logger(__name__)

OUT_JSON = cfg.paths["OUT_JSON"]
OUT_GRAPH = cfg.paths["OUT_GRAPH"]

def clean_label(s: str) -> str:
    return str(s).replace("tag::", "").strip("📍 ").strip()

def compute_cluster_and_extras(node: dict) -> tuple:
    tags = node.get("tags") or []
    if tags:
        cluster = tags[0].get("name", "Altres")
        clusters_extra = [t.get("name") for t in tags[1:] if t.get("name")]
    else:
        cluster, clusters_extra = "Altres", []
    return cluster, clusters_extra


def convert_for_sigma(
        sugg_path=OUT_JSON,
        out_path=OUT_GRAPH,
        include_tags=True,
        filters: Optional[dict] = None,
        layout: str = "reuse",
):
    filters = filters or {}
    data = json.loads(Path(sugg_path).read_text(encoding="utf-8"))

    for node in data.get("nodes", []):
        raw_tags = normalize_notion_tags(node.get("tags"))

        fixed_tags = []
        for t in raw_tags:
            if isinstance(t, dict):
                fixed_tags.append(t)
            else:
                fixed_tags.append({"name": str(t).strip(), "color": "default"})

        node["tags"] = fixed_tags

        # Synchronize cluster and tags
        if fixed_tags:
            # the first tag defines the cluster
            node["cluster"] = fixed_tags[0]["name"]
        else:
            node["cluster"] = "Altres"

    filtered_nodes, filtered_edges = filter_graph(data, filters)

    G = nx.DiGraph()
    node_ids_principals = {n["id"] for n in filtered_nodes}
    G.add_nodes_from(node_ids_principals)

    # Separate existing tag nodes from input JSON
    existing_tag_nodes = [n for n in filtered_nodes if n.get("kind") == "tag"]
    regular_nodes = [n for n in filtered_nodes if n.get("kind") != "tag"]
    
    tag_nodes_map = {}
    if include_tags:
        # Only use tag nodes that already exist in the JSON
        for tag_node in existing_tag_nodes:
            tag_id = tag_node["id"]
            # Extract tag name from ID (tag::name -> name)
            tag_name = tag_id.replace("tag::", "")
            G.add_node(tag_id)
            # Create a tag object compatible with the expected format
            tag_nodes_map[tag_name] = {
                "name": tag_name,
                "color": "default"  # We could extract the color if available
            }

    TAG_EDGE_WEIGHT = 0.2
    
    for e in filtered_edges:
        # Determine weight based on evidence
        weight = 0.5 # Default weak weight
        
        ev = [str(x).lower() for x in (e.get("evidence") or [])]
        
        if "explicit" in ev:
            weight = 3.0 # Strong pull for explicit links
        elif "ai" in ev:
            # AI links: weight based on similarity
            sim = float(e.get("similarity", 0) or 0)
            if sim > 85:
                weight = 1.5
            elif sim > 70:
                weight = 0.8
            else:
                weight = 0.3
        elif "tags" in ev:
            weight = 0.2 # Weak pull for tag coincidences
            
        # Check if it's a tag node connection (source or target is tag::...)
        if e["source"].startswith("tag::") or e["target"].startswith("tag::"):
             weight = 1.0 # Moderate pull for tag-to-note connections

        G.add_edge(e["source"], e["target"], weight=weight)

    print("🌸 Generating spring layout (High Repulsion)...")
    # k=3.5 (much higher than 0.8) to force nodes apart
    # iterations=200 for better convergence
    positions = nx.spring_layout(G, k=3.5, iterations=200, seed=42, weight='weight')

    if positions:
        connected_components = list(nx.weakly_connected_components(G))
        if connected_components:
            largest_component = max(connected_components, key=len)
            core_positions = {node: pos for node, pos in positions.items() if node in largest_component}
            if core_positions:
                avg_x = sum(x for x, _ in core_positions.values()) / len(core_positions)
                avg_y = sum(y for _, y in core_positions.values()) / len(core_positions)
                positions = {k: (x - avg_x, y - avg_y) for k, (x, y) in positions.items()}

        max_abs_val = max(abs(coord) for pos in positions.values() for coord in pos) or 1.0
        # SCALING_FACTOR=2000 to use more canvas space
        SCALING_FACTOR = 2000
        positions = {
            k: (x / max_abs_val * SCALING_FACTOR, y / max_abs_val * SCALING_FACTOR)
            for k, (x, y) in positions.items()
        }
        print("✅ Layout centered and scaled (Spread Mode).")

    sigma_nodes = []
    for n in filtered_nodes:
        pos = positions.get(n["id"], (0, 0))
        project_value = (n.get("projects") or ["Altres"])[0]
        cluster, clusters_extra = compute_cluster_and_extras(n)
        tag_names = [t.get("name") for t in n.get("tags", []) if t.get("name")]

        sigma_nodes.append({
            "key": n["id"],
            "label": clean_label(n.get("title", "")),
            "x": round(pos[0], 2),
            "y": round(pos[1], 2),
            "size": round(4 + math.log(G.degree(n["id"]) + 1, 1.6), 2) if n["id"] in G else 4,
            "color": node_colors(n.get("kind", "permanent"))["bg"],
            "border": node_colors(n.get("kind", "permanent"))["border"],
            "font": node_colors(n.get("kind", "permanent"))["font"],
            "kind": n.get("kind", "permanent"),
            "cluster": clean_label(cluster),
            "clusters_extra": clusters_extra,
            "project": clean_label(project_value),
            "tags": tag_names,
            "url": n.get("notion_url") or n.get("url") or f"https://www.notion.so/{n['id'].replace('-', '')}",
            "kind_bg": node_colors(n.get("kind", "permanent"))["bg"],
            "kind_border": node_colors(n.get("kind", "permanent"))["border"],
            "kind_font": node_colors(n.get("kind", "permanent"))["font"],
            "isStructural": False,
        })

    # Tag nodes have already been processed in the previous loop (filtered_nodes includes nodes with kind="tag")
    # We don't need to create additional tag nodes here


    sigma_edges = []
    original_edges_map = {(e["source"], e["target"]): e for e in filtered_edges}

    for source, target in G.edges():
        is_tag_edge = source.startswith("tag::") or target.startswith("tag::")

        original_edge = (
            original_edges_map.get((source, target))
            or original_edges_map.get((target, source))
            or next(
                (e for e in filtered_edges if {e["source"], e["target"]} == {source, target}),
                None,
            )
        )

        # --- Evidence and similarity ---
        # Get evidence from original edge (works for both tag and non-tag edges)
        ev = [str(x).lower() for x in (original_edge.get("evidence") or [])] if original_edge else []
        sim = float(original_edge.get("similarity", 0) or 0) if original_edge else 0.0
        
        # For tag edges without explicit evidence, override to empty
        if is_tag_edge and not ev:
            ev = []
            sim = 100.0

        # --- Direction ---
        # Only add arrows if evidence contains "explicit"
        directed = "explicit" in ev

        # --- Style (colors + dashed) ---
        # PRIORITY: Check for explicit evidence first, regardless of whether it's a tag edge
        if "explicit" in ev:
            # Explicit edges (including tag-to-note explicit edges) use explicit styling
            stl = edge_style_by_evidence_and_similarity(ev, sim)
            color = stl["color"]
            kind = "explicit"
            dashed = False
            
            # 🎯 Highlight explicit directed connections
            if directed:
                color = DIRECT_CONNECTION  # blue "Directed Connection"
            
            edge_type = "arrow" if directed else "line"
        elif is_tag_edge:
            # Non-explicit tag edges use tag styling
            stl = edge_style_by_evidence_and_similarity(["tags"])
            color = stl["color"]
            kind = "tag"
            dashed = False
            directed = False  # tag edges are not directed
            edge_type = "line"  # <- VALID TYPE FOR SIGMA
        else:
            # Other inferred edges
            stl = edge_style_by_evidence_and_similarity(ev, sim)
            color = stl["color"]
            kind = "inferred"
            dashed = bool(stl.get("dashes"))
            edge_type = "arrow" if directed else "line"

        # Get reasons from original edge if available
        reasons = original_edge.get("reasons", []) if original_edge else []

        sigma_edges.append({
            "source": source,
            "target": target,
            "color": color,
            "type": edge_type,      # Now only "line" or "arrow"
            "kind": kind,
            "similarity": sim,
            "evidence": ev,
            "reasons": reasons,
            "directed": directed,
            "dashed": dashed,
            "isTagEdge": is_tag_edge,
        })

    # 1. Calculate node count for each 'kind' (Note type)
    kind_counts = Counter(n.get("kind") for n in filtered_nodes)
    kind_counts["tag"] = len(tag_nodes_map)  # Add count for 'tag' type nodes

    kinds_for_legend = []
    for kind_name, kind_colors in COLOR_BY_TYPE.items():
        kinds_for_legend.append({
            "label": kind_name.capitalize(),
            "color": kind_colors["bg"],
            "count": kind_counts.get(kind_name, 0)
        })

    # 2. Calculate node count for each 'cluster' (Tag)
    cluster_counts = Counter()
    for n in filtered_nodes:
        # Get tag list from node object
        tags = n.get("tags", [])
        if tags:  # If node has tags
            first_tag_name = tags[0].get("name")
            if first_tag_name:
                cluster_counts[first_tag_name] += 1

    clusters_for_legend = []
    for tag_name, tag_obj in sorted(tag_nodes_map.items()):
        notion_color_name = tag_obj.get("color", "default")
        hex_color = notion_color_to_hex(notion_color_name)
        clusters_for_legend.append({
            "label": tag_name,
            "color": hex_color,
            "count": cluster_counts.get(tag_name, 0)  # Now the count will be correct
        })

    # 3. Build final legend object (no changes here)
    legend_data = {
        "nodes": [{"label": key.capitalize(), "color": value["bg"]} for key, value in COLOR_BY_TYPE.items()],
        "edges": [
            {
                "label": "Real Connection",
                "color": EXPLICIT_EDGE_COLOR,
                "type": "explicit",
                "kind": "explicit",
                "evidence": "explicit"
            },
            {
                "label": "Directed Connection",
                "color": DIRECT_CONNECTION,
                "type": "directed",
                "kind": "directed",
                "evidence": "directed"
            },
            {
                "label": "Strong Similarity (>85%)",
                "color": SIM_BUCKETS[0]["color"],
                "type": "similarity",
                "kind": "similarity",
                "evidence": ">85"
            },
            {
                "label": "Medium Similarity (>70%)",
                "color": SIM_BUCKETS[1]["color"],
                "type": "similarity",
                "kind": "similarity",
                "evidence": ">70"
            },
            {
                "label": "Weak Similarity (>60%)",
                "color": SIM_BUCKETS[2]["color"],
                "type": "similarity",
                "kind": "similarity",
                "evidence": ">60"
            },
        ],

        "kinds": kinds_for_legend,
        "clusters": clusters_for_legend,
    }

    out = {"nodes": sigma_nodes, "edges": sigma_edges, "legend": legend_data}
    clean_str = sanitize_json_graph(out)
    Path(out_path).write_text(clean_str, encoding="utf-8")

    print(f"✅ Sigma graph generated with {len(sigma_nodes)} nodes and {len(sigma_edges)} edges.")
    # ... (rest of the script to inject and copy files)

    def file_hash(path):
        h = hashlib.sha1()
        with open(path, "rb") as f:
            while chunk := f.read(8192):
                h.update(chunk)
        return h.hexdigest()

if __name__ == "__main__":
    arg_layout = sys.argv[1] if len(sys.argv) > 1 else "reuse"
    convert_for_sigma(layout=arg_layout)